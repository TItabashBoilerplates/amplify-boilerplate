#!/usr/bin/env bash
# ==============================================================================
# claude-code-web-setup.sh
#
#   Claude Code on the web (CCR) 専用セットアップスクリプト
#   for: titabashboilerplates/amplify-boilerplate
#
#   ローカル開発や CI では使わない（この環境専用）。リポジトリのファイルは変更しない。
#   ⚠️ repo にコミットしてあるのは*バージョン管理・レビュー用のリファレンス*。
#      repo から自動実行はされないため、中身を CCR の Web UI に手で貼り付ける。
# ------------------------------------------------------------------------------
# 標準セットアップ（この2点を必ずセットで設定する）:
#   1. CCR 環境設定の「Setup script」欄     … 本スクリプトの中身を丸ごと貼る
#   2. CCR 環境設定の「環境変数」欄          … 次の1行を追加
#          BASH_ENV=/root/.ccr-devenv-env.sh
#
#   → これで Bash ツールから `lint` / `format` / `type-check` / `unit-test` /
#     `sandbox` / `dev-web` などが *プレフィックス無し* で通る（ローカルの direnv
#     自動ロードと同じ体験）。
#     ※ セットアップスクリプトからはツールシェルの環境変数を直接セットできない
#       ため、BASH_ENV の付与だけは「環境変数」欄で行う（2 が必須）。
# ------------------------------------------------------------------------------
# 何を解決するか:
#   本プロジェクトの開発コマンドは devenv (nix) 上に構築されている。ところが CCR の
#   Bash ツールは *非対話* シェルで動くため、~/.bashrc / ~/.profile / /etc/profile.d
#   を読み込まない。よって nix プロファイルを対話シェル向けに PATH 配線しても効かず、
#   `devenv` が「毎回認識されない」。
#     （実測: `direnv allow .` 後でも `bash -c 'command -v lint'` は not found）
#
# どう直すか:
#   (a) 既に PATH 上にある /usr/local/bin へ devenv/direnv/nix/jq を symlink
#       → 非対話シェルでも `devenv` / `jq` が解決する。
#   (b) BASH_ENV 用の「遅延ローダ」を書き出す（devenv 環境の生成は clone 後に遅延実行）
#       → CCR の setup script は clone 前に走るため、repo を要する devenv 事前ビルドや
#         direnv export はここでは行えない。setup script はローダだけを書き、上記 2 の
#         BASH_ENV 経由で各セッション最初の Bash（clone 済み）が devenv 環境を生成・
#         キャッシュして読み込む → devenv scripts が裸で通る。
#
# このリポジトリ固有の注意（Amplify Gen2 / AWS ファースト）:
#   * バックエンドのローカル実行は `ampx sandbox`（per-dev のクラウド sandbox）で行う。
#     Supabase / ローカル Docker は使わないため、旧 shadcn-boilerplate 版にあった
#     Docker デーモン起動・ローカルイメージ調整（realtime/edge-runtime パッチ）は
#     一切不要 → 本スクリプトからは完全に削除している。
#   * `sandbox`（ampx）や `aws` を使うには AWS 認証情報（プロファイル）が別途必要。
#     lint / format / type-check / unit-test 等は AWS 認証なしで通る。
#   （nix のプロキシ / TLS 設定 NIX_SSL_CERT_FILE 等は CCR が注入済みで追加不要）
# ==============================================================================
set -euo pipefail

# この環境固有の既知パス（CCR / このリポジトリ専用なのでハードコード）
# ※ repo パスは setup script では使わない（clone 前のため）。遅延ローダが実行時に
#   $CLAUDE_PROJECT_DIR から解決する。
NIX_PROFILE_BIN=/root/.nix-profile/bin
NIX_DAEMON_SH=/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
ENV_FILE=/root/.ccr-devenv-env.sh        # ← 「環境変数」欄の BASH_ENV が指すファイル（遅延ローダ）

# nix installer / `nix profile` は $USER を要求する。CCR の非対話コンテキストでは未設定の
# ことがあるため root を既定にしておく（"$USER must be set" 警告の抑止）。
export USER="${USER:-root}"

log() { printf '\033[1;34m[cc-web-setup]\033[0m %s\n' "$*"; }

# ------------------------------------------------------------------------------
# 1. nix + devenv + direnv + cachix + jq を導入（未導入時のみ / 冪等）
#    ★ CCR のビルド環境は systemd が無く / が claude 所有のため、Determinate の
#      既定（--init systemd）だと determinate-nixd の init サービス設定
#      （systemd-tmpfiles）で "unsafe path transition" により失敗する。
#      --init none（root-only nix、systemd 不要）で回避する。
# ------------------------------------------------------------------------------
NIX_BIN=/nix/var/nix/profiles/default/bin/nix
if [ ! -e "$NIX_BIN" ] && ! command -v nix >/dev/null 2>&1; then
  log "Determinate Nix をインストール（--init none: systemd 不要 / root-only）..."
  curl --proto '=https' --tlsv1.2 -fsSL https://install.determinate.systems/nix \
    | sh -s -- install linux --init none --no-confirm \
        ${NIX_SSL_CERT_FILE:+--ssl-cert-file $NIX_SSL_CERT_FILE}
fi

# セットアップシェルに nix を PATH 追加（--init none でも profile script は作られる）
# __ETC_PROFILE_NIX_SOURCED が残ると nix-daemon.sh が早期 return するため unset してから source。
unset __ETC_PROFILE_NIX_SOURCED
for _f in "$NIX_DAEMON_SH" /nix/var/nix/profiles/default/etc/profile.d/nix.sh; do
  # shellcheck disable=SC1090
  [ -e "$_f" ] && { . "$_f"; break; }
