{ pkgs, ... }:

# devenv（ローカル開発環境）— Amplify スタック向けの最小構成。
#
# 旧構成（Supabase Docker / Doppler / Drizzle / Deno Edge Functions の
# オーケストレーション）は撤去済み。インフラはすべて AWS Amplify に移行したため、
# バックエンドのローカル実行は `ampx sandbox`（per-developer のクラウド sandbox）で行う。
#
# 主要コマンド:
#   bootstrap   依存インストール（frontend: pnpm / backend-py: uv）
#   sandbox     Amplify バックエンドの sandbox 起動（amplify_outputs.json 生成）
#   dev-web     Next.js (web) 開発サーバ
#   dev-mobile  Expo (mobile) 開発サーバ
#   lint / format / type-check / unit-test  品質チェック

{
  # ===== Languages =====
  languages.javascript = {
    enable = true;
    pnpm.enable = true;
  };
  languages.typescript.enable = true;
  languages.python = {
    enable = true;
    # ampx sandbox は FastAPI custom function（functions/api）を
    # `python3 -m pip install -r requirements.txt --platform manylinux2014_x86_64
    #  --python-version 3.13 --only-binary=:all:` でローカルバンドルする。
    # devenv 既定の python には pip が無く "No module named pip" で synth 全体が
    # 失敗するため、pip を含む Python を nix で明示管理する（Lambda ランタイムに
    # 合わせて 3.13 を固定）。
    package = pkgs.python313.withPackages (ps: [ ps.pip ]);
    uv.enable = true;
  };

  # ===== Packages =====
  packages = with pkgs; [
    git
    jq
    awscli2
  ];

  # ===== Scripts（PATH に追加される単発コマンド）=====
  scripts = {
    # ---------- Install ----------
    bootstrap.exec = ''
      set -euo pipefail
      echo "→ frontend: pnpm install"
      (cd "$DEVENV_ROOT/frontend" && pnpm install)
      echo "→ backend-py: uv sync"
      (cd "$DEVENV_ROOT/backend-py" && uv sync --all-packages --all-groups)
      echo "→ amplify outputs: link into apps"
      link-amplify-outputs
    '';

    # ampx は生成物 `packages/backend/amplify_outputs.json` を backend パッケージ内に
    # 書き出すが、各アプリはそれぞれ自分の配下を参照する（web: tsconfig alias
    # `amplify-outputs` → ./amplify_outputs.json / mobile: relative import
    # `../../../amplify_outputs.json`）。この生成物は環境固有で .gitignore 対象のため
    # リポジトリには入らない。クローン直後の誰の環境でも `sandbox` → `dev-web` /
    # `dev-mobile` がそのまま通るよう、backend の生成物を各アプリへ symlink する。
    # symlink はターゲット未生成でも作成でき（初回 sandbox 前は dangling）、watch
    # モードの再生成もそのまま反映される。
    link-amplify-outputs.exec = ''
      set -euo pipefail
      cd "$DEVENV_ROOT/frontend"
      for app in web mobile; do
        ln -sfn ../../packages/backend/amplify_outputs.json "apps/$app/amplify_outputs.json"
      done
      echo "✓ linked amplify_outputs.json → apps/{web,mobile}"
    '';

    # ---------- Amplify backend (sandbox) ----------
    # sandbox 実行前に必ずアプリへの outputs リンクを張っておく（冪等）。
    sandbox.exec = ''link-amplify-outputs && cd "$DEVENV_ROOT/frontend/packages/backend" && pnpm run sandbox "$@"'';
    sandbox-once.exec = ''link-amplify-outputs && cd "$DEVENV_ROOT/frontend/packages/backend" && pnpm run sandbox:once "$@"'';
    sandbox-delete.exec = ''cd "$DEVENV_ROOT/frontend/packages/backend" && pnpm run sandbox:delete "$@"'';

    # ---------- Dev servers ----------
    dev-web.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run --filter @workspace/web dev "$@"'';
    dev-mobile.exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && pnpm run start "$@"'';
    # デスクトップ（Tauri v2）。**`dev-desktop` は Vite だけを起動する**ので Rust も
    # WebKitGTK も要らない（ブラウザで UI を確認する用途）。ネイティブウィンドウを出す /
    # 配布物を作るほうは Linux で WebKitGTK が要るため `-P desktop` が必須
    # （macOS / Windows は OS 側の前提だけで足りる）。
    #   devenv shell -P desktop -- tauri-desktop     # tauri dev
    #   devenv shell -P desktop -- build-desktop     # tauri build
    dev-desktop.exec = ''cd "$DEVENV_ROOT/frontend/apps/desktop" && pnpm run dev "$@"'';

    # Expo の対話的 TUI（デバイス選択・r でリロード等）。`dev-mobile` は非対話なので、
    # 実機 / シミュレータを触るときはこちらを使う。
    mobile-ios.exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && pnpm run ios "$@"'';
    mobile-android.exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && pnpm run android "$@"'';
    mobile-web.exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && pnpm run web "$@"'';
    tauri-desktop.exec = ''cd "$DEVENV_ROOT/frontend/apps/desktop" && pnpm run tauri:dev "$@"'';
    build-desktop.exec = ''cd "$DEVENV_ROOT/frontend/apps/desktop" && pnpm run tauri:build "$@"'';
    storybook.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run storybook'';
    build-storybook.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run build-storybook'';

    # Storybook は「ビルド成功・型 OK・lint OK」を全部満たしたまま描画だけ壊れることがある
    # （プロバイダー不足の実行時エラー、未翻訳キーの露出、CSS が当たっていない等）。
    # クラス文字列ではなく computed style と実行時エラーを実測する
    # （`.claude/rules/ui-testing.md`「完了条件: ビルドが通ったで終わらせない」）。
    # 前提: build-storybook 済み（frontend/storybook-static/）。
    verify-storybook-render.exec = ''exec node "$DEVENV_ROOT/scripts/frontend/verify-storybook-render.mjs" "$@"'';

    # ---------- Backend services (opt-in, on demand) ----------
    # REST API (FastAPI) — also runnable as the `backend` process via `devenv up`.
    dev-api.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run --package api api "$@"'';
    # MCP server (FastMCP, streamable-http on :4041).
    dev-mcp.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run --package mcp-server mcp-server "$@"'';

    # ---------- Quality: frontend ----------
    lint-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run lint'';
    # CI モード（`biome ci`。auto-fix せず差分があれば落ちる）
    lint-frontend-ci.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run lint:ci'';
    format-frontend-check.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run format-check'';
    # FSD のレイヤー境界検査（eslint-plugin-boundaries）。web / mobile / desktop を横断する。
    # Biome は境界を見ないので、`lint-frontend` が通っても
    # 「下位レイヤーが上位を import している」は検出されない。
    lint-fsd.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run lint:fsd'';
    format-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run format'';
    type-check-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run type-check'';
    type-check-mobile.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run --filter @workspace/mobile type-check'';
    test-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run test'';

    # ---------- Quality: backend-py ----------
    # ⚠️ **import 解決が要るツール（mypy / pytest）は `--all-packages` 必須**。
    # backend-py は uv の virtual workspace（root が `package = false`）なので、素の
    # `uv run` は root の dependency-group（ruff / mypy / pytest）しか同期せず、member の
    # 依存（fastapi / pydantic / structlog 等）を入れない。結果、
    #   - mypy: third-party が全部 `Any` に見え strict の untyped-decorator 等が誤爆する
    #   - pytest: conftest の import が解決できず collection error になる
    # という形で**壊れていないコードが落ちる**。ruff は import を解決しないので不要。
    lint-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff check --fix apps packages'';
    format-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff format apps packages'';
    format-backend-py-check.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff format --check apps packages'';
    lint-backend-py-ci.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff check apps packages'';
    type-check-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run --all-packages mypy apps packages'';
    test-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run --all-packages pytest'';

    # ---------- MCP 設定の同期 ----------
    # 正本は リポジトリ root の `.mcp.json`（Claude Code が直接読む形式）。
    # Cursor (JSON) / Codex (TOML) は形式が違うため、ここから投影して生成する。
    # 生成物は手動編集禁止（`.claude/rules/auto-generated.md`）。
    mcp-sync.exec = ''cd "$DEVENV_ROOT" && ./frontend/node_modules/.bin/tsx scripts/mcp/sync-mcp.ts'';

    # ---------- E2E (Maestro) ----------
    # 認証の往復（ログイン → パスワード再設定 → メール変更）は「送信できた」で
    # 終わらせず、コードを受け取って確定するまでを 1 本で踏む
    # （`.claude/rules/auth.md` §6）。実行には端末 / エミュレータが必要。
    # ドライバが Cognito のテストユーザ作成 → OTP ブリッジ起動 → maestro → 後始末を行う
    # （Maestro の graaljs は SigV4 を扱えないため、AWS を触る処理は外側に置く）。
    e2e-mobile.exec = ''cd "$DEVENV_ROOT" && node scripts/e2e/run-maestro.mjs .maestro/mobile "$@"'';
    e2e-web.exec = ''cd "$DEVENV_ROOT" && node scripts/e2e/run-maestro.mjs .maestro/web --platform web "$@"'';
    e2e.exec = ''e2e-mobile && e2e-web'';

    # ---------- モバイルリリース（EAS: クラウド / ローカルの両対応）----------
    # 各 script が起動時に `mobile_load_secrets`（env → AWS SSM Parameter Store）で
    # 資格情報を注入するので、呼ぶ側の準備は不要（`.claude/rules/aws-first.md`）。
    # 前提と必要なキー名は scripts/mobile/release-*.sh の冒頭 / docs/store/release-runbook.md。
    mobile-release-ios = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/release-ios.sh" "$@"'';
      description = "iOS を build → TestFlight（既定 expo.dev / --local でローカルビルド）";
    };
    mobile-release-android = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/release-android.sh" "$@"'';
      description = "Android を build → Play 内部テスト（既定 expo.dev / --local でローカルビルド）";
    };
    mobile-metadata = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/release-ios.sh" --metadata-only "$@"'';
      description = "store.config.js を App Store Connect へ同期（ビルドしない）";
    };
    sync-eas-env = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/sync-eas-env.sh" "$@"'';
      description = "env の EXPO_PUBLIC_* を EAS の Environment Variables へ同期";
    };

    # ---------- ストア掲載画像 ----------
    screenshots-mobile = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/screenshots.sh" "$@"'';
      description = "ストア掲載用スクショを simulator/emulator で撮影→検証（--upload で送信）";
    };
    screenshots-storybook = {
      exec = ''exec node "$DEVENV_ROOT/scripts/mobile/screenshots-storybook.mjs" "$@"'';
      description = "Storybook からストア用スクショを撮影（要 -P store-listing）";
    };
    screenshots-validate = {
      exec = ''exec node "$DEVENV_ROOT/scripts/mobile/validate-screenshots.mjs" "$@"'';
      description = "既存スクショがストア要求（サイズ/縦横比/枚数）を満たすか検証";
    };
    build-play-feature-graphic = {
      exec = ''exec node "$DEVENV_ROOT/scripts/mobile/build-play-feature-graphic.mjs" "$@"'';
      description = "Play のフィーチャーグラフィック(1024x500)を生成（要 -P store-listing）";
    };

    # ---------- ストアへの反映（ASC / Play の API を直接叩く）----------
    # すべて `--dry-run` を受け付ける。**本番の掲載情報・課金商品を書き換えるので、
    # 必ず先に --dry-run で差分を確認すること**（`.claude/rules/store-review.md`）。
    store-push-ios-screenshots = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" push-ios-screenshots "$@"'';
      description = "store-listing/ios のスクショを App Store Connect へ反映";
    };
    store-push-play-listing = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" push-play-listing "$@"'';
      description = "play.config.js の文言 + アイコン + スクショを Google Play へ反映";
    };
    store-create-ios-subscriptions = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" create-ios-subscriptions "$@"'';
      description = "iap.config.js のサブスク商品を App Store Connect に作成";
    };
    store-equalize-ios-prices = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" equalize-ios-prices "$@"'';
      description = "App Store の販売地域すべてへ等価価格を展開（商品作成後に必須）";
    };
    store-create-play-subscriptions = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" create-play-subscriptions "$@"'';
      description = "iap.config.js のサブスク商品を Google Play に作成";
    };
    store-create-play-offers = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" create-play-offers "$@"'';
      description = "Play の無料トライアル（offer）を作成して有効化";
    };

    # ---------- アップロード後のリリース進行 ----------
    # `mobile-release-*` は**アップロードまで**しかやらない。TestFlight への配布・
    # 審査提出・Play のロールアウトはここから先。迷ったら書き込まない
    # `store-status` / `store-preflight` を先に実行する。
    store-preflight = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" preflight "$@"'';
      description = "人が入力するしかない申告を値つきで一覧（資格情報も通信も不要。--json 可）";
    };
    store-status = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" status "$@"'';
      description = "両ストアの状態と次にすべきことを表示（書き込まない。--json 可）";
    };
    store-push-data-safety = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" push-data-safety "$@"'';
      description = "Play の Data safety を CSV から反映（公式 API。edits に乗らず即時反映）";
    };
    store-testflight = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" testflight "$@"'';
      description = "TestFlight へ配布（--wait で処理完了待ち / --groups で配布先指定）";
    };
    store-submit-ios = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" submit-ios "$@"'';
      description = "App Store の審査へ提出（--status / --cancel / --phased）";
    };
    store-release-play = {
      exec = ''exec bash "$DEVENV_ROOT/scripts/mobile/store.sh" release-play "$@"'';
      description = "Play のトラック公開・段階的公開（--track / --rollout / --halt）";
    };

    # ---------- Agent skills ----------
    # エージェントスキル（.agents/skills, .claude/skills へ symlink）を最新に更新する。
    # enterShell でも 1 日 1 回（同期・ロック付き）自動実行されるが、手動で即時更新したいとき用。
    skills-update.exec = ''
      set -euo pipefail
      cd "$DEVENV_ROOT"
      echo "→ updating agent skills to latest (skills update -p)"
      pnpm dlx skills update -p -y
      mkdir -p "$DEVENV_ROOT/.devenv"
      date +%s > "$DEVENV_ROOT/.devenv/skills-last-update"
      echo "✓ skills updated"
    '';
    # skills-lock.json から決定論的に復元（最新化せず固定したいとき）。
    skills-restore.exec = ''cd "$DEVENV_ROOT" && pnpm dlx skills experimental_install'';

    # ---------- Build ----------
    build-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run build'';

    # ---------- Aggregate ----------
    lint.exec = ''lint-frontend && lint-fsd && lint-backend-py'';
    format.exec = ''format-frontend && format-backend-py'';
    format-check.exec = ''format-frontend-check && format-backend-py-check'';
    type-check.exec = ''type-check-frontend && type-check-backend-py'';
    unit-test.exec = ''test-frontend && test-backend-py'';

    # CI と同一の検査（**auto-fix しない**）。列挙の正本は `scripts/ci/check.sh` 1 か所で、
    # GitHub Actions もこの script を直接呼ぶ。ここに検査を足すと CI にも自動で入る
    # （逆に CI 側だけに足すとローカルで再現できなくなるので、必ず script 側へ書く）。
    ci-check.exec = ''exec bash "$DEVENV_ROOT/scripts/ci/check.sh" "$@"'';
  };

  # ===== desktop: Tauri v2（apps/desktop）のネイティブビルド toolchain =====
  #
  # **opt-in profile にしている理由**: Linux で Tauri をビルドするには WebKitGTK と
  # GTK3 の開発ヘッダが要り、closure が数 GB になる。web / mobile しか触らない開発者と
  # CI に負わせる理由が無いので、デスクトップを触るときだけ有効化する。
  #
  #   devenv shell -P desktop -- dev-desktop     # tauri dev
  #   devenv shell -P desktop -- build-desktop   # tauri build
  #
  # **macOS / Windows ではこの profile は不要**（Xcode Command Line Tools / MSVC +
  # WebView2 という OS 側の前提だけで足りる）。ここで入れているのは
  # **Linux の WebKitGTK 依存**であり、Tauri 公式の Linux 前提条件に対応する。
  # @see https://v2.tauri.app/start/prerequisites/
  #
  # ⚠️ これらが無いと `cargo check` の時点で
  #    「HINT: you may need to install a package such as glib-2.0」等で落ちる
  #    （Rust さえあればビルドできる、ではない）。
  profiles.desktop.module = { pkgs, ... }: {
    packages = with pkgs; [
      # Tauri 本体（wry / tao）がリンクする WebView とウィンドウ系。
      # webkitgtk は **abi=4.1 の派生**を使う（4.0 は EOL で Tauri 2 が要求しない）。
      webkitgtk_4_1
      gtk3
      libsoup_3
      glib-networking

      # ⚠️ gtk3 / webkitgtk からの伝播に頼らず **明示的に並べる**。
      # `cargo check` は `glib-2.0.pc` `cairo.pc` 等を pkg-config で直接引くため、
      # 伝播が効かない構成に変わった瞬間に
      #   「HINT: you may need to install a package such as glib-2.0」
      # で落ちる。
      glib
      cairo
      pango
      gdk-pixbuf
      atk

      # ビルド時に pkg-config でヘッダを探すため必須
      pkg-config

      # Tauri 公式の Linux 前提（https://v2.tauri.app/start/prerequisites/）:
      #   libayatana-appindicator3 … システムトレイ
      #   libxdo(xdotool)          … ウィンドウ操作
      libayatana-appindicator
      xdotool

      # AppImage / deb / rpm のバンドルに使う
      openssl
      librsvg
      patchelf
    ];

    languages.rust.enable = true;
  };

  # ===== Profiles（opt-in の重い toolchain）=====
  # ストアへの**反映**には何も要らない（`store.sh` の各コマンドは Node と fetch だけで動く）。
  # この profile が要るのは**画像を作る側**の 2 つだけ:
  #   - chromium    : Storybook から撮る経路（screenshots-storybook）が使うブラウザ。
  #                   playwright-core はブラウザを自動 DL しないので実行体をここで供給する。
  #   - imagemagick : Play のアイコン縮小（512x512）とフィーチャーグラフィックの生成。
  #
  #   devenv shell -P store-listing -- screenshots-storybook
  #   devenv shell -P store-listing -- build-play-feature-graphic
  profiles.store-listing.module = {
    packages = [ pkgs.chromium pkgs.imagemagick ];
  };

  # ===== Processes（`devenv up` で起動）=====
  # FastAPI をローカルで uvicorn 起動（Lambda 本番は Amplify custom function）。
  processes.backend.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run --package api api'';

  enterShell = ''
    echo "amplify-boilerplate — devenv ready"
    echo "  bootstrap            deps (pnpm + uv)"
    echo "  sandbox              Amplify backend (ampx sandbox)"
    echo "  dev-web / dev-mobile dev servers（desktop は -P desktop -- dev-desktop）"
    echo "  lint / format / type-check / unit-test"
    echo "  ci-check             CI と同一の検査（auto-fix しない）"
    echo "  mcp-sync             regenerate .cursor/mcp.json / .codex/config.toml"
    echo "  e2e / e2e-mobile / e2e-web   Maestro E2E"
    echo "  store-preflight / store-status   ストア提出前の確認（書き込まない）"
    echo "  mobile-release-ios / -android    EAS ビルド → ストアへアップロード"
    echo "  skills-update        refresh agent skills to latest"

    # --- エージェントスキルの自動更新（同期・ロック・スロットル付き） ---
    # 半端な更新中の状態で Claude Code 等を起動しないことを保証するため、更新は
    # *同期*で行い（シェルは完了まで待つ）、ロックで多重実行・他シェルの割り込みを防ぐ。
    #   - 24h に 1 回だけ実行（マーカー: .devenv/skills-last-update）
    #   - 実行中はロック（.devenv/skills-update.lock）。別シェル/起動は完了まで待機 →
    #     torn read（書きかけスキルの読み取り）が起きない
    #   - オフライン/失敗でも最終的にはシェルへ抜ける（マーカーは前進させ毎回の再試行を防止）
    # 無効化: SKILLS_AUTOUPDATE=0 / 間隔変更: SKILLS_AUTOUPDATE_INTERVAL=<秒>
    if [ "''${SKILLS_AUTOUPDATE:-1}" != "0" ] && command -v pnpm >/dev/null 2>&1; then
      mkdir -p "$DEVENV_ROOT/.devenv"
      _skills_marker="$DEVENV_ROOT/.devenv/skills-last-update"
      _skills_lock="$DEVENV_ROOT/.devenv/skills-update.lock"
      _skills_interval="''${SKILLS_AUTOUPDATE_INTERVAL:-86400}"

      # クラッシュで取り残されたロックを掃除（>10分は stale とみなす）
      if [ -d "$_skills_lock" ]; then
        _lock_ts=$(cat "$_skills_lock/ts" 2>/dev/null || echo 0)
        if [ "$(( $(date +%s) - _lock_ts ))" -ge 600 ]; then rm -rf "$_skills_lock"; fi
      fi

      # 他シェルが更新中なら、その完了を待ってから入室（半端状態で起動しない）
      _skills_waited=0
      while [ -d "$_skills_lock" ] && [ "$_skills_waited" -lt 180 ]; do
        [ "$_skills_waited" = 0 ] && echo "  (skills) update in progress — waiting for completion…"
        sleep 2; _skills_waited=$(( _skills_waited + 2 ))
      done

      _skills_last=0
      [ -f "$_skills_marker" ] && _skills_last=$(cat "$_skills_marker" 2>/dev/null || echo 0)
      if [ "$(( $(date +%s) - _skills_last ))" -ge "$_skills_interval" ]; then
        # ロック取得は mkdir で atomic に。取れなければ他が走っている → スキップ
        if mkdir "$_skills_lock" 2>/dev/null; then
          date +%s > "$_skills_lock/ts"
          echo "  (skills) updating agent skills to latest… (synchronous, up to ~90s; SKILLS_AUTOUPDATE=0 to disable)"
          ( cd "$DEVENV_ROOT" && pnpm dlx skills update -p -y ) \
            > "$DEVENV_ROOT/.devenv/skills-update.log" 2>&1 \
            && echo "  (skills) up to date" \
            || echo "  (skills) some skills could not be updated — see .devenv/skills-update.log"
          # 毎回の再試行（~90s ブロック）を避けるため、結果に依らずマーカーを前進
          date +%s > "$_skills_marker"
          rm -rf "$_skills_lock"
        fi
      fi
    fi
  '';
}
