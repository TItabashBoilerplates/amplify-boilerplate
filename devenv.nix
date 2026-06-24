{ pkgs, ... }:

# devenv（ローカル開発環境）— Amplify スタック向けの最小構成。
#
# 旧構成（Supabase Docker / Doppler / Drizzle / Deno Edge Functions の
# オーケストレーション）は撤去済み。インフラはすべて AWS Amplify に移行したため、
# バックエンドのローカル実行は `ampx sandbox`（per-developer のクラウド sandbox）で行う。
#
# 主要コマンド:
#   bootstrap   依存インストール（frontend: bun / backend-py: uv）
#   sandbox     Amplify バックエンドの sandbox 起動（amplify_outputs.json 生成）
#   dev-web     Next.js (web) 開発サーバ
#   dev-mobile  Expo (mobile) 開発サーバ
#   lint / format / type-check / unit-test  品質チェック

{
  # ===== Languages =====
  languages.javascript = {
    enable = true;
    bun.enable = true;
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
      echo "→ frontend: bun install"
      (cd "$DEVENV_ROOT/frontend" && bun install)
      echo "→ backend-py: uv sync"
      (cd "$DEVENV_ROOT/backend-py" && uv sync --all-packages --all-groups)
    '';

    # ---------- Amplify backend (sandbox) ----------
    sandbox.exec = ''cd "$DEVENV_ROOT/frontend/packages/backend" && bun run sandbox "$@"'';
    sandbox-once.exec = ''cd "$DEVENV_ROOT/frontend/packages/backend" && bun run sandbox:once "$@"'';
    sandbox-delete.exec = ''cd "$DEVENV_ROOT/frontend/packages/backend" && bun run sandbox:delete "$@"'';

    # ---------- Dev servers ----------
    dev-web.exec = ''cd "$DEVENV_ROOT/frontend" && bun run --filter @workspace/web dev "$@"'';
    dev-mobile.exec = ''cd "$DEVENV_ROOT/frontend/apps/mobile" && bun run start "$@"'';
    storybook.exec = ''cd "$DEVENV_ROOT/frontend" && bun run storybook'';

    # ---------- Quality: frontend ----------
    lint-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && bun run lint'';
    format-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && bun run format'';
    type-check-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && bun run type-check'';
    test-frontend.exec = ''cd "$DEVENV_ROOT/frontend" && bun run test'';

    # ---------- Quality: backend-py ----------
    lint-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff check --fix apps packages'';
    format-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run ruff format apps packages'';
    type-check-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run mypy apps packages'';
    test-backend-py.exec = ''cd "$DEVENV_ROOT/backend-py" && uv run pytest'';

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
    echo "  bootstrap            deps (bun + uv)"
    echo "  sandbox              Amplify backend (ampx sandbox)"
    echo "  dev-web / dev-mobile dev servers"
    echo "  lint / format / type-check-* / unit-test"
  '';
}
