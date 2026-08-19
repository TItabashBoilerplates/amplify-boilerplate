#!/usr/bin/env bash
# ストア掲載用スクリーンショットの撮影 → 検証 → アップロード
#
# 使い方:
#   screenshots-mobile                          # iOS + Android を撮って検証（アップロードしない）
#   screenshots-mobile --platform ios           # iOS だけ
#   screenshots-mobile --locales en-US          # ロケールを絞る
#   screenshots-mobile --skip-capture           # 撮影済みの画像を検証だけ
#   screenshots-mobile --upload                 # ★ ストアへアップロードまで行う（明示指定が必要）
#   screenshots-mobile --dry-run                # 実行するコマンドを表示するだけ
#
# 何をするか:
#   1. simulator / emulator を起動し、アプリをインストール
#   2. Maestro の store-screenshots フローをロケール分だけ回して撮影
#   3. 撮れた画像を store-listing/ 配下へ配置（ストア反映スクリプトが読む正本）
#   4. ストア要求（サイズ・縦横比・枚数・アルファ）を検証   ← ここで落ちたらアップロードしない
#   5. --upload 指定時のみ store.sh 経由でストアの API へ送信
#
# ⚠️ 前提（この 2 つが無いと動かない）
#   - **macOS + Xcode**: iOS simulator は macOS でしか動かない。Linux では --platform android のみ。
#   - **simulator/emulator 用のビルド成果物**: ストア提出用の .ipa / .aab ではなく、
#     simulator 用 .app / emulator 用 .apk が必要。
#       iOS     : eas build --profile development-simulator --platform ios --local
#       Android : eas build --profile preview --platform android --local
#     成果物のパスは --app-ios / --app-android で渡す（省略時は既定の探索先を見る）。
#
# ⚠️ ストア用スクショに Storybook を使ってはいけない
#   Storybook は react-native-web の描画で、ネイティブのフォント・shadow/elevation・
#   ステータスバー・セーフエリアが実機と一致しない。提出画像は必ずこのスクリプト
#   （= simulator/emulator の実描画）で撮ること。Storybook は UI/UX デバッグ専用。
#
# 必要なシークレット（SSM Parameter Store。値はログに出さない）:
#   APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_P8 … App Store Connect API
#   PLAY_SERVICE_ACCOUNT_JSON                           … Google Play サービスアカウント
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/mobile/lib.sh
. "$SCRIPT_DIR/lib.sh"

PLATFORMS="all"
LOCALES="en-US,ja"
APP_IOS=""
APP_ANDROID=""
DO_CAPTURE=1
DO_UPLOAD=0
DRY_RUN=0

# 撮影に使う端末。**ストアの必須サイズちょうどの実ピクセルが出る機種**を選んでいる。
#   iPhone 16 Pro Max     : 440x956 pt @3x = 1320x2868  → App Store 6.9"（必須）
#   iPad Pro 13-inch (M4) : 1032x1376 pt @2x = 2064x2752 → App Store 13"
# 機種を変えるとピクセルが変わり validate で落ちるので、変更時は
# scripts/mobile/validate-screenshots.mjs の APP_STORE_SIZES と突き合わせること。
IOS_DEVICES="${IOS_SCREENSHOT_DEVICES:-iPhone 16 Pro Max}"

# Android は Play の「最大辺 ≤ 最小辺 x2」制約があるため、
# **1080x1920 (16:9) の AVD** を使う。最近の実機プロファイル（Pixel 7 = 1080x2400）は
# 2.22 倍で違反するので、そのまま使うとアップロードが弾かれる。
ANDROID_AVD="${ANDROID_SCREENSHOT_AVD:-}"

usage() { mobile_usage "${BASH_SOURCE[0]}"; }

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --platform)     PLATFORMS="${2:?--platform に ios|android|all が必要}"; shift 2 ;;
      --locales)      LOCALES="${2:?--locales にカンマ区切りのロケールが必要}"; shift 2 ;;
      --app-ios)      APP_IOS="${2:?--app-ios に .app のパスが必要}"; shift 2 ;;
      --app-android)  APP_ANDROID="${2:?--app-android に .apk のパスが必要}"; shift 2 ;;
      --skip-capture) DO_CAPTURE=0; shift ;;
      --upload)       DO_UPLOAD=1; shift ;;
      --dry-run)      DRY_RUN=1; shift ;;
      -h|--help)      usage; exit 0 ;;
      *)              mdie "未知のオプション: $1（--help 参照）" ;;
    esac
  done
  case "$PLATFORMS" in ios|android|all) : ;; *) mdie "--platform は ios|android|all" ;; esac
}

