#!/usr/bin/env bash
#
# Claude Code on the web 用 環境構築スクリプト（repo 内本体）。
#
# Claude Code on the web の「セットアップスクリプト」欄からこの1本を呼ぶだけで
# nix / devenv / direnv を導入し、このリポジトリの devenv 環境を構築する。
#
#   セットアップスクリプト欄に書く内容（1行・repo ルートで実行される）:
#     bash scripts/setup-web-env.sh
#
# - コンテナ初期化時（repo clone 済み・CWD = repo ルート）に実行される想定。
#   セットアップ欄の文脈では $CLAUDE_PROJECT_DIR は未設定なので相対パスで呼ぶ。
# - 冪等（再実行しても安全）。既に入っているものはスキップする。
# - 完了後にコンテナ状態はキャッシュされるため、2回目以降のセッション起動は速い。
#
set -euo pipefail

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }

# repo ルート（$CLAUDE_PROJECT_DIR が無ければスクリプト位置から解決）
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

NIX_PROFILE_SCRIPT="/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh"

# --- 1. Nix（Determinate Systems installer / daemonless コンテナ向け --init none）---
if ! command -v nix >/dev/null 2>&1; then
  log "Installing Nix (Determinate Systems, --init none)…"
  curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix \
    | sh -s -- install linux --no-confirm --init none
else
  log "Nix already installed — skip"
fi

# このシェルに Nix を読み込む（以降の cachix/devenv/direnv 実行に必要）
# shellcheck disable=SC1090
[ -f "$NIX_PROFILE_SCRIPT" ] && . "$NIX_PROFILE_SCRIPT"

# --- 2. cachix（devenv のバイナリキャッシュ。初回ビルドを大幅に高速化）---
if ! command -v cachix >/dev/null 2>&1; then
  log "Installing cachix…"
  nix profile install nixpkgs#cachix
fi
log "Enabling devenv binary cache…"
cachix use devenv || true

# --- 3. devenv + direnv ---
if ! command -v devenv >/dev/null 2>&1; then
  log "Installing devenv…"
  nix profile install nixpkgs#devenv
fi
if ! command -v direnv >/dev/null 2>&1; then
  log "Installing direnv…"
  nix profile install nixpkgs#direnv
fi

# --- 4. 以降の全シェル（Claude Code 本体含む）で Nix と direnv を有効化 ---
#     コンテナ初期化シェルと Claude Code のシェルは別プロセスなので ~/.bashrc に永続化する。
BASHRC="$HOME/.bashrc"
touch "$BASHRC"
grep -qF "$NIX_PROFILE_SCRIPT" "$BASHRC" 2>/dev/null \
  || printf '\n# Nix daemon profile (added by setup-web-env.sh)\n. %s\n' "$NIX_PROFILE_SCRIPT" >> "$BASHRC"
grep -qF 'direnv hook bash' "$BASHRC" 2>/dev/null \
  || printf '# direnv hook (added by setup-web-env.sh)\neval "$(direnv hook bash)"\n' >> "$BASHRC"

# --- 5. repo の devenv 環境を構築（.envrc = use devenv を許可して事前ビルド）---
log "Building devenv environment for this repo…"
eval "$(direnv hook bash)"
cd "$PROJECT_DIR"
direnv allow
# devenv shell を実際に構築して enterShell（bootstrap 等）まで走らせる
direnv exec . true

log "✅ Environment ready (nix / devenv / direnv installed, devenv shell built)"