done
# フォールバック: nix が PATH に無ければ profile bin を直接足す
command -v nix >/dev/null 2>&1 || export PATH="/nix/var/nix/profiles/default/bin:$NIX_PROFILE_BIN:$PATH"

# devenv のバイナリキャッシュ（初回ビルド高速化）
if [ ! -e "$NIX_PROFILE_BIN/cachix" ]; then
  log "nix profile add nixpkgs#cachix ..."
  nix profile add "nixpkgs#cachix"
fi
cachix use devenv || true

# devenv / direnv / jq 本体
#   jq は遅延ローダが `direnv export json` を整形するのに必須（devenv shell の *外* でも要る）。
#   devenv.nix にも jq はあるが、それは devenv 環境が立った *後* の話。ローダは環境生成 *前* に
#   jq を使うため、ここで nix profile にも入れて /usr/local/bin へ symlink する。
for pkg in devenv direnv jq; do
  if [ ! -e "$NIX_PROFILE_BIN/$pkg" ]; then
    log "nix profile add nixpkgs#$pkg ..."
    nix profile add "nixpkgs#$pkg"
  fi
done

# ------------------------------------------------------------------------------
# 2. devenv / direnv / nix / jq を PATH 上の /usr/local/bin に symlink
#    → 非対話の Bash ツールシェルでも `devenv` / `jq` が解決する
# ------------------------------------------------------------------------------
log "devenv / direnv / nix / jq / cachix を /usr/local/bin に symlink..."
mkdir -p /usr/local/bin
for b in devenv direnv nix nix-build nix-shell jq cachix; do
  [ -e "$NIX_PROFILE_BIN/$b" ] && ln -sf "$NIX_PROFILE_BIN/$b" "/usr/local/bin/$b"
done
log "確認: $(command -v devenv) → $(devenv version 2>/dev/null || echo '??')"

# ------------------------------------------------------------------------------
# 3. BASH_ENV 用の「遅延ローダ」を書き出す（repo 依存処理を clone 後に実行するため）
#    ※ CCR の setup script は「リポジトリのクローン前」に実行される。よって devenv.nix
#      を要する事前ビルドや direnv export はここでは行えない。そこで setup script は
#      *ローダだけ* を書き、実際の devenv 環境生成は各セッション最初の非対話 Bash 呼び出し
#      （＝ clone 済み）で遅延実行させる。「環境変数」欄で BASH_ENV=$ENV_FILE を指すと、
#      全非対話シェルがこのローダを source し、devenv 環境（PATH 等）をセッション内
#      キャッシュ経由で読み込む → lint / sandbox 等が裸で通る（初回のみ devenv ビルドで
#      時間がかかる。cachix で緩和）。
#      _CCR_DEVENV_LOADED を即 export して、ビルド中に派生する子シェルの再入（デッドロック）
#      を防ぎ、ロックで先着1プロセスだけが生成する。
# ------------------------------------------------------------------------------
log "BASH_ENV 遅延ローダを $ENV_FILE に書き出し..."
cat > "$ENV_FILE" <<'LOADER'
# Auto-generated by claude-code-web-setup.sh — BASH_ENV 経由で毎非対話 bash が source。
# repo 依存の devenv 環境生成を clone 後に遅延実行し、セッション内でキャッシュする。
[ -n "${_CCR_DEVENV_LOADED:-}" ] && return 0
export _CCR_DEVENV_LOADED=1   # ビルド中に派生する子 bash はここで即抜け（再入/デッドロック防止）

_ccr_repo="${CLAUDE_PROJECT_DIR:-/home/user/amplify-boilerplate}"
_ccr_cache=/root/.ccr-devenv-env.cache.sh
_ccr_lock=/root/.ccr-devenv-env.lock

# devenv 環境: キャッシュ未生成なら先着1プロセスだけが生成（初回はビルドで数分）。
#   direnv export json の絶対値を素直にキャッシュ（PATH は既存 PATH の後ろに温存）。
if [ ! -f "$_ccr_cache" ] && command -v devenv >/dev/null 2>&1 && [ -f "$_ccr_repo/devenv.nix" ]; then
  if ( set -o noclobber; : > "$_ccr_lock" ) 2>/dev/null; then
    ( cd "$_ccr_repo" && direnv allow . >/dev/null 2>&1 || true; devenv shell -- true >/dev/null 2>&1 || true )
    _ccr_json="$( cd "$_ccr_repo" && direnv export json 2>/dev/null )" || true
    if printf '%s' "$_ccr_json" | jq -e 'has("PATH")' >/dev/null 2>&1; then
      {
        echo '_ccr_prev_path="$PATH"'
        printf '%s' "$_ccr_json" | jq -r 'to_entries[]|select(.value!=null)|"export \(.key)=\(.value|@sh)"'
        echo 'export PATH="$PATH:$_ccr_prev_path"'
        echo 'unset _ccr_prev_path'
      } > "$_ccr_cache"
    fi
    rm -f "$_ccr_lock"
  else
    # 他プロセスが生成中: キャッシュが出来るまで待つ（最大300秒）
    for _ in $(seq 1 300); do [ -f "$_ccr_cache" ] && break; sleep 1; done
  fi
fi

[ -f "$_ccr_cache" ] && . "$_ccr_cache"
unset _ccr_repo _ccr_cache _ccr_lock _ccr_json 2>/dev/null || true
LOADER

log "完了。環境変数欄に BASH_ENV=$ENV_FILE を設定すれば、clone 後の初回 Bash で"
log "devenv 環境（裸コマンド: lint / format / type-check / unit-test / sandbox / dev-web 等）が"
log "有効になります（初回のみ devenv ビルドで時間がかかる。cachix で緩和）。"
log "★ BASH_ENV 未設定だとローダが動かず devenv scripts が PATH に乗らないので必須。"
