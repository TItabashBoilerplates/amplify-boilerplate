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
    '';

    # ---------- Amplify backend (sandbox) ----------
    sandbox.exec = ''cd "$DEVENV_ROOT/frontend/packages/backend" && pnpm run sandbox "$@"'';
    sandbox-once.exec = ''cd "$DEVENV_ROOT/frontend/packages/backend" && pnpm run sandbox:once "$@"'';
    sandbox-delete.exec = ''cd "$DEVENV_ROOT/frontend/packages/backend" && pnpm run sandbox:delete "$@"'';

    # ---------- Dev servers ----------
    dev-web.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run --filter @workspace/web dev "$@"'';
    dev-mobile.exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && pnpm run start "$@"'';
    storybook.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run storybook'';

    # ---------- Backend services (opt-in, on demand) ----------
    # REST API (FastAPI) — also runnable as the `backend` process via `devenv up`.
    dev-api.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run --package api api "$@"'';
    # MCP server (FastMCP, streamable-http on :4041).
    dev-mcp.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run --package mcp-server mcp-server "$@"'';

    # ---------- Quality: frontend ----------
    lint-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run lint'';
    format-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run format'';
    type-check-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run type-check'';
    test-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && pnpm run test'';

    # ---------- Quality: backend-py ----------
    lint-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff check --fix apps packages'';
    format-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff format apps packages'';
    type-check-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run mypy apps packages'';
    test-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run pytest'';

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

    # ---------- Aggregate ----------
    lint.exec = ''lint-frontend && lint-backend-py'';
    format.exec = ''format-frontend && format-backend-py'';
    unit-test.exec = ''test-frontend && test-backend-py'';
  };

  # ===== Processes（`devenv up` で起動）=====
  # FastAPI をローカルで uvicorn 起動（Lambda 本番は Amplify custom function）。
  processes.backend.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run --package api api'';

  enterShell = ''
    echo "amplify-boilerplate — devenv ready"
    echo "  bootstrap            deps (pnpm + uv)"
    echo "  sandbox              Amplify backend (ampx sandbox)"
    echo "  dev-web / dev-mobile dev servers"
    echo "  lint / format / type-check-* / unit-test"
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
