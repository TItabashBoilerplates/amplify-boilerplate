#!/bin/bash
#
# SessionStart フック: devenv 環境を有効化する（repo 依存の処理）。
#
# 公式仕様上、repo に依存する初期化は Setup script ではなく SessionStart フックで行う。
# ここでだけ $CLAUDE_PROJECT_DIR が使える。nix / devenv / direnv の **インストール本体**は
# 「環境のセットアップスクリプト」(scripts/cloud-setup.sh の内容を UI に貼る) 側が担当する。
#
# - local / cloud 両方で動く（scope: both）。direnv が無ければ何もしないので local でも安全。
# - クラウド(CLAUDE_CODE_REMOTE=true)のときだけ devenv shell を事前ビルドして温めておく。
#
# @see https://code.claude.com/docs/en/claude-code-on-the-web (Setup scripts vs. SessionStart hooks)
set -e

# nix を読み込む（セットアップスクリプトが ~/.bashrc に入れているが、フックは非対話 shell なので明示）
# shellcheck disable=SC1091
. /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh 2>/dev/null || true

# direnv 未導入（= まだ環境セットアップ前 / 別環境）の場合は何もしない
command -v direnv >/dev/null 2>&1 || exit 0

eval "$(direnv hook bash)"
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
direnv allow

# クラウドでは devenv shell を構築して enterShell(bootstrap 等)まで温めておく
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  direnv exec . true
fi

exit 0
