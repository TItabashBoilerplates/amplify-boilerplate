#!/usr/bin/env bash
# Android を「ビルド → Google Play」まで通す。
#
#   mobile-release-android                  # expo.dev（EAS クラウド）でビルド → 提出
#   mobile-release-android --local          # ローカルビルド（EAS のビルド枠を消費しない）
#   mobile-release-android --aab <path>     # 既存 AAB を提出するだけ
#   mobile-release-android --dry-run        # 何を実行するかだけ表示
#
# 何をするか:
#   1. SSM Parameter Store / env から secrets を読み込む
#   2. Play のサービスアカウント鍵を実行中だけ復元（終了時に必ず削除）
#      → eas.json の submit.<profile>.android.serviceAccountKeyPath がこのパスを指す
#   3. EXPO_PUBLIC_* を EAS の Environment Variables へ push
#   4. Android ビルド（クラウド or ローカル）→ .aab を取得
#   5. eas submit で Play へ提出
#
# 署名鍵は **EAS がリモートに保持する keystore** を使う（`--local` でも EXPO_TOKEN で取得する）。
# iOS のような credentials.json はデフォルトでは使わない。
#
# 提出は eas.json の `releaseStatus: draft` で止まる。**配布の開始は Play Console で手動**
# （いきなりテスターへ配られないようにするため）。
#
# 事前に一度だけ必要な手作業:
#   - Play Console にアプリを作成し、サービスアカウントへ権限を付与
#   - サービスアカウント鍵(JSON) を SSM の PLAY_SERVICE_ACCOUNT_JSON に登録（base64 可）
#
# ローカルビルドに必要なツールチェーン（無ければ明示的に落とす。黙って別の JDK を拾わない）:
#   - JDK 17（devenv が提供。`devenv shell -P android`）
#   - Android SDK（ANDROID_HOME。app.json の targetSdkVersion に対応する platforms/ が要る）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/mobile/lib.sh
. "$SCRIPT_DIR/lib.sh"

BUILD_MODE="cloud"
AAB_INPUT=""
PUSH_ENV=1
DRY_RUN=0

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --local)         BUILD_MODE="local"; shift ;;
      --cloud)         BUILD_MODE="cloud"; shift ;;
      --aab)           AAB_INPUT="${2:?--aab に path が必要}"; shift 2 ;;
      --profile)       EAS_PROFILE="${2:?--profile に値が必要}"; shift 2 ;;
      --skip-env-push) PUSH_ENV=0; shift ;;
      --dry-run)       DRY_RUN=1; shift ;;
      -h|--help)       mobile_usage "${BASH_SOURCE[0]}"; exit 0 ;;
      *)               mdie "未知のオプション: $1（--help 参照）" ;;
    esac
  done
}

cleanup() {
  rm -f "$KEY_PATH" "$AAB_PATH" "$APP_DIR/.env.eas"
  rmdir "$CRED_DIR" 2>/dev/null || true
  return 0
}

# app.json / app.config.ts の targetSdkVersion に対応する platform が入っているかを見る。
# 入っていないと Gradle が分かりにくいエラーで落ちるので、先に落とす。
require_android_toolchain() {
  if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
    mdie "JAVA_HOME が未設定です。'devenv shell -P android -- mobile-release-android --local' で実行してください"
  fi
  if ! "$JAVA_HOME/bin/java" -version 2>&1 | head -1 | grep -q '"17\.'; then
    mwarn "JDK 17 以外が使われています: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
  fi
  export PATH="$JAVA_HOME/bin:$PATH"

  ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  [ -d "$ANDROID_HOME/platforms" ] \
    || mdie "Android SDK が見つかりません（ANDROID_HOME=$ANDROID_HOME）"
  local target
  target="$(python3 -c "
import json, re, sys
try:
    cfg = json.load(open('$APP_DIR/app.json'))
except Exception:
    sys.exit(0)
for p in cfg.get('expo', {}).get('plugins', []):
    if isinstance(p, list) and p[0] == 'expo-build-properties':
        print((p[1].get('android') or {}).get('targetSdkVersion') or '')
" 2>/dev/null || true)"
  if [ -n "$target" ] && [ ! -d "$ANDROID_HOME/platforms/android-${target}" ]; then
    mdie "platforms/android-${target} がありません。sdkmanager で 'platforms;android-${target}' を入れてください"
  fi
  export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
  mok "JDK: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
  mok "Android SDK: $ANDROID_HOME"
}

