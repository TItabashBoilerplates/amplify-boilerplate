#!/bin/bash
#
# Claude Code on the web 「環境のセットアップスクリプト」に貼る内容（リファレンス用コピー）。
#
# ⚠️ これは UI（環境設定）の Setup script 欄に手で貼る用。repo にも置いてあるのは
#    バージョン管理・レビューのためで、repo から自動実行されるわけではない。
#
# 公式仕様（https://code.claude.com/docs/en/claude-code-on-the-web）:
#   - Setup script は「クラウド環境」に属し、Claude Code 起動前・初回のみ実行され、
#     出力はキャッシュされる。**repo には依存しない**（$CLAUDE_PROJECT_DIR 未設定 /
#     CWD は repo ルートではない）。よってここで repo 内パスを参照してはいけない。
#   - repo に依存する有効化（direnv allow 等）は SessionStart フック
#     (.claude/hooks/session-start.sh) 側で行う。
#   - スクリプトは root / Ubuntu 24.04 で実行される。総実行は ~5 分以内に収める。
#
# ここでやること: nix / cachix / devenv / direnv の導入（重い・キャッシュ対象）。
#
set -e

NIX_PROFILE_SCRIPT="/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh"

# Nix（Determinate Systems installer / daemonless コンテナ向け --init none）
if ! command -v nix >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix \
    | sh -s -- install linux --no-confirm --init none
fi
# shellcheck disable=SC1090
. "$NIX_PROFILE_SCRIPT"

# devenv のバイナリキャッシュ（初回ビルド高速化）
command -v cachix >/dev/null 2>&1 || nix profile add nixpkgs#cachix
cachix use devenv || true

# devenv / direnv 本体
command -v devenv >/dev/null 2>&1 || nix profile add nixpkgs#devenv
command -v direnv >/dev/null 2>&1 || nix profile add nixpkgs#direnv

# 対話/teleport シェル用に ~/.bashrc にも有効化を追記（Claude の Bash は非対話なので
# 効かない点に注意。Claude への引き継ぎは SessionStart フックの $CLAUDE_ENV_FILE が担当）。
# __ETC_PROFILE_NIX_SOURCED が残ると nix-daemon.sh が早期 return するため unset してから source。
BASHRC="${HOME:-/root}/.bashrc"
touch "$BASHRC"
if ! grep -qF '__ETC_PROFILE_NIX_SOURCED' "$BASHRC" 2>/dev/null; then
  {
    echo ''
    echo '# nix + direnv (added by cloud-setup.sh)'
    echo 'unset __ETC_PROFILE_NIX_SOURCED'
    echo ". $NIX_PROFILE_SCRIPT"
    echo 'eval "$(direnv hook bash)"'
  } >> "$BASHRC"
fi

echo "✅ cloud-setup: nix / devenv / direnv ready (devenv activation は SessionStart フックで実施)"