run() {
  if [ "$DRY_RUN" = 1 ]; then printf '  \033[0;90m$ %s\033[0m\n' "$*"; return 0; fi
  "$@"
}

# ── ロケールごとのメタ情報 ────────────────────────────────────────────────
# Maestro フローへ渡す文言と、各ストアのロケールコードの対応。
# アプリの翻訳（frontend/apps/mobile/src/shared/config/i18n/translations/）と
# **一致していないとフローが要素を見つけられずタイムアウトする**。
locale_meta() {
  case "$1" in
    en-US) LOCALE_LABEL="English"; HOME_TAB="Home";   EXPLORE_TAB="Explore"; PLAY_LOCALE="en-US" ;;
    ja)    LOCALE_LABEL="日本語";  HOME_TAB="ホーム"; EXPLORE_TAB="探索";    PLAY_LOCALE="ja-JP" ;;
    *)     mdie "未対応のロケール: $1（locale_meta に追加してください）" ;;
  esac
}

# ── 出力先 ────────────────────────────────────────────────────────────────
# store-listing/ が「ストアへ送る画像の正本」。store.sh のストア反映スクリプトが
# ここを読む（撮影経路が simulator でも Storybook でも同じ場所へ出す）。
#   iOS     : store-listing/ios/<asc-locale>/*.png
#             （端末クラスは**画像の実ピクセル**から引くのでファイル名は順序用でよい）
#   Android : store-listing/android/<play-locale>/phoneScreenshots/*.png
#             （ディレクトリ名がそのまま Play の imageType になる）
LISTING_DIR="$REPO_ROOT/store-listing"
IOS_SHOT_DIR="$LISTING_DIR/ios"
ANDROID_SHOT_DIR="$LISTING_DIR/android"
RAW_DIR="$REPO_ROOT/e2e-results/store-screenshots"

maestro_capture() {
  local platform="$1" locale="$2" out_dir="$3"
  locale_meta "$locale"

  mlog "撮影: platform=$platform locale=$locale"
  run env \
    APP_ID="$(app_id_for "$platform")" \
    LOCALE_LABEL="$LOCALE_LABEL" \
    HOME_TAB="$HOME_TAB" \
    EXPLORE_TAB="$EXPLORE_TAB" \
    SHOT_PREFIX="${locale}-" \
    maestro test "$REPO_ROOT/.maestro/store/screenshots.yaml" \
      --include-tags store-screenshots \
      --format junit \
      --output "$out_dir/report.xml"
}

# app.json から bundle identifier / package name を取る（設定の二重管理を避ける）
app_id_for() {
  local platform="$1" key
  case "$platform" in
    ios)     key='.expo.ios.bundleIdentifier' ;;
    android) key='.expo.android.package' ;;
  esac
  local id
  id="$(jq -r "$key // empty" "$REPO_ROOT/$MOBILE_APP_DIR/app.json")"
  [ -n "$id" ] || mdie "app.json に $key がありません（Expo の設定を先に埋めてください）"
  printf '%s' "$id"
}

