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
command -v cachix >/dev/null 2>&1 || nix profile install nixpkgs#cachix
cachix use devenv || true

# devenv / direnv 本体
command -v devenv >/dev/null 2>&1 || nix profile install nixpkgs#devenv
command -v direnv >/dev/null 2>&1 || nix profile install nixpkgs#direnv

# Claude のシェル（別プロセス）で nix と direnv を有効化。~/.bashrc はキャッシュに残る。
BASHRC="${HOME:-/root}/.bashrc"
touch "$BASHRC"
grep -qF "$NIX_PROFILE_SCRIPT" "$BASHRC" 2>/dev/null \
  || printf '\n. %s\n' "$NIX_PROFILE_SCRIPT" >> "$BASHRC"
grep -qF 'direnv hook bash' "$BASHRC" 2>/dev/null \
  || printf 'eval "$(direnv hook bash)"\n' >> "$BASHRC"

echo "✅ cloud-setup: nix / devenv / direnv ready (devenv activation は SessionStart フックで実施)"
