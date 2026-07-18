#!/usr/bin/env bash
# ==============================================================================
# claude-code-web-setup.sh
#
#   Claude Code on the web (CCR) 専用セットアップスクリプト
#   for: titabashboilerplates/amplify-boilerplate
#
#   ★ ローカル開発や CI では使わない（この環境専用）。リポジトリのファイルは変更しない。
#   ★ ローカルには一切影響しない: 本スクリプトは CCR 環境設定の Setup script 欄に貼る用で、
#     ローカルの `claude` セッションでは実行されない。SessionStart フック等の repo 配線も
#     使わないため、ローカルのデバッグ環境（devenv/direnv）には何も触れない。
# ------------------------------------------------------------------------------
# 標準セットアップ（この2点をセットで設定する）:
#   1. CCR 環境設定の「Setup script」欄     … 本スクリプトの中身を貼る
#   2. CCR 環境設定の「環境変数」欄          … 次の1行を追加
#          BASH_ENV=/root/.ccr-devenv-env.sh
#
#   → これで Bash ツールから `lint` / `format` / `sandbox` / `dev-web` などが *プレフィックス
#     無し* で通る（ローカルの direnv 自動ロードと同じ体験）。
#     ※ セットアップスクリプトからはツールシェルの環境変数を直接セットできないため、
#       BASH_ENV の付与だけは「環境変数」欄で行う（2 が必須）。
# ------------------------------------------------------------------------------
# なぜ Docker / Supabase の調整が無いのか:
#   このリポジトリは **AWS Amplify Gen2** ベースで、バックエンドのローカル実行は
#   **クラウドの `ampx sandbox`**（per-developer のクラウド sandbox）で行う。旧 Supabase
#   構成のようなローカル Docker スタック（realtime / edge-runtime のイメージパッチや dockerd
#   常駐）は不要。よって本スクリプトは nix/devenv/direnv の導入と env 引き継ぎだけに専念する。
# ------------------------------------------------------------------------------
# 何を解決するか:
#   本プロジェクトの開発コマンドは devenv (nix) 上に構築されている。ところが CCR の Bash
#   ツールは *非対話* シェルで動くため、~/.bashrc / ~/.profile / /etc/profile.d を読み込まない。
#   よって nix プロファイルを対話シェル向けに PATH 配線しても効かず、`devenv` が「毎回認識
#   されない」。
#
# どう直すか:
#   (a) 既に PATH 上にある /usr/local/bin へ devenv/direnv/nix を symlink
#       → 非対話シェルでも `devenv` が解決する。
#   (b) BASH_ENV 用の「遅延ローダ」を書き出す（devenv 環境の生成は clone 後に遅延実行）
#       → CCR の setup script は clone 前に走るため、repo を要する devenv 事前ビルドや
#         direnv export はここでは行えない。setup script はローダだけを書き、上記 2 の
#         BASH_ENV 経由で各セッション最初の Bash（clone 済み）が devenv 環境を生成・
#         キャッシュして読み込む → devenv scripts が裸で通る。
#   （nix のプロキシ / TLS 設定 NIX_SSL_CERT_FILE 等は CCR が注入済みで追加不要）
#
# ネットワーク（既定 Trusted allowlist）:
#   - `*.nixos.org`（cache.nixos.org）は許可 → node/pnpm/python/uv/awscli 等の toolchain は
#     プリビルドを取得できる（ソースからのコンパイルを避けられる）。
#   - `*.cachix.org` は既定 allowlist に含まれないため devenv の cachix は miss しうる（非致命）。
#     初回ビルドを速くしたい場合は環境の Custom allowlist に `*.cachix.org` と
#     `install.determinate.systems` を追加する。
# ==============================================================================
set -euo pipefail

# nix / cachix は $USER を要求する。CCR のセットアップシェルでは未設定のことがあるので補う。
export USER="${USER:-root}"

# この環境固有の既知パス（CCR / このリポジトリ専用なのでハードコード）
# ※ repo パスは setup script では使わない（clone 前のため）。遅延ローダが実行時に
#   $CLAUDE_PROJECT_DIR から解決する。
NIX_PROFILE_BIN=/root/.nix-profile/bin
NIX_DAEMON_SH=/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
ENV_FILE=/root/.ccr-devenv-env.sh        # ← 「環境変数」欄の BASH_ENV が指すファイル（遅延ローダ）

log() { printf '\033[1;34m[cc-web-setup]\033[0m %s\n' "$*"; }

# ------------------------------------------------------------------------------
# 1. nix + devenv + direnv を導入（未導入時のみ / 冪等）
#    ★ CCR のビルド環境は systemd が無く / が非 root 所有のことがあるため、Determinate の
#      既定（--init systemd）だと determinate-nixd の init 設定（systemd-tmpfiles）で失敗する。
#      --init none（root-only nix、systemd 不要）で回避する。
# ------------------------------------------------------------------------------
NIX_BIN=/nix/var/nix/profiles/default/bin/nix
if [ ! -e "$NIX_BIN" ] && ! command -v nix >/dev/null 2>&1; then
  log "Determinate Nix をインストール（--init none: systemd 不要 / root-only）..."
  curl -fsSL https://install.determinate.systems/nix \
    | sh -s -- install linux --init none --no-confirm \
        ${NIX_SSL_CERT_FILE:+--ssl-cert-file "$NIX_SSL_CERT_FILE"}
fi

# セットアップシェルに nix を PATH 追加（--init none でも profile script は作られる）
unset __ETC_PROFILE_NIX_SOURCED
for _f in "$NIX_DAEMON_SH" /nix/var/nix/profiles/default/etc/profile.d/nix.sh; do
  # shellcheck disable=SC1090
  [ -e "$_f" ] && { . "$_f"; break; }