# ── iOS ───────────────────────────────────────────────────────────────────
capture_ios() {
  [ "$(uname -s)" = "Darwin" ] || mdie "iOS の撮影は macOS + Xcode が必要です（--platform android を使ってください）"
  command -v xcrun >/dev/null || mdie "xcrun が見つかりません（Xcode をインストールしてください）"

  local app="$APP_IOS"
  [ -n "$app" ] || app="$(find "$REPO_ROOT/$MOBILE_APP_DIR" -maxdepth 3 -name '*.app' -type d 2>/dev/null | head -1)"
  [ -n "$app" ] || mdie "simulator 用の .app が見つかりません。--app-ios で渡すか、先に
  eas build --profile development-simulator --platform ios --local
を実行してください（ストア提出用 .ipa では simulator にインストールできません）"

  local IFS=$'\n'
  for device in $IOS_DEVICES; do
    mlog "iOS simulator を起動: $device"
    run xcrun simctl boot "$device" || true          # 既に起動済みなら失敗するので許容
    run xcrun simctl bootstatus "$device" -b
    run xcrun simctl install "$device" "$app"

    for locale in ${LOCALES//,/ }; do
      local out="$RAW_DIR/ios/$device/$locale"
      run mkdir -p "$out"
      ( cd "$out" && maestro_capture ios "$locale" "$out" )
    done
  done
}

# ── Android ───────────────────────────────────────────────────────────────
capture_android() {
  command -v adb >/dev/null || mdie "adb が見つかりません（devenv shell -P android で入ります）"

  local apk="$APP_ANDROID"
  [ -n "$apk" ] || apk="$(find "$REPO_ROOT/$MOBILE_APP_DIR" -maxdepth 3 -name '*.apk' 2>/dev/null | head -1)"
  [ -n "$apk" ] || mdie "emulator 用の .apk が見つかりません。--app-android で渡すか、先に
  eas build --profile preview --platform android --local
を実行してください（.aab は emulator にインストールできません）"

  if [ -z "$(adb devices | sed -n '2p')" ]; then
    [ -n "$ANDROID_AVD" ] || mdie "起動中の端末がありません。ANDROID_SCREENSHOT_AVD に
1080x1920 (16:9) の AVD 名を設定するか、手動でエミュレータを起動してください。
（Play は「最大辺 ≤ 最小辺 x2」を要求するため、1080x2400 の既定プロファイルでは弾かれます）"
    mlog "Android emulator を起動: $ANDROID_AVD"
    run sh -c "emulator -avd '$ANDROID_AVD' -no-snapshot -no-boot-anim &"
    run adb wait-for-device
  fi

  run adb install -r "$apk"

  for locale in ${LOCALES//,/ }; do
    local out="$RAW_DIR/android/$locale"
    run mkdir -p "$out"
    ( cd "$out" && maestro_capture android "$locale" "$out" )
  done
}

# ── 撮れた画像を store-listing/ へ配置 ────────────────────────────────────
organize() {
  mlog "store-listing/ へ配置"
  for locale in ${LOCALES//,/ }; do
    locale_meta "$locale"

    if [ "$PLATFORMS" != "android" ]; then
      run mkdir -p "$IOS_SHOT_DIR/$locale"
      # Maestro は takeScreenshot の名前で png を吐く。順序を保つため名前順でコピー。
      run sh -c "find '$RAW_DIR/ios' -path '*/$locale/*' -name '*.png' | sort | \
        awk '{printf \"%s\n\", \$0}' | while read -r f; do cp \"\$f\" '$IOS_SHOT_DIR/$locale/'; done"
    fi

    if [ "$PLATFORMS" != "ios" ]; then
      local dst="$ANDROID_SHOT_DIR/$PLAY_LOCALE/phoneScreenshots"
      run mkdir -p "$dst"
      run sh -c "find '$RAW_DIR/android/$locale' -name '*.png' | sort | \
        while read -r f; do cp \"\$f\" '$dst/'; done"
    fi
  done
}

validate() {
  mlog "ストア要求を検証"
  [ "$PLATFORMS" = "android" ] || run node "$SCRIPT_DIR/validate-screenshots.mjs" --platform ios "$IOS_SHOT_DIR"
  [ "$PLATFORMS" = "ios" ]     || run node "$SCRIPT_DIR/validate-screenshots.mjs" --platform android "$ANDROID_SHOT_DIR"
}

# ── アップロード ──────────────────────────────────────────────────────────
# EAS Metadata はスクリーンショットを扱えず（公式の対応表で "Upload screenshots ✗"）、
# Google Play のストア掲載情報にも対応しない。画像の反映経路はストアの API 直叩きだけ。
#
# ここでは各ストアの反映スクリプトへ委譲する（store.sh が資格情報の注入と dry-run を持つ）。
# **同じことをする経路を 2 つ持たない**ため、このスクリプトは撮影と検証に専念する。
upload() {
  local dry=()
  [ "$DRY_RUN" = 1 ] && dry=(--dry-run)

  if [ "$PLATFORMS" != "android" ]; then
    mlog "App Store Connect へスクリーンショットを反映"
    run bash "$SCRIPT_DIR/store.sh" push-ios-screenshots "${dry[@]}"
  fi

  if [ "$PLATFORMS" != "ios" ]; then
    # Play は文言と画像が同じ edit（トランザクション）なので、掲載情報ごと反映する
    mlog "Google Play へ掲載情報（文言 + 画像）を反映"
    run bash "$SCRIPT_DIR/store.sh" push-play-listing "${dry[@]}"
  fi
}

main() {
  mobile_load_config
  parse_args "$@"
  # シークレットは store.sh 側が SSM / env から注入する（このスクリプト自身は不要）。

  command -v maestro >/dev/null || mdie "maestro が見つかりません（devenv shell に入ってください）"

  if [ "$DO_CAPTURE" = 1 ]; then
    [ "$PLATFORMS" = "android" ] || capture_ios
    [ "$PLATFORMS" = "ios" ]     || capture_android
    organize
  else
    mlog "--skip-capture: 撮影をスキップし、既存の画像を検証します"
  fi

  validate

  if [ "$DO_UPLOAD" = 1 ]; then
    upload
    mok "アップロード完了"
  else
    mok "撮影と検証が完了（アップロードは --upload 指定時のみ）"
    mlog "出力: $IOS_SHOT_DIR / $ANDROID_SHOT_DIR"
  fi
}

main "$@"
