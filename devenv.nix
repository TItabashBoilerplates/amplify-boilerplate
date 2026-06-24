{ pkgs, config, lib, ... }:

let
  # 環境ごとの **非機密** env ファイル読み込み（ENV 駆動）。Doppler（loadDopplerByEnv）と同じく
  # 環境変数 ENV を見て読み込む対象を切り替える。env/ の構成は env/README.md を参照。
  #
  # ここで読むのは非機密 config（URL/port 等）の env/<svc>/.env.$ENV のみ。
  # **シークレットは Doppler が唯一のソース**（loadDopplerByEnv）。`.env.secrets` のファイル
  # フォールバックは廃止した（ユーザー方針）。bash パーサがクォート・エスケープを正しく処理する。
  # `[ -f X ] && . X` で gard しているので env ファイル未配置でもエラーにならない。
  loadEnvFilesForEnv = ''
    set -a
    for _svc in backend frontend migration; do
      _f="$DEVENV_ROOT/env/$_svc/.env.''${ENV:-local}"
      [ -f "$_f" ] && . "$_f"
    done
    unset _svc _f
    set +a
  '';

  # Doppler からのシークレット読み込み（Doppler-first・ファイルフォールバック付き・ENV 駆動）。
  #
  # 方針: **シークレットだけ Doppler、非機密 config はファイル**。
  #   - シークレット（API キー等）→ **Doppler が唯一のソース**。ファイルフォールバックは廃止。
  #   - 非機密の環境変数（ローカル Supabase URL / backend URL / port 等。
  #     env/{backend,frontend,migration}/.env.$ENV）→ 引き続きファイルで管理（loadEnvFilesForEnv）。
  #
  # **どの Doppler config を参照するかは環境変数 ENV で切り替える**。本リポジトリの deploy
  # スクリプト（scripts/supabase/*.sh）も `ENV="${ENV:-}"` で local/staging/production を
  # 切り替えており、その ENV 規約にそのまま合わせる:
  #   ENV=local（または未設定） → --config を付けず `doppler setup` のローカル紐付け config
  #                               （公式推奨は dev_personal）を使う。
  #   ENV=dev                   → --config dev
  #   ENV=staging               → --config stg
  #   ENV=production            → --config prd
  #   それ以外                  → --config "$ENV"（そのまま config 名として扱う）
  #
  # 動作: doppler が認証・setup 済みなら secrets を取得して env に注入する。
  # **取得できない場合（未ログイン / 未 setup / token 無し）はフォールバックが無いので、
  # シークレット未ロードを明示警告する**（.claude/rules/error-handling.md: 唯一のソースが
  # 失敗したらサイレントにしない）。shell 自体は止めない（doppler login を打てるように）。
  # `--format env` は KEY="value" 形式なので bash パーサがクォート・エスケープを正しく扱う。
  loadDopplerByEnv = ''
    if command -v doppler >/dev/null 2>&1; then
      _dpl_args=""
      _dpl_label="local scope (doppler setup)"
      case "''${ENV:-local}" in
        local|"") ;;
        dev|development)     _dpl_args="--config dev"; _dpl_label="config: dev (ENV=$ENV)" ;;
        stg|staging)         _dpl_args="--config stg"; _dpl_label="config: stg (ENV=$ENV)" ;;
        prd|prod|production) _dpl_args="--config prd"; _dpl_label="config: prd (ENV=$ENV)" ;;
        *)                   _dpl_args="--config ''${ENV}"; _dpl_label="config: ''${ENV} (ENV=$ENV)" ;;
      esac
      if _doppler_env="$(cd "$DEVENV_ROOT" && doppler secrets download --no-file --format env $_dpl_args 2>/dev/null)"; then
        set -a
        eval "$_doppler_env"
        set +a
        unset _doppler_env
        echo "🔐 Doppler secrets loaded ($_dpl_label)"
      else
        echo "⚠️  シークレット未ロード: Doppler から取得できません（$_dpl_label）。" >&2
        echo "    フォールバックは廃止済み。'doppler login' → 'doppler setup'（CI は DOPPLER_TOKEN）を実行してください。" >&2
        echo "    詳細: .claude/skills/doppler/SKILL.md" >&2
      fi
      unset _dpl_args _dpl_label
    else
      echo "⚠️  doppler CLI が見つかりません（devenv shell 内で実行していますか）。" >&2
    fi
  '';

  # backend (api) service の exec body。
  # local profile の `processes.backend` と base の `containers.backend` の両方から
  # 参照したいので let-binding で一度だけ定義する。
  #
  # backend-py は uv workspace 化済み (apps/api, apps/mcp, packages/core)。
  # ワークスペースルートで `uv sync --all-packages` すれば api と core が editable install
  # されるため、`api.app:app` は PYTHONPATH 操作なしで解決できる。
  #
  # 末尾を `exec "$UV_PROJECT_ENVIRONMENT/bin/uvicorn"` にすることで
  # bash → uvicorn を直接置換し、uvicorn 自体を session leader にする
  # （PR #2620 が要求する終了シグナル伝播パス）。
  # `uv run` を間に挟むと、`uv run` が wrapper として親プロセスに残り続け、
  # devenv が SIGTERM を打っても子の python uvicorn まで伝搬せず orphan 化する
  # （issue #2619 系の症状。実機で `Address already in use` の起動失敗を確認済み）。
  # `uv sync` は idempotent なワンショットなので exec の前に普通に実行する。
  backendExec = ''
    set -euo pipefail
    cd "$DEVENV_ROOT/backend-py"
    uv sync --all-packages --group dev
    exec "$UV_PROJECT_ENVIRONMENT/bin/uvicorn" api.app:app \
      --proxy-headers --reload \
      --host 0.0.0.0 --port 4040
  '';

  # MCP server skeleton の exec body。`apps/mcp/` は雛形のみで実装はまだない。
  # `processes.backend-mcp` は `start.enable = false` (opt-in)。
  # 実装後は `uv run --package mcp-server mcp-server` 等に差し替え、ready probe を設定する。
  backendMcpExec = ''
    set -euo pipefail
    cd "$DEVENV_ROOT/backend-py"
    uv sync --all-packages --group dev
    exec uv run --package mcp-server python -c \
      'print("mcp-server placeholder; implement apps/mcp/src/mcp_server/main.py")'
  '';

  # ===== Frontend monorepo apps =====
  #
  # `frontend/apps/<name>` 配下のアプリを 1 行で宣言する。各エントリから:
  #   - `processes.<name>`         (start.enable=false で opt-in 起動)
  #   - `scripts.dev-<name>`       (backend + storybook + <name> を起動するプリセット)
  #   - `scripts.dev-all`          (全アプリ含む起動プリセット、自動更新)
  # が自動生成される。
  #
  # 新規アプリ追加手順:
  #   1. `frontend/apps/<name>/` を作成（package.json に `dev` または `start` script を定義）
  #   2. この attrset に 1 行追加（`port` 必須、その他は任意）
  #
  # 各エントリのオプション:
  #   - port  : ready probe で叩くポート（必須）
  #   - ready : ready probe path（既定 "/"）
  #   - exec  : exec body 全体を上書き（既定は `cd frontend/apps/<name> && exec nr dev`）
  frontendApps = {
    web   = { port = 3000; };
    mobile = {
      port = 8081;
      ready = "/status";
      exec = ''
        cd "$DEVENV_ROOT/frontend/apps/mobile"
        exec nr start
      '';
    };
  };

  # 各アプリ定義から process spec を生成。
  mkAppProcess = name: cfg: {
    exec = cfg.exec or ''
      cd "$DEVENV_ROOT/frontend/apps/${name}"
      exec nr dev
    '';
    start.enable = false;
    ready.http.get = {
      host = "127.0.0.1";
      port = cfg.port;
      path = cfg.ready or "/";
    };
  };

  # 各アプリ定義から `dev-<name>` script spec を生成。
  #
  # 設計: dev サーバー本体は **foreground で直接 exec** する（`nr dev` / `nr start` 等）。
  # backend + storybook だけ devenv supervisor で detached 起動し、Next.js / Expo Metro の
  # ような「開発者が一番見たいプロセス」は素のまま foreground に置いて
  # 標準の dev server UX（カラフルなログ・hot reload・キーバインド）をそのまま活かす。
  #
  # frontendApps の各エントリの `exec` を process spec と dev script の両方で再利用するため、
  # mobile の `exec nr start` のような上書きも自動で反映される。
  #
  # 終了時の Supabase / detached プロセスの停止は手動運用（`supabase-stop` / `stop` script）。
  mkDevScript = name: cfg:
    let
      appExec = cfg.exec or ''
        cd "$DEVENV_ROOT/frontend/apps/${name}"
        exec nr dev
      '';
    in {
      exec = ''
        set -e
        echo "🚀 Ensuring backend + storybook are running (detached)..."
        devenv up -d backend storybook 2>/dev/null || true
        echo "▶️  Starting ${name} dev server (foreground)..."
        ${appExec}
      '';
      description = "Backend + storybook (detached) + ${name} dev server (foreground)";
    };

  # 全アプリを並列起動する `dev-all` は複数 dev server を 1 ターミナルで束ねる必要があるので
  # devenv の supervisor を使い続ける。`start.enable = false` を CLI 引数だけでは上書きできない
  # devenv 2.0 native の仕様回避として `--option` を併用する。
  # 詳細: docs/_research/2026-04-28-devenv-process-start-enable.md
  devAllExec =
    let
      appNames = lib.attrNames frontendApps;
      overrides = lib.concatMapStringsSep " " (n:
        ''--option "processes.${n}.start.enable:bool" true''
      ) appNames;
    in ''
      exec devenv ${overrides} up backend storybook ${lib.concatStringsSep " " appNames}
    '';
