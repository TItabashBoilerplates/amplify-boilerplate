#!/usr/bin/env bash
# ストア掲載情報・アプリ内課金をストアの API へ反映する（App Store Connect / Google Play）。
#
#   store.sh <サブコマンド> [--dry-run]
#
# サブコマンド:
#   preflight                  人が画面で入力するしかない項目を値つきで一覧（資格情報も通信も不要）
#   status                     両ストアの状態と「次にすべきこと」（**書き込まない**）
#   push-data-safety           Play の Data safety を CSV から反映（公式 API。edits に乗らない）
#   push-ios-screenshots       スクリーンショットを App Store Connect へ
#   push-play-listing          掲載文・アイコン・スクショを Google Play へ（1 トランザクション）
#   create-ios-subscriptions   iap.config.js のサブスク商品を App Store Connect に作る
#   equalize-ios-prices        販売地域すべてへ等価価格を展開する（作成後に必須）
#   create-play-subscriptions  iap.config.js のサブスク商品を Google Play に作る
#   create-play-offers         Play の無料トライアル（offer）を作って有効化する
#   testflight                 TestFlight へ配布（処理待ち → グループ割当 → Beta App Review）
#   submit-ios                 App Store の審査へ提出（版作成 → ビルド紐付け → 審査情報 → 提出）
#   release-play               Play のトラック公開・段階的公開・停止
#
# アップロード後（＝ mobile-release-* の後）を最後まで進めるのが testflight /
# submit-ios / release-play で、迷ったら status を先に実行する。
#
# **本番の掲載情報・課金商品を書き換える。必ず先に --dry-run で差分を確認すること。**
#
# 資格情報は SSM Parameter Store が唯一のソース（キー名のみ・値は出さない）:
#   APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_P8   … App Store Connect API
#   PLAY_SERVICE_ACCOUNT_JSON                              … Google Play Developer API
# 起動時に SSM から読み込んで env へ入れるので、呼ぶ側の準備は不要。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
. "$SCRIPT_DIR/lib.sh"

declare -A COMMANDS=(
  [preflight]=store-preflight.mjs
  [push-data-safety]=play-data-safety.mjs
  [status]=store-status.mjs
  [push-ios-screenshots]=asc-push-screenshots.mjs
  [push-play-listing]=play-push-listing.mjs
  [create-ios-subscriptions]=asc-create-subscriptions.mjs
  [equalize-ios-prices]=asc-equalize-prices.mjs
  [create-play-subscriptions]=play-create-subscriptions.mjs
  [create-play-offers]=play-create-offers.mjs
  [testflight]=asc-testflight.mjs
  [submit-ios]=asc-submit-review.mjs
  [release-play]=play-release.mjs
)

CMD="${1:-}"
case "$CMD" in
  ""|-h|--help) mobile_usage "${BASH_SOURCE[0]}"; exit 0 ;;
esac
shift

[ -n "${COMMANDS[$CMD]:-}" ] || mdie "不明なサブコマンド: $CMD（--help で一覧）"

# --dry-run だけはここで解釈する（全サブコマンド共通で、環境変数として渡すため）。
# それ以外はサブコマンド固有の引数（--track / --rollout / --groups / --build 等）なので
# **素通しして Node 側に検証させる**。ここで一覧を持つと、
# サブコマンドを足すたびに 2 か所直すことになり、必ず片方が古くなる。
DRY_RUN=0
PASS_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) mobile_usage "${BASH_SOURCE[0]}"; exit 0 ;;
    *) PASS_ARGS+=("$arg") ;;
  esac
done

mobile_load_config

# 資格情報が要らないサブコマンドは SSM 読み込みを挟まない。
# preflight は「ストアのアカウントをまだ作っていない段階」で真っ先に実行したいものなので、
# ここで AWS 認証情報を要求すると**一番必要なときに使えない**。
case "$CMD" in
  preflight) ;;
  *)
    # 再実行するので、ここより後の処理は「シークレット注入済み」の 1 回だけ走る
    mobile_load_secrets
    ;;
esac

command -v node >/dev/null || mdie "node が見つかりません（devenv shell 内で実行してください）"

[ "$DRY_RUN" = 1 ] && mwarn "dry-run: ストアへは一切書き込みません"

# MOBILE_APP_DIR は config.env が正本。Node 側で同じパーサを持たないよう env で渡す
exec env \
  MOBILE_APP_DIR="$MOBILE_APP_DIR" \
  DRY_RUN="$([ "$DRY_RUN" = 1 ] && echo 1 || echo 0)" \
  node "$SCRIPT_DIR/store-run.mjs" "${COMMANDS[$CMD]}" ${PASS_ARGS+"${PASS_ARGS[@]}"}