done
# フォールバック: nix が PATH に無ければ profile bin を直接足す
command -v nix >/dev/null 2>&1 || export PATH="/nix/var/nix/profiles/default/bin:$NIX_PROFILE_BIN:$PATH"

# devenv のバイナリキャッシュ（初回ビルド高速化。cachix.org が allowlist 外なら no-op）
command -v cachix >/dev/null 2>&1 || nix profile add nixpkgs#cachix
cachix use devenv || log "cachix use devenv skipped (devenv.cachix.org 到達不可 — 非致命)"

for pkg in devenv direnv; do
  if [ ! -e "$NIX_PROFILE_BIN/$pkg" ]; then
    log "nix profile add nixpkgs#$pkg ..."
    nix profile add "nixpkgs#$pkg"
  fi
done

# ------------------------------------------------------------------------------
# 2. devenv / direnv / nix を PATH 上の /usr/local/bin に symlink
#    → 非対話の Bash ツールシェルでも `devenv` が解決する
# ------------------------------------------------------------------------------
log "devenv / direnv / nix を /usr/local/bin に symlink..."
mkdir -p /usr/local/bin
for b in devenv direnv nix nix-build nix-shell cachix; do
  [ -e "$NIX_PROFILE_BIN/$b" ] && ln -sf "$NIX_PROFILE_BIN/$b" "/usr/local/bin/$b"
done
log "確認: $(command -v devenv) → $(devenv version 2>/dev/null || echo '??')"

# ------------------------------------------------------------------------------
# 3. BASH_ENV 用の「遅延ローダ」を書き出す（repo 依存処理を clone 後に実行するため）
#    ※ CCR の setup script は「リポジトリのクローン前」に実行される。よって devenv.nix
#      を要する事前ビルドや direnv export はここでは行えない。そこで setup script は
#      *ローダだけ* を書き、実際の devenv 環境生成は各セッション最初の非対話 Bash 呼び出し
#      （＝ clone 済み）で遅延実行させる。「環境変数」欄で BASH_ENV=$ENV_FILE を指すと、
#      全非対話シェルがこのローダを source し、devenv 環境（PATH 等）をセッション内キャッシュ
#      経由で読み込む → lint / sandbox / dev-web 等が裸で通る（初回のみ devenv ビルドで
#      時間がかかる。cachix で緩和可）。
#      _CCR_DEVENV_LOADED を即 export して、ビルド中に派生する子シェルの再入（デッドロック）
#      を防ぎ、ロックで先着1プロセスだけが生成する。
# ------------------------------------------------------------------------------
log "BASH_ENV 遅延ローダを $ENV_FILE に書き出し..."
cat > "$ENV_FILE" <<'LOADER'
# Auto-generated by claude-code-web-setup.sh — BASH_ENV 経由で毎非対話 bash が source。
# repo 依存の devenv 環境生成を clone 後に遅延実行し、セッション内でキャッシュする。
# （このファイルは CCR 環境専用。ローカルでは BASH_ENV 未設定のため決して読み込まれない。）
[ -n "${_CCR_DEVENV_LOADED:-}" ] && return 0
export _CCR_DEVENV_LOADED=1   # ビルド中に派生する子 bash はここで即抜け（再入/デッドロック防止）

_ccr_repo="${CLAUDE_PROJECT_DIR:-/home/user/amplify-boilerplate}"
_ccr_cache=/root/.ccr-devenv-env.cache.sh
_ccr_lock=/root/.ccr-devenv-env.lock
_ccr_nixsh=/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh

# nix を読み込む（ガードを外して PATH/NIX_* を確実に設定）＋ symlink 先を PATH へ
unset __ETC_PROFILE_NIX_SOURCED
# shellcheck disable=SC1090
[ -e "$_ccr_nixsh" ] && . "$_ccr_nixsh" 2>/dev/null || true
export PATH="/usr/local/bin:/root/.nix-profile/bin:/nix/var/nix/profiles/default/bin:$PATH"

# devenv 環境: キャッシュ未生成なら先着1プロセスだけが生成（初回はビルドで数分）。
# 生成後は全 bash がキャッシュを source するだけ（高速）。
if [ ! -s "$_ccr_cache" ] && command -v devenv >/dev/null 2>&1 && [ -f "$_ccr_repo/.envrc" ]; then
  if ( set -o noclobber; : > "$_ccr_lock" ) 2>/dev/null; then
    # devenv シェルを同期ビルドして確定 → その後の direnv export が完全な PATH を吐く
    ( cd "$_ccr_repo" && direnv allow . >/dev/null 2>&1 || true; devenv shell -- true >/dev/null 2>&1 || true )
    ( cd "$_ccr_repo" && direnv export bash 2>/dev/null ) > "$_ccr_cache" || true
    rm -f "$_ccr_lock"
  else
    # 他プロセスが生成中: キャッシュが出来るまで待つ（最大300秒）
    for _ in $(seq 1 300); do [ -s "$_ccr_cache" ] && break; sleep 1; done
  fi
fi

[ -s "$_ccr_cache" ] && . "$_ccr_cache"
unset _ccr_repo _ccr_cache _ccr_lock _ccr_nixsh 2>/dev/null || true
LOADER

log "完了。環境変数欄に BASH_ENV=$ENV_FILE を設定すれば、clone 後の初回 Bash で"
log "devenv 環境（裸コマンド: lint / sandbox / dev-web 等）が有効になります"
log "（初回のみ devenv ビルドで時間がかかる。cachix.org を allowlist に足すと速い）。"
log "★ BASH_ENV 未設定だとローダが動かず devenv scripts が裸で通らないので必須。"