in
{
  # devenv 標準の dotenv 統合 (`dotenv.enable`) は使わない:
  #   - `dotenv.filename` は `.env` プレフィックス必須で `env/backend/.env.local` のような
  #     階層パスを受け付けない（src/modules/integrations/dotenv.nix の assertion）
  #   - 内蔵パーサがクォート (`KEY="value"`) を文字通り保持してしまう
  # 代わりに「環境ごとに profile を切る + profile の enterShell で bash の
  # `set -a; source` する」という devenv 標準のプロファイル機構を使う。
  dotenv.disableHint = true;

  packages = [
    # backend-py のシステム依存（C 拡張・音声ビデオライブラリ）
    pkgs.gcc
    pkgs.gnumake
    pkgs.libedit
    pkgs.libopus
    pkgs.libvpx
  ] ++ lib.optionals (!config.container.isBuilding) [
    # 開発専用ツール（コンテナビルド時は除外）
    pkgs.supabase-cli
    pkgs.ni
    pkgs.maestro
    # Doppler CLI（シークレット管理）。secrets の単一ソース化に向けた下準備。
    # 使い方・移行方針は .claude/skills/doppler/SKILL.md を参照。
    pkgs.doppler
  ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    bun.enable = true;
  };

  languages.typescript.enable = true;

  languages.python = {
    enable = true;
    package = pkgs.python313;
    uv.enable = true;
  };

  languages.deno.enable = true;

  # ===== Processes（`devenv up` で起動するサービス）=====
  #
  # devenv 2.0 native process manager。process-compose は使わない（native がデフォルト）。
  #
  # local 環境がデフォルト。`devenv up`（profile 指定なし）で base enterShell が
  # ENV=local として loadEnvFilesForEnv を実行し、`start.enable = true` のプロセスが立ち上がる。
  # `supabase:start` task は backend process の `before` に登録されているので、
  # `devenv up` 一発で Supabase → backend の順に起動する。
  #
  # 起動制御:
  #   - `start.enable = true` (default): `devenv up` で自動起動 (= backend / storybook)
  #   - `start.enable = false`         : opt-in（= frontendApps の各エントリ）
  #     devenv 2.0 native process manager は `devenv up <name>` の引数で渡しても
  #     `start.enable = false` のプロセスは起動しない（NotStarted で登録するのみ）。
  #     - `dev-<name>` script: process としては起動せず、detached の backend + storybook
  #       だけ devenv に管理させて、dev server 本体は素の `nr dev` を foreground exec する。
  #     - `dev-all` / 直接 `devenv up <name>`: `--option processes.<name>.start.enable:bool true`
  #       で上書きする（mkDevScript / devAllExec を参照）。
  #
  # frontendApps から process 群が自動生成される（let-binding 参照）。
  # 新規アプリは `frontendApps` に 1 行追加するだけで `processes`/`scripts.dev-<name>`/
  # `scripts.dev-all` がすべて連動する。
  #
  # NOTE: Supabase (Docker コンテナ群) は devenv 管理対象外。
  # Supabase CLI で独立管理する。`supabase:start` task で起動する。
  processes = {
    # ----- 既定起動（軽量・常時必要）-----

    # FastAPI バックエンド。env は base enterShell で source 済みのものを継承する。
    backend = {
      exec = backendExec;
      ready.http.get = {
        host = "127.0.0.1";
        port = 4040;
        path = "/healthcheck";
      };
    };

    # Storybook コンポーネントカタログ（DB 非依存・env 不要）。
    storybook = {
      exec = ''
        cd "$DEVENV_ROOT/frontend"
        exec bun run storybook -- --host 0.0.0.0 --port 6006 --quiet --ci
      '';
      ready.http.get = {
        host = "127.0.0.1";
        port = 6006;
        path = "/";
      };
    };

    # ----- Opt-in: backend-py モノレポの追加サーバ -----

    # MCP server (skeleton)。実装後 `start.enable = true` に切り替え + ready probe 追加。
    backend-mcp = {
      exec = backendMcpExec;
      start.enable = false;
    };
  } // lib.mapAttrs mkAppProcess frontendApps;
  # ↑ frontendApps から opt-in process 群を自動生成（start.enable = false）。

  # ===== Profiles（環境切替）=====
  #
  # local が **default**（base enterShell で読み込み済み）なので `-P local` は不要。
  # 各 profile は base の上に env を **上書き** する形でロードする
  # （bash の `set -a; source` は後勝ちなので、後にロードした値が勝つ）。
  #
  # アクティベーション例:
  #   devenv up                                    # local 環境で backend + storybook 起動
  #   devenv shell                                 # local env で shell に入る
  #   devenv up -P dev                             # dev 環境で起動
  #   devenv shell -P staging -- supabase status   # staging env で確認
  #   devenv tasks run -P production deploy:functions
  #
  # `loadEnvFilesForEnv` は `[ -f X ] && . X` で gard されているので env ファイル未配置でも
  # エラーにならない。env ファイルを `env/{backend,frontend,migration}/.env.<ENV>` に
  # 配置すれば即 `-P <profile>`（= 該当 ENV）で読み込まれる。env/ の構成は env/README.md。
  #
  # 新環境を追加したい場合:
  #   1. env/{backend,frontend,migration}/.env.<name> を作成（任意・後置きでも OK）
  #   2. このブロックに profile を 1 つ追加（`export ENV="<name>"` + 各ローダ）
  #
  # 各 profile は `export ENV=<name>` してから loadEnvFilesForEnv（ENV 別の非機密 config）→
  # loadDopplerByEnv（ENV 別の Doppler シークレット）を呼ぶ。profile の enterShell は base
  # enterShell の後に走るので、ここで設定した ENV・config・Doppler が後勝ちで最終値になる。
  profiles = {
    # dev 環境（共有開発インスタンス・チーム用ステージなど）。
    dev.module.enterShell = ''
      export ENV="dev"
    '' + loadEnvFilesForEnv + loadDopplerByEnv;

    # staging 環境（マイグレーション・デプロイ等のリモート操作用）。
    staging.module.enterShell = ''
      export ENV="staging"
    '' + loadEnvFilesForEnv + loadDopplerByEnv;

    # production 環境（マイグレーション・デプロイ等のリモート操作用）。
    production.module.enterShell = ''
      export ENV="production"
    '' + loadEnvFilesForEnv + loadDopplerByEnv;
  };

  # ===== Tasks（多段 pipeline・依存関係あり）=====
  #
  # 実行: `devenv tasks run <name>` または namespace prefix で一括実行（`devenv tasks run db`）。
  # 依存解決: `before` / `after` で順序制御。
  tasks = {
    # ---------- Setup（enterShell 前の自動セットアップ）----------
    # `before = [ "devenv:enterShell" ]` で devenv shell / direnv reload / devenv up 開始時に自動実行。
    # `status` または `execIfModified` で「変更がない時はスキップ」する idempotent 設計。
    # `--frozen-lockfile` / `--frozen` を使うことで lockfile の意図しない書き換えを防止
    # （issue #2497 の fork bomb 回避）。

    # Doppler 初期セットアップ（init）。supabase:start 等と同様にブートストラップに組み込む。
    # `doppler setup` は doppler.yaml に基づきローカルを project/config に紐付ける（idempotent）。
    # `doppler login`（ブラウザ認証）は対話操作なので自動化しない → 未ログイン時はこの task は
    # 静かに no-op し、enterShell の loadDopplerByEnv が「⚠️ シークレット未ロード」で login を促す。
    # 旧 setup:secrets（.env.secrets 雛形コピー）は廃止済み（シークレットは Doppler 管理）。
    "setup:doppler" = {
      exec = ''
        command -v doppler >/dev/null 2>&1 || exit 0
        # login 済みなら doppler.yaml の紐付けを適用（未 login / placeholder project なら静かに諦める）
        doppler setup --no-interactive --silent >/dev/null 2>&1 || true
        exit 0
      '';
      before = [ "devenv:enterShell" ];
    };

    # frontend deps 同期（lockfile 変更検知時のみ実行）。
    "setup:install-frontend" = {
      exec = ''
        cd "$DEVENV_ROOT/frontend"
        echo "📦 Installing frontend dependencies..."
        bun install --frozen-lockfile || {
          echo ""
          echo "⚠️  bun install failed (lockfile may be out of sync)."
          echo "   Run 'cd frontend && bun install' manually to update bun.lock."
          exit 1
        }
      '';
      execIfModified = [
        "frontend/bun.lock"
        "frontend/package.json"
      ];
      before = [ "devenv:enterShell" ];
    };

    # drizzle deps 同期。
    "setup:install-drizzle" = {
      exec = ''
        cd "$DEVENV_ROOT/drizzle"
        echo "📦 Installing drizzle dependencies..."
        bun install --frozen-lockfile || {
          echo ""
          echo "⚠️  bun install failed (lockfile may be out of sync)."
          echo "   Run 'cd drizzle && bun install' manually to update bun.lock."
          exit 1
        }
      '';
      execIfModified = [
        "drizzle/bun.lock"
        "drizzle/package.json"
      ];
      before = [ "devenv:enterShell" ];
    };

    # backend-py workspace deps 同期。
    # uv workspace 化したので `--all-packages` で apps/api, apps/mcp, packages/core の
    # editable install をまとめて行う。`--all-groups` で root の dev group も入る。
    "setup:install-backend" = {
      exec = ''
        cd "$DEVENV_ROOT/backend-py"
        echo "📦 Installing backend-py workspace dependencies..."
        uv sync --all-packages --all-groups --frozen || {
          echo ""
          echo "⚠️  uv sync failed (lockfile may be out of sync)."
          echo "   Run 'cd backend-py && uv lock && uv sync --all-packages --all-groups' manually."
          exit 1
        }
      '';
      execIfModified = [
        "backend-py/uv.lock"
        "backend-py/pyproject.toml"
        "backend-py/apps/api/pyproject.toml"
        "backend-py/apps/mcp/pyproject.toml"
        "backend-py/packages/core/pyproject.toml"
      ];
      before = [ "devenv:enterShell" ];
    };

    # ---------- Supabase ----------
    "supabase:start" = {
      exec = ''
        echo "🚀 Starting Supabase (Docker)..."
        supabase start --yes
        supabase seed buckets --local --yes || true
      '';
      # backend process が起動する前に Supabase が ready であることを保証する。
      before = [ "devenv:processes:backend" ];
    };

    "supabase:stop".exec = ''
      echo "🛑 Stopping Supabase (Docker)..."
      supabase stop || true
    '';

    # ---------- DB Migration（Drizzle）----------
    # local 環境のスキーマ生成 + 適用。
    # 型生成（model:build）は別タスク。フルフローは `app:migrate-dev` を使う。
    "db:migrate-dev" = {
      exec = ''
        set -euo pipefail
        cd "$DEVENV_ROOT/drizzle"
        echo "🔧 Pre-migration SQL (extensions)..."
        nr migrate:pre
        echo "📝 Generating migration..."
        nr generate
        echo "✅ Applying migration to local DB..."
        nr migrate
        echo "🔧 Post-migration SQL (functions, triggers)..."
        nr migrate:post
        echo "✨ Don't forget to commit migration files."
      '';
      after = [ "supabase:start" ];
    };

    # 全環境共通: 既存マイグレーションの適用のみ
    "db:migrate-deploy".exec = ''
      set -euo pipefail
      cd "$DEVENV_ROOT/drizzle"
      echo "🚀 Deploying migrations..."
      nr migrate:pre
      nr migrate
      nr migrate:post
    '';

    # local 環境のフルフロー: migration → 型生成。
    # `migrate-dev` という慣用名なのでこちらが「ユーザーが普段叩くやつ」。
    # 型生成・コピーは model:build に委譲し DRY を担保 (重複定義しない)。
    "app:migrate-dev" = {
      exec = ''
        set -euo pipefail
        echo "🚀 Full migrate-dev pipeline..."
        cd "$DEVENV_ROOT/drizzle"
        nr migrate:pre
        nr generate
        nr migrate
        nr migrate:post
        cd "$DEVENV_ROOT"
        echo "🔧 Generating types from migrated schema..."
        devenv tasks run model:build
        echo "✨ Migration + type generation done!"
      '';
      after = [ "supabase:start" ];
    };

    # ---------- Type/Model 生成 ----------
    # 注: コピー先 (frontend/packages/db-schema/src/schema, supabase/functions/shared/drizzle)
    # は auto-generated。コピー前に rm -rf でゴーストファイル (削除されたテーブル等) を一掃する。
    "model:frontend" = {
      exec = ''
        set -euo pipefail
        mkdir -p "$DEVENV_ROOT/frontend/packages/types"
        supabase gen types typescript --local > "$DEVENV_ROOT/frontend/packages/types/schema.ts"
        echo "🔧 Copying Drizzle schema to @workspace/db-schema..."
        rm -rf "$DEVENV_ROOT/frontend/packages/db-schema/src/schema"
        mkdir -p "$DEVENV_ROOT/frontend/packages/db-schema/src/schema"
        cp -r "$DEVENV_ROOT/drizzle/schema/"* "$DEVENV_ROOT/frontend/packages/db-schema/src/schema/"
        echo "🔧 Generating backend API client (Hey API)..."
        cd "$DEVENV_ROOT/frontend"
        bun run --filter @workspace/api-client generate \
          || echo "⚠️  Backend API client generation skipped (backend not running)"
      '';
      after = [ "supabase:start" ];
    };

    "model:functions" = {
      exec = ''
        set -euo pipefail
        mkdir -p "$DEVENV_ROOT/supabase/functions/shared/types/supabase"
        supabase gen types typescript --local \
          > "$DEVENV_ROOT/supabase/functions/shared/types/supabase/schema.ts"
        rm -rf "$DEVENV_ROOT/supabase/functions/shared/drizzle"
        mkdir -p "$DEVENV_ROOT/supabase/functions/shared/drizzle"
        cp -r "$DEVENV_ROOT/drizzle/schema/"* "$DEVENV_ROOT/supabase/functions/shared/drizzle/"
        echo "✅ Drizzle schema copied to supabase/functions/shared/drizzle/"
      '';
      after = [ "supabase:start" ];
    };

    "model:build".after = [ "model:frontend" "model:functions" ];

    # ---------- Seed ----------
    # local seed は Supabase が起動済みであることが前提なので supabase:start に依存させる。
    # remote seed (`--linked`) では Docker ローカルではなくリモート DB に対して実行されるが、
    # その場合でも Supabase CLI のリンク済み project に接続するだけで supabase:start は no-op
    # （Docker コンテナは local 環境用なので、ENV=remote 時は touched しない）。
    "seed:db" = {
      exec = ''
        cd "$DEVENV_ROOT/drizzle"
        bun run seed/index.ts
      '';
      after = [ "supabase:start" ];
    };

    "seed:storage" = {
      exec = ''
        cd "$DEVENV_ROOT"
        if [ "$ENV" = "local" ] || [ -z "''${ENV:-}" ]; then
          supabase seed buckets --local
        else
          supabase seed buckets --linked
        fi
      '';
      after = [ "supabase:start" ];
    };

    "seed:all".after = [ "seed:db" "seed:storage" ];

    # ---------- Deploy ----------
    "deploy:functions".exec = ''
      set -euo pipefail
      if [ "''${ENV:-local}" = "local" ]; then
        echo "Skipping deploy:functions for local environment"
        exit 0
      fi
      for fn in watermark stripe-checkout stripe-products stripe-webhooks; do
        supabase functions deploy "$fn" --no-verify-jwt --project-ref "$SUPABASE_PROJECT_REF"
      done
    '';

    "deploy:supabase".exec = ''./scripts/supabase/deploy.sh'';

    # ---------- Quality CI gate（execIfModified キャッシュ + namespace 並列）----------
    # 設計方針 (詳細は docs/_research/2026-04-28-devenv-quality-checks.md):
    #   - **コミット時の差分チェック**は git-hooks (pre-commit) が担当（変更ファイルだけ）
    #   - **CI / 手動 verify** は ここの tasks が担当（execIfModified で incremental skip）
    #   - `ci:check` は `before = [ "devenv:enterTest" ]` で `devenv test` に紐付け
    #     → ローカルも CI も `devenv test` 一発で全 verify
    #   - auto-fix 系 (lint, format) は scripts のまま (副作用ループ回避)
    #
    # status と execIfModified は同時指定不可 (devenv モジュールアサーション)。
    # auto-fix 系には execIfModified を付けない (issue #2497 fork bomb 回避)。

    # ----- Lint (CI mode = no auto-fix) -----
    "lint-ci:frontend" = {
      exec = ''cd "$DEVENV_ROOT/frontend" && nr lint:ci'';
      execIfModified = [
        "frontend/**/*.ts"
        "frontend/**/*.tsx"
        "frontend/**/*.js"
        "frontend/**/*.jsx"
        "frontend/**/*.json"
        "frontend/biome.json"
      ];
    };
    "lint-ci:drizzle" = {
      exec = ''cd "$DEVENV_ROOT/drizzle" && nr lint:ci'';
      execIfModified = [
        "drizzle/**/*.ts"
        "drizzle/biome.json"
      ];
    };
    "lint-ci:backend-py" = {
      exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff check apps packages'';
      execIfModified = [
        "backend-py/apps/*/src/**/*.py"
        "backend-py/packages/*/src/**/*.py"
        "backend-py/pyproject.toml"
        "backend-py/apps/*/pyproject.toml"
        "backend-py/packages/*/pyproject.toml"
      ];
    };
    "lint-ci:functions" = {
      exec = ''deno lint "$DEVENV_ROOT/supabase/functions/"'';
      execIfModified = [
        "supabase/functions/**/*.ts"
        "supabase/functions/**/deno.json"
      ];
    };
    "lint-ci:fsd" = {
      exec = ''
        cd "$DEVENV_ROOT/frontend/apps/web" && nr lint:fsd
        cd "$DEVENV_ROOT/frontend/apps/mobile" && nr lint:fsd
      '';
      execIfModified = [
        "frontend/apps/web/**/*.ts"
        "frontend/apps/web/**/*.tsx"
        "frontend/apps/mobile/**/*.ts"
        "frontend/apps/mobile/**/*.tsx"
        "frontend/apps/web/steiger.config.*"
        "frontend/apps/mobile/steiger.config.*"
      ];
    };

    # ----- Format check (no auto-fix) -----
    "format-check:frontend" = {
      exec = ''cd "$DEVENV_ROOT/frontend" && nr format-check'';
      execIfModified = [
        "frontend/**/*.ts"
        "frontend/**/*.tsx"
        "frontend/**/*.js"
        "frontend/**/*.jsx"
        "frontend/**/*.json"
        "frontend/biome.json"
      ];
    };
    "format-check:drizzle" = {
      exec = ''cd "$DEVENV_ROOT/drizzle" && nr format-check'';
      execIfModified = [
        "drizzle/**/*.ts"
        "drizzle/biome.json"
      ];
    };
    "format-check:backend-py" = {
      exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff format --check apps packages'';
      execIfModified = [
        "backend-py/apps/*/src/**/*.py"
        "backend-py/packages/*/src/**/*.py"
        "backend-py/pyproject.toml"
        "backend-py/apps/*/pyproject.toml"
        "backend-py/packages/*/pyproject.toml"
      ];
    };
    "format-check:functions" = {
      exec = ''deno fmt --check "$DEVENV_ROOT/supabase/functions/"'';
      execIfModified = [
        "supabase/functions/**/*.ts"
        "supabase/functions/**/deno.json"
      ];
    };

    # ----- Type check -----
    "type-check:frontend" = {
      exec = ''cd "$DEVENV_ROOT/frontend" && nr type-check'';
      execIfModified = [
        "frontend/**/*.ts"
        "frontend/**/*.tsx"
        "frontend/**/tsconfig*.json"
        "frontend/**/package.json"
      ];
    };
    "type-check:mobile" = {
      exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && nlx tsc --noEmit'';
      execIfModified = [
        "frontend/apps/mobile/**/*.ts"
        "frontend/apps/mobile/**/*.tsx"
        "frontend/apps/mobile/tsconfig*.json"
        "frontend/apps/mobile/package.json"
      ];
    };
    "type-check:backend-py" = {
      exec = ''cd "$DEVENV_ROOT/backend-py" && uv run mypy apps packages'';
      execIfModified = [
        "backend-py/apps/*/src/**/*.py"
        "backend-py/packages/*/src/**/*.py"
        "backend-py/pyproject.toml"
        "backend-py/apps/*/pyproject.toml"
        "backend-py/packages/*/pyproject.toml"
      ];
    };
    "type-check:functions" = {
      exec = ''
        for dir in "$DEVENV_ROOT"/supabase/functions/*/; do
          [ -f "$dir/index.ts" ] || continue
          func_name=$(basename "$dir")
          if [ -f "$dir/deno.json" ]; then
            (cd "$dir" && deno cache --config=deno.json index.ts) >/dev/null 2>&1 || true
            (cd "$dir" && deno check --config=deno.json index.ts) || echo "  ⚠️  Type check failed for $func_name"
          else
            deno check "$dir/index.ts" || echo "  ⚠️  Type check failed for $func_name"
          fi
        done
      '';
      execIfModified = [
        "supabase/functions/**/*.ts"
        "supabase/functions/**/deno.json"
      ];
    };

    # ----- Aggregator: devenv test → 全 verify を一発実行 -----
    # `before = [ "devenv:enterTest" ]` で `devenv test` の依存に組み込む。
    # `after = [ ... ]` で配下の verify task をすべて要求 → namespace 内で並列実行 + キャッシュ。
    "ci:check" = {
      exec = ''echo "✅ All CI checks passed"'';
      before = [ "devenv:enterTest" ];
      after = [
        "lint-ci:frontend"
        "lint-ci:drizzle"
        "lint-ci:backend-py"
        "lint-ci:functions"
        "lint-ci:fsd"
        "format-check:frontend"
        "format-check:drizzle"
        "format-check:backend-py"
        "format-check:functions"
        "type-check:frontend"
        "type-check:mobile"
        "type-check:backend-py"
        "type-check:functions"
      ];
    };

    # ---------- Stop ----------
    "app:stop".exec = ''
      echo "🛑 Stopping devenv processes (backend + storybook)..."
      devenv processes down 2>/dev/null || true
      echo "🛑 Stopping Supabase (Docker)..."
      supabase stop 2>/dev/null || true
      echo "✅ All services stopped."
    '';
  };

  # ===== Scripts（PATH に追加される単発コマンド）=====
  #
  # devenv shell に入った状態（または direnv 経由）で、コマンド名で直接実行できる。
  # 例: `frontend`, `lint-frontend`, `test-db`
  scripts = {
    # ---------- Init（初回セットアップ・対話）----------
    # 開発開始前に一度だけ実行する初期化コマンド。外部サービスの対話認証（Doppler login 等）を
    # 含むため、自動 bootstrap（setup:* task）ではなくこの明示コマンドで行う。
    # 依存インストール等の非対話セットアップは `devenv shell` 進入時の setup:* task が自動実行する。
    "init" = {
      exec = ''
        echo "🚀 プロジェクト初期化（初回のみ）"
        echo ""
        echo "── 1) Doppler（シークレット管理）─────────────"
        if ! command -v doppler >/dev/null 2>&1; then
          echo "  ⚠️  doppler が見つかりません。devenv shell 内で実行してください。"
        else
          if doppler me >/dev/null 2>&1; then
            echo "  ✓ Doppler ログイン済み"
          else
            echo "  → ブラウザ認証を開きます（doppler login）"
            doppler login
          fi
          echo "  → ローカルを project/config に紐付けます（doppler setup）"
          echo "    ※ doppler.yaml の <doppler-project> を実プロジェクト名に置換してから実行"
          doppler setup || echo "  ⚠️  doppler setup 未完了（doppler.yaml の project 名を確認してください）"
        fi
        echo ""
        echo "── 2) Supabase ローカル ───────────────────────"
        echo "  → 'supabase-start' で起動（Docker 必須）。'devenv up' でも自動起動します。"
        echo ""
        echo "✅ 初期化完了。'devenv up' / 'dev-web' / 'dev-all' で開発を開始できます。"
        echo "   シークレットは Doppler から自動ロードされます（成功時 '🔐 Doppler secrets loaded'）。"
      '';
      description = "初回セットアップ（Doppler login+setup 等。一度だけ対話実行）";
    };

    # ---------- Lifecycle shortcuts ----------
    "stop" = {
      exec = ''exec devenv tasks run app:stop'';
      description = "Stop devenv processes + Supabase";
    };

    "supabase-start" = {
      exec = ''exec devenv tasks run supabase:start'';
      description = "Start Supabase (Docker) + seed buckets";
    };

    "supabase-stop" = {
      exec = ''exec devenv tasks run supabase:stop'';
      description = "Stop Supabase (Docker)";
    };

    # ---------- Doppler（シークレット管理・移行下準備）----------
    # 完全移行に向けた補助 script。詳細・移行手順は .claude/skills/doppler/SKILL.md。
    "doppler-setup" = {
      exec = ''
        set -e
        echo "🔐 Doppler セットアップ"
        echo "  1) ブラウザ認証: doppler login"
        echo "  2) ローカルを project/config に紐付け: doppler setup"
        echo "     （リポジトリ root の doppler.yaml に基づく場合）: doppler setup --no-interactive"
        echo ""
        echo "現在の設定:"
        doppler configure 2>/dev/null || echo "  （未設定）"
      '';
      description = "Doppler login / setup の案内 + 現在の設定表示";
    };

    # 取得確認用。実際の env への注入は enterShell（Doppler-first）が自動で行う。
    "doppler-pull" = {
      exec = ''exec doppler secrets download --no-file --format env "$@"'';
      description = "Doppler の secrets を dotenv 形式で表示（--config <name> でconfig指定）";
    };

    # 移行用: 現行 env/.env.secrets を Doppler の config に一括投入する。
    # 例: doppler-import --config dev   （事前に doppler login + doppler setup が必要）
    # 非機密の .env.local は Doppler に載せない（ファイル管理のまま）。
    "doppler-import" = {
      exec = ''exec doppler secrets upload "$DEVENV_ROOT/env/.env.secrets" "$@"'';
      description = "現行 env/.env.secrets を Doppler に一括アップロード（--config <name>）";
    };

    # ---------- MCP 設定の一元管理 ----------
    # 正本 = ルートの .mcp.json（Claude が直読）。これを編集して mcp-sync を実行すると
    # Codex(.codex/config.toml) と Cursor(.cursor/mcp.json) へ形式変換して投影する。
    # 生成物は手動編集禁止（.claude/rules/auto-generated.md）。
    "mcp-sync" = {
      exec = ''
        cd "$DEVENV_ROOT"
        exec deno run --allow-read --allow-write scripts/sync-mcp.ts
      '';
      description = "Sync .mcp.json (正本) → Codex / Cursor の MCP 設定を再生成";
    };

    # ---------- Dev preset（モノレポのアプリ別起動プリセット）----------
    # frontendApps から `dev-<name>` script と `dev-all` を自動生成する。
    # 個別の手書き宣言は不要 — `frontendApps` に 1 行追加すれば連動する。
    "dev-all" = {
      exec = devAllExec;
      description = "Start backend + storybook + all frontend apps";
    };

    # ---------- Dev servers（long-running, foreground, devenv 外）----------
    # frontend (turbo dev) は web + mobile を **両方** 並列起動する重いコマンド。
    # アプリ別に分けたい場合は `dev-web` / `dev-mobile` を使うこと。
    "frontend" = {
      exec = ''cd "$DEVENV_ROOT/frontend" && exec nr dev'';
      description = "Start frontend monorepo (turbo dev: web + mobile parallel)";
    };

    "mobile" = {
      exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && exec nlx expo start'';
      description = "Start Expo dev server (interactive platform select)";
    };

    "mobile-ios" = {
      exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && exec nlx expo start --ios'';
      description = "Start Expo (iOS)";
    };

    "mobile-android" = {
      exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && exec nlx expo start --android'';
      description = "Start Expo (Android)";
    };

    "mobile-web" = {
      exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && exec nlx expo start --web'';
      description = "Start Expo (Web)";
    };

    "build-mobile-ios" = {
      exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && exec nlx eas build --platform ios'';
      description = "Build mobile (iOS) via EAS";
    };

    "build-mobile-android" = {
      exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && exec nlx eas build --platform android'';
      description = "Build mobile (Android) via EAS";
    };

    # ---------- Lint ----------
    # auto-fix 系: scripts に直接処理 (シンプル sequential、execIfModified なし → 副作用ループ回避)
    "lint-frontend"     = { exec = ''cd "$DEVENV_ROOT/frontend" && nr lint''; description = "Biome lint (frontend, auto-fix)"; };
    "lint-drizzle"      = { exec = ''cd "$DEVENV_ROOT/drizzle" && nr lint''; description = "Biome lint (drizzle, auto-fix)"; };
    "lint-backend-py"   = { exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff check --fix apps packages''; description = "Ruff lint (backend-py workspace, auto-fix)"; };

    # CI 系: tasks (lint-ci:*) の wrapper → execIfModified キャッシュが効く
    "lint-frontend-ci"   = { exec = ''exec devenv tasks run lint-ci:frontend''; description = "Biome lint (frontend, CI, cached)"; };
    "lint-drizzle-ci"    = { exec = ''exec devenv tasks run lint-ci:drizzle''; description = "Biome lint (drizzle, CI, cached)"; };
    "lint-backend-py-ci" = { exec = ''exec devenv tasks run lint-ci:backend-py''; description = "Ruff lint (backend-py, CI, cached)"; };
    "lint-fsd"           = { exec = ''exec devenv tasks run lint-ci:fsd''; description = "FSD boundary check (cached)"; };
    "lint-functions"     = { exec = ''exec devenv tasks run lint-ci:functions''; description = "Deno lint (edge functions, cached)"; };

    "lint" = {
      exec = ''
        set -e
        echo "🔍 Lint all (auto-fix)..."
        lint-frontend
        lint-drizzle
        lint-backend-py
        deno lint "$DEVENV_ROOT/supabase/functions/"
      '';
      description = "Lint all subprojects (auto-fix)";
    };

    # ---------- Format ----------
    # auto-fix 系: scripts に直接処理
    "format-frontend"   = { exec = ''cd "$DEVENV_ROOT/frontend" && nr format''; description = "Biome format (frontend, auto-fix)"; };
    "format-drizzle"    = { exec = ''cd "$DEVENV_ROOT/drizzle" && nr format''; description = "Biome format (drizzle, auto-fix)"; };
    "format-backend-py" = { exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff format apps packages''; description = "Ruff format (backend-py workspace, auto-fix)"; };
    "format-functions"  = { exec = ''deno fmt "$DEVENV_ROOT/supabase/functions/"''; description = "Deno fmt (edge functions, auto-fix)"; };

    # check 系: tasks (format-check:*) の wrapper
    "format-frontend-check"   = { exec = ''exec devenv tasks run format-check:frontend''; description = "Biome format check (frontend, cached)"; };
    "format-drizzle-check"    = { exec = ''exec devenv tasks run format-check:drizzle''; description = "Biome format check (drizzle, cached)"; };
    "format-backend-py-check" = { exec = ''exec devenv tasks run format-check:backend-py''; description = "Ruff format check (backend-py, cached)"; };
    "format-functions-check"  = { exec = ''exec devenv tasks run format-check:functions''; description = "Deno fmt check (edge functions, cached)"; };

    "format" = {
      exec = ''
        set -e
        echo "✨ Format all (auto-fix)..."
        format-frontend
        format-drizzle
        format-backend-py
        format-functions
      '';
      description = "Format all subprojects (auto-fix)";
    };

    # 集約 check は namespace match で並列 + キャッシュ (公式 1.7+ 機能)
    "format-check" = {
      exec = ''exec devenv tasks run format-check'';
      description = "Format check all subprojects (parallel + cached)";
    };

    # ---------- Type check ----------
    # tasks (type-check:*) の wrapper → execIfModified キャッシュ
    "type-check-frontend"   = { exec = ''exec devenv tasks run type-check:frontend''; description = "TS type check (frontend, cached)"; };
    "type-check-mobile"     = { exec = ''exec devenv tasks run type-check:mobile''; description = "TS type check (mobile, cached)"; };
    "type-check-backend-py" = { exec = ''exec devenv tasks run type-check:backend-py''; description = "MyPy type check (backend-py, cached)"; };
    "check-functions"       = { exec = ''exec devenv tasks run type-check:functions''; description = "Deno check (edge functions, cached)"; };

    # 集約: namespace match で並列 + キャッシュ
    "type-check" = {
      exec = ''exec devenv tasks run type-check'';
      description = "Type check all subprojects (parallel + cached)";
    };

    # ---------- CI gate ----------
    # `devenv test` 経由で `ci:check` aggregator task を起動。
    # 配下の lint-ci:* / format-check:* / type-check:* が namespace 並列 + execIfModified キャッシュで実行される。
    # → 何も変更してなければ全 task キャッシュヒットで秒で終わる。
    # → 一部だけ変更すれば影響範囲のみ走る (incremental)。
    # → ローカルと CI で同じコマンド (`devenv test`)、環境差ゼロ。
    "ci-check" = {
      exec = ''exec devenv test'';
      description = "Full CI gate via `devenv test` (cached, incremental)";
    };

    # ---------- Build ----------
    "build-frontend" = { exec = ''cd "$DEVENV_ROOT/frontend" && nr build''; description = "Build frontend (Next.js)"; };

    # ---------- Tests ----------
    "test-frontend"   = { exec = ''cd "$DEVENV_ROOT/frontend" && nr test''; description = "Vitest (frontend)"; };
    "test-backend-py" = { exec = ''cd "$DEVENV_ROOT/backend-py" && uv run pytest''; description = "pytest (backend-py workspace)"; };
    "test-db"         = { exec = ''supabase test db --local''; description = "pgTAP DB tests"; };
    # NOTE: `test` という名前は bash 組み込みコマンド（`[` と等価）と衝突し、
    # PATH 上の同名スクリプトより builtin が優先される。CI で `run: test` を呼ぶと
    # 引数なしの builtin `test` が exit 1 を返してジョブが落ちるため、`unit-test`
    # に名前を変えてある。
    "unit-test" = {
      exec = ''
        set -e
        echo "🧪 Running all unit tests..."
        test-frontend
        test-backend-py
        echo "✅ All unit tests passed."
        echo "💡 Run 'test-db' for pgTAP DB tests, 'e2e' for Maestro E2E."
      '';
      description = "Run all unit tests (frontend + backend-py)";
    };
    "e2e"      = { exec = ''cd "$DEVENV_ROOT/.maestro" && maestro test .''; description = "Maestro E2E (all)"; };
    "e2e-web"  = { exec = ''cd "$DEVENV_ROOT/.maestro" && maestro test web/''; description = "Maestro E2E (web)"; };
    "e2e-mobile" = { exec = ''cd "$DEVENV_ROOT/.maestro" && maestro test mobile/''; description = "Maestro E2E (mobile)"; };

    # ---------- Drizzle ----------
    "drizzle-push"     = { exec = ''cd "$DEVENV_ROOT/drizzle" && nr push''; description = "Drizzle: push schema (no migration file)"; };
    "drizzle-studio"   = { exec = ''cd "$DEVENV_ROOT/drizzle" && exec nr studio''; description = "Drizzle Studio (GUI)"; };
    "drizzle-validate" = { exec = ''cd "$DEVENV_ROOT/drizzle" && nr check''; description = "Drizzle: schema validate"; };

    # ---------- Storybook standalone ----------
    "storybook-local" = { exec = ''cd "$DEVENV_ROOT/frontend" && exec bun run storybook''; description = "Storybook standalone (without devenv up)"; };
    "build-storybook" = { exec = ''cd "$DEVENV_ROOT/frontend" && bun run build-storybook''; description = "Build Storybook"; };

    # ---------- Skill / dev tooling ----------
    # uipro-cli: UI/UX Pro Max skill installer (https://www.npmjs.com/package/uipro-cli)
    # bunx 経由で都度実行（bun のキャッシュを利用、グローバル node_modules を作らない）。
    "uipro" = {
      exec = ''cd "$DEVENV_ROOT" && exec bunx uipro-cli "$@"'';
      description = "Run uipro-cli (UI/UX Pro Max skill installer) via bunx";
    };

    # ---------- Status check ----------
    "check" = {
      exec = ''
        supabase status
        echo ""
        echo "💡 To start: devenv up"
      '';
      description = "Show Supabase status";
    };
  } // lib.mapAttrs' (name: cfg: lib.nameValuePair "dev-${name}" (mkDevScript name cfg)) frontendApps;
  # ↑ frontendApps から `dev-<name>` script を自動生成（dev-web / dev-mobile / dev-admin ...）。

  # OCI コンテナイメージ（devenv container build backend で生成）
  # Railway は Railpack を使用するため、通常は不要。
  # backendExec を let-binding で共有することで profile に依存せず参照できる。
  containers."backend" = {
    name = "backend-py";
    version = "latest";
    startupCommand = backendExec;
  };

  # Pre-commit hooks（devenv shell 進入時に .git/hooks/ へ自動インストール）
  #
  # 設計方針 (詳細は docs/_research/2026-04-28-devenv-quality-checks.md):
  #   - **git-hooks.nix のビルトインフックを使う** (`biome.enable = true` 等)
  #   - 各ビルトインは types_or / files / pass_filenames が適切にプリセット済み
  #   - pass_filenames = true (デフォルト) で **変更ファイルだけ** がツールに渡される
  #     → コミット時の lint が <200ms で完結 (full project lint と段違いに高速)
  #   - prek (Rust 実装) が pre-commit を駆動するので Python オーバーヘッドなし
  #
  # 全プロジェクトの verify は `devenv test` (= ci:check task) で行う (役割分担)。
  git-hooks.hooks = {
    # ----- JS/TS/JSON: Biome (frontend + drizzle 共通) -----
    # ビルトインの types_or = [ "javascript" "jsx" "ts" "tsx" "json" ]
    # biome は ancestor lookup で biome.json を見つけるので frontend/ と drizzle/ 両方カバー
    #
    # NOTE: --write を付けない（check モード）。理由:
    #   - prek の patch 機構と biome --write の組み合わせで毎回「files were modified」
    #     と報告されてループする現象が発生する（staged content と working tree が
    #     一致していても biome が再書き込みするため）。
    #   - auto-fix は scripts (`lint`, `format`) や IDE 連携で行う。
    #     pre-commit の役割は「壊れたコードを通さないゲート」で十分。
    biome = {
      enable = true;
      # --no-errors-on-unmatched: biome.json で除外されたファイル
      # (skills-lock.json 等) のみが渡されたケースで exit 1 になるのを抑止。
      entry = lib.mkForce "${pkgs.biome}/bin/biome check --no-errors-on-unmatched";
    };

    # ----- Python: Ruff (lint) -----
    # backend-py workspace の apps/<name>/src と packages/<name>/src のみ対象。
    # リポジトリ root 直下や .claude/skills 等にある Python ファイル（外部ツール同期由来）は
    # backend-py の ruff 設定を意図しないため対象から外す。
    # プロジェクト単位の verify は `lint-backend-py` task で行う。
    ruff = {
      enable = true;
      files = "^backend-py/(apps|packages)/[^/]+/src/.*\\.py$";
    };

    # ----- Python: Ruff (format) -----
    ruff-format = {
      enable = true;
      files = "^backend-py/(apps|packages)/[^/]+/src/.*\\.py$";
    };

    # ----- Python: Mypy (type check) -----
    # 型エラーの早期検出を優先しコミット時にもフルチェック相当を回す。
    # ファイル単位の false positive (import 整合性が一時的に崩れた中間状態) は許容し、
    # 引っかかったら fix → re-commit で対応する。
    # プロジェクト単位の最終確認は `type-check:backend-py` task (devenv test 経由) で重ねて行う。
    # tests/ は pytest で動的型チェック相当を行うため mypy 対象外（pyproject.toml の exclude
    # は CLI 個別ファイル渡しでは効かないので、ここでも明示除外する）。
    #
    # ビルトインの mypy フックは project root から `mypy` を直接呼ぶため、
    # backend-py の uv venv (workspace 共有) にインストールされたパッケージを解決できず
    # import-not-found が大量に出る。
    # `cd backend-py && uv run mypy apps packages` の形に上書きすることで venv 内の
    # mypy + 全依存を見つけられるようにする。pass_filenames=false でファイル列を
    # 受け取らずワークスペース全体で実行 (= type-check:backend-py task と同じ挙動)。
    mypy = {
      enable = true;
      files = "^backend-py/(apps|packages)/[^/]+/src/.*\\.py$";
      pass_filenames = false;
      entry = lib.mkForce ''${pkgs.bash}/bin/bash -c 'cd "$(git rev-parse --show-toplevel)/backend-py" && uv run mypy apps packages' '';
    };

    # ----- Edge Functions: Deno format -----
    # deno fmt/lint は以下のいずれかで "No target files found" exit 1 になる:
    #   (a) 引数 0 件
    #   (b) 渡された引数が全て削除済み (pre-commit は deleted file path も regex 一致なら渡してくる)
    #   (c) 渡された引数が全て supabase/functions/deno.json の fmt/lint.exclude に含まれる
    #       (例: shared/drizzle/, shared/types/supabase/ などの auto-generated 領域)
    # wrapper で削除済みは事前フィルタし、残りを呼んで "No target files found" が出たら exit 0 に
    # 倒す (= 「対象ファイルなし」は失敗ではなくスキップ扱い)。
    denofmt = {
      enable = true;
      files = "^supabase/functions/.*\\.ts$";
      entry = lib.mkForce ''${pkgs.bash}/bin/bash -c 'files=(); for f in "$@"; do [ -f "$f" ] && files+=("$f"); done; [ ''${#files[@]} -eq 0 ] && exit 0; out=$(${pkgs.deno}/bin/deno fmt "''${files[@]}" 2>&1); rc=$?; if [ $rc -ne 0 ] && printf "%s" "$out" | grep -q "No target files found"; then exit 0; fi; printf "%s\n" "$out"; exit $rc' --'';
    };

    # ----- Edge Functions: Deno lint -----
    denolint = {
      enable = true;
      files = "^supabase/functions/.*\\.ts$";
      entry = lib.mkForce ''${pkgs.bash}/bin/bash -c 'files=(); for f in "$@"; do [ -f "$f" ] && files+=("$f"); done; [ ''${#files[@]} -eq 0 ] && exit 0; out=$(${pkgs.deno}/bin/deno lint "''${files[@]}" 2>&1); rc=$?; if [ $rc -ne 0 ] && printf "%s" "$out" | grep -q "No target files found"; then exit 0; fi; printf "%s\n" "$out"; exit $rc' --'';
    };
  };

  # base enterShell。profile 未指定（= local 既定）で local 環境 env を読み込む。
  # `-P staging` / `-P production` を付けた場合は、profile の enterShell が後追いで実行され、
  # `set -a; source` の後勝ち動作で staging/production の値（と ENV / Doppler）が local を上書きする。
  #
  # ENV 既定: 外部から `ENV=...` を渡していなければ local（deploy スクリプトの規約と同じ）。
  # シークレットは loadDopplerByEnv が ENV に応じた Doppler config から読む（local→ローカル参照、
  # 未接続時はファイル .env.secrets にフォールバック）。ローカルは公式推奨の dev_personal を
  # `doppler setup`/doppler.yaml で紐付ける。非機密 config（URL/port 等）は .env.local のまま。
  # 詳細は .claude/skills/doppler/SKILL.md。
  enterShell = ''
    export ENV="''${ENV:-local}"
    ${loadEnvFilesForEnv}
    ${loadDopplerByEnv}
    echo "devenv: Node $(node -v), Python $(python3 -V), Deno $(deno -v), Bun $(bun -v), uv $(uv -V)"
    echo ""
    echo "📋 Quick start:"
    echo "  devenv up                         # supabase + backend + storybook (light, local 既定)"
    echo "  dev-web                           #   ↑ + Next.js (frontend/apps/web)"
    echo "  dev-mobile                        #   ↑ + Expo Metro (frontend/apps/mobile)"
    echo "  dev-all                           #   ↑ + 両方"
    echo "  mobile-ios / mobile-android       # Expo TUI 別ターミナル (devenv 外)"
    echo "  devenv tasks run db:migrate-dev   # DB schema migration"
    echo "  ci-check                          # full CI gate"
    echo "  stop                              # stop everything"
  '';
}
