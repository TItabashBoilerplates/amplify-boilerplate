#!/usr/bin/env bash
# CI 相当の検査（auto-fix しない）を **1 か所に列挙**する。
#
#   scripts/ci/check.sh            # 全部
#   scripts/ci/check.sh frontend   # frontend のみ
#   scripts/ci/check.sh backend    # backend-py のみ
#
# ## なぜ「script」なのか（devenv の中に直接書かない理由）
#
# ローカルは devenv の `ci-check` から、GitHub Actions は `bash scripts/ci/check.sh` から
# 呼ぶ。**検査の一覧をここ 1 か所に置く**ことで、「CI では見ているのにローカルでは
# 見ていない（逆も）」という drift が構造的に起きなくなる。
#
# CI を devenv shell の中で回す方式（nix + cachix）も選択肢だが、それは
# **ランナーに nix を用意する話**であって検査内容の一致とは別問題である。
# ここを単一の正本にしておけば、後から CI を devenv 化しても呼ぶものは変わらない。
#
# ## auto-fix はしない
#
# `lint` / `format`（devenv script）は `--write` する日常用。ここは **`biome ci` /
# `--check`** で「直さずに落とす」。CI で auto-fix すると、直った状態で緑になり
# 誰もコミットしないまま次の CI でまた落ちる。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCOPE="${1:-all}"

step() { printf '\n\033[0;36m▶ %s\033[0m\n' "$*"; }

# `amplify_outputs.json` の CI スタブ配置。**置き方の正本は 1 か所**にしておく
# （CI の build / storybook job も同じ script を直接呼ぶ）。
# shellcheck source=scripts/ci/stub-amplify-outputs.sh
. "$REPO_ROOT/scripts/ci/stub-amplify-outputs.sh"

check_frontend() {
  stub_amplify_outputs

  step 'Biome (frontend)'
  ( cd "$REPO_ROOT/frontend" && pnpm run lint:ci )

  # frontend/biome.json とリポジトリルートの biome.json は**別設定**（スタイルも違う）。
  # frontend から回す biome は `scripts/` や `.maestro/` を見ないので、ルート側も回す。
  step 'Biome (repo root: scripts / .maestro)'
  ( cd "$REPO_ROOT" && ./frontend/node_modules/.bin/biome ci scripts .maestro )

  # ESLint は Biome と別の検査（React Hooks の規則・Next / Expo の規則）を担当する。
  # 片方だけ回すと「biome は通るのに本番ビルドで落ちる」状態になる。
  step 'ESLint (web / mobile)'
  ( cd "$REPO_ROOT/frontend" && pnpm exec turbo run lint )

  # FSD のレイヤー境界（eslint-plugin-boundaries）。Biome もこの ESLint 設定の
  # 既定 severity も境界を見ないため、専用に走らせないと違反が素通りする。
  step 'ESLint (FSD boundaries: web / mobile / desktop)'
  ( cd "$REPO_ROOT/frontend" && pnpm run lint:fsd )

  step 'TypeScript (tsc --noEmit)'
  ( cd "$REPO_ROOT/frontend" && pnpm run type-check )
}

check_backend() {
  step 'Ruff lint (backend-py)'
  ( cd "$REPO_ROOT/backend-py" && uv run ruff check apps packages )

  step 'Ruff format check (backend-py)'
  ( cd "$REPO_ROOT/backend-py" && uv run ruff format --check apps packages )

  # ⚠️ `--all-packages` を外さないこと。backend-py は uv の virtual workspace なので、
  # 素の `uv run` では member の依存が入らず third-party が全部 `Any` に見え、
  # strict の untyped-decorator 等が**壊れていないコードに対して**誤爆する。
  step 'MyPy (backend-py)'
  ( cd "$REPO_ROOT/backend-py" && uv run --all-packages mypy apps packages )
}

case "$SCOPE" in
  frontend) check_frontend ;;
  backend)  check_backend ;;
  all)      check_frontend; check_backend ;;
  *)        echo "usage: check.sh [frontend|backend|all]" >&2; exit 2 ;;
esac

printf '\n\033[0;32m✓ ci-check passed (%s)\033[0m\n' "$SCOPE"
