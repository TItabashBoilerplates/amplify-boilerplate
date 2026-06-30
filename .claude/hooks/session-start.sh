#!/bin/bash
#
# SessionStart フック: devenv 環境を有効化し、Claude の後続 Bash に引き継ぐ（repo 依存）。
#
# 公式仕様上、repo に依存する初期化は Setup script ではなく SessionStart フックで行う
# （ここでだけ $CLAUDE_PROJECT_DIR / $CLAUDE_ENV_FILE が使える）。nix/devenv/direnv の
# **インストール本体**は「環境のセットアップスクリプト」(scripts/cloud-setup.sh) 側。
#
# 重要な落とし穴:
#   - Claude の Bash は非ログイン・非対話 shell で ~/.bashrc を読まない。
#     → 環境を引き継ぐには $CLAUDE_ENV_FILE に書く（公式の唯一の手段）。
#   - __ETC_PROFILE_NIX_SOURCED が基底環境に残っていると nix-daemon.sh が PATH を
#     追加せず早期 return する。→ unset してから source する。
#
# @see https://code.claude.com/docs/en/claude-code-on-the-web (Setup scripts vs. SessionStart hooks)
set -e

NIX_PROFILE_SCRIPT="/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh"

# nix を確実に読み込む（ガードを外して PATH/NIX_* を確実に設定）
unset __ETC_PROFILE_NIX_SOURCED
# shellcheck disable=SC1091
. "$NIX_PROFILE_SCRIPT" 2>/dev/null || true
# 念のためプロファイル bin を直接 PATH へ
export PATH="${HOME:-/root}/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"

# direnv 未導入（環境セットアップ前 / 別環境）なら何もしない
command -v direnv >/dev/null 2>&1 || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
direnv allow

# Claude の後続 Bash コマンドへ devenv 環境を引き継ぐ。
#   - nix-daemon を入れて NIX_* / 基底 PATH を復元（ガード unset 込み）
#   - direnv export で devenv のプロファイル PATH（lint/pnpm/sandbox 等の scripts）を追加
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'unset __ETC_PROFILE_NIX_SOURCED'
    echo ". \"$NIX_PROFILE_SCRIPT\" 2>/dev/null || true"
    direnv export bash 2>/dev/null || true
  } >> "$CLAUDE_ENV_FILE"
fi

exit 0
