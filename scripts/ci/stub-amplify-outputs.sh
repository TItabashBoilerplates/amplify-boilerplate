#!/usr/bin/env bash
# `amplify_outputs.json` の CI 用スタブを配置する。
#
#   bash scripts/ci/stub-amplify-outputs.sh
#
# 型チェックとビルドはこのファイルを参照するが、これは **環境固有の生成物**（`ampx` が
# AWS へデプロイした結果）で gitignore されているため、クローン直後や CI には存在しない。
# 公開情報のみのスタブ（`apps/web/amplify_outputs.ci.json`。シークレットを入れてはならない）を
# **無い場合だけ**置く。
#
# `scripts/ci/check.sh` からも同じ関数を使う（置き方を 2 か所に書かない）。
set -euo pipefail

STUB_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# 既にある = sandbox を張っている開発者の実物。**絶対に上書きしない。**
#
# ⚠️ `bootstrap`（= `link-amplify-outputs`）は各アプリの outputs を
# `packages/backend/amplify_outputs.json` への **symlink** として張る。初回 sandbox の前は
# これが **dangling symlink** なので `[ -e ]` は false になる（`-e` は参照先を見る）。
# ここで素に `cp` すると **symlink を辿って packages/backend 側に書いてしまう**ため、
# dangling のときは symlink を外してから実体を置く。
stub_amplify_outputs() {
  local stub="$STUB_REPO_ROOT/frontend/apps/web/amplify_outputs.ci.json"
  local app dest
  for app in web mobile; do
    dest="$STUB_REPO_ROOT/frontend/apps/$app/amplify_outputs.json"
    if [ -e "$dest" ]; then
      continue
    fi
    if [ -L "$dest" ]; then
      rm -f "$dest"
    fi
    cp "$stub" "$dest"
    echo "  (placed CI stub: apps/$app/amplify_outputs.json)"
  done
}

# source されたときは関数の定義だけ行い、直接実行されたときは配置まで行う。
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  stub_amplify_outputs
fi