build_cloud() {
  mlog "EAS クラウドビルド開始（profile=${EAS_PROFILE}）..."
  local json url
  json="$(cd "$APP_DIR" && eas_cli build --platform android --profile "$EAS_PROFILE" --json --non-interactive)" \
    || mdie "クラウドビルドに失敗"
  url="$(printf '%s' "$json" | mobile_artifact_url)"
  if [ -z "$url" ]; then
    printf '%s\n' "$json" >&2
    mdie "ビルドは終わったが成果物の URL を取得できません（上の出力を確認）"
  fi
  mlog "成果物をダウンロード..."
  curl -fsSL -o "$AAB_PATH" "$url" || mdie "成果物のダウンロードに失敗"
}

build_local() {
  require_android_toolchain
  # ⚠️ macOS の /tmp は /private/tmp へのシンボリックリンク。EAS のローカルビルドは既定で
  #    /tmp 配下にプロジェクトを複製するが、CMake と Ninja が論理パスと物理パスを取り違えて
  #    .so を見失い、`ninja: error: ... libworklets.so ... missing` で必ず落ちる
  #    （expo/expo#42893 / software-mansion/react-native-reanimated#9151）。
  #    シンボリックリンクを経由しない場所を明示して回避する。
  export EAS_LOCAL_BUILD_WORKINGDIR="${EAS_LOCAL_BUILD_WORKINGDIR:-$HOME/.cache/eas-build}"
  mkdir -p "$EAS_LOCAL_BUILD_WORKINGDIR"
  mlog "ビルド作業ディレクトリ: $EAS_LOCAL_BUILD_WORKINGDIR"

  mlog "ローカルビルド開始（eas build --local・EAS のビルド枠を消費しない）..."
  ( cd "$APP_DIR" && eas_cli build --platform android --profile "$EAS_PROFILE" \
      --local --non-interactive --output "$AAB_PATH" ) \
    || mdie "ローカルビルドに失敗"
}

main() {
  mobile_load_config
  parse_args "$@"
  mobile_load_secrets

  KEY_PATH="$CRED_DIR/play-sa.json"
  AAB_PATH="$CRED_DIR/build.aab"

  [ -f "$APP_DIR/eas.json" ] || mdie "eas.json がありません: ${MOBILE_APP_DIR}/eas.json"
  mobile_require_expo_token
  : "${PLAY_SERVICE_ACCOUNT_JSON:?PLAY_SERVICE_ACCOUNT_JSON がありません（SSM / env）}"

  local environment; environment="$(mobile_eas_environment)"
  printf '\n'
  mlog "app     : $MOBILE_APP_DIR"
  mlog "profile : $EAS_PROFILE (EAS environment: $environment)"
  mlog "build   : $([ -n "$AAB_INPUT" ] && echo '既存 AAB を再利用' || echo "$BUILD_MODE")"
  printf '\n'

  mobile_init_credentials
  trap cleanup EXIT INT TERM
  mobile_write_secret_file "$PLAY_SERVICE_ACCOUNT_JSON" "$KEY_PATH" '"service_account"'

  if [ "$DRY_RUN" -eq 1 ]; then
    if [ "$PUSH_ENV" -eq 1 ]; then mobile_push_public_env "$environment" dry; fi
    mok "[dry-run] ここで終了（ビルド・提出は実行していません）"
    return 0
  fi

  if [ "$PUSH_ENV" -eq 1 ]; then mobile_push_public_env "$environment"; fi

  if [ -n "$AAB_INPUT" ]; then
    [ -f "$AAB_INPUT" ] || mdie "AAB が見つかりません: $AAB_INPUT"
    cp "$AAB_INPUT" "$AAB_PATH"
  elif [ "$BUILD_MODE" = "local" ]; then
    build_local
  else
    build_cloud
  fi
  [ -f "$AAB_PATH" ] || mdie "成果物が生成されていません: $AAB_PATH"
  mok "成果物: $AAB_PATH ($(du -h "$AAB_PATH" | cut -f1))"

  mlog "Play へ提出（eas submit）..."
  ( cd "$APP_DIR" && eas_cli submit --platform android --profile "$EAS_PROFILE" \
      --path "$AAB_PATH" --non-interactive ) \
    || mdie "eas submit に失敗（Play Console のアプリ作成とサービスアカウント権限を確認）"

  printf '\n'
  mok "提出しました。Play Console → テスト → 内部テスト で確認し、"
  mok "リリースを手動で開始してテスターへ配布してください（draft で止めてあります）。"
}

main "$@"
