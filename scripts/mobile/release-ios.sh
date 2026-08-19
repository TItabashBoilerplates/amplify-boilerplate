#!/usr/bin/env bash
# iOS を「ビルド → App Store Connect（TestFlight）」まで通す。
#
#   mobile-release-ios                     # expo.dev（EAS クラウド）でビルド → 提出（~20-30分）
#   mobile-release-ios --local             # ローカルビルド（macOS + Xcode。EAS のビルド枠を消費しない）
#   mobile-release-ios --ipa <path|url>    # 既存の .ipa を再提出（ビルドしない）
#   mobile-release-ios --metadata-only     # store.config.js を ASC へ同期するだけ
#   mobile-release-ios --dry-run           # 何を実行するかだけ表示
#
# 何をするか:
#   1. SSM Parameter Store / env から secrets を読み込む
#   2. App Store Connect API キー(.p8) を実行中だけ復元（終了時に必ず削除）
#   3. eas.json の submit プロファイルへ ASC 資格情報を注入（終了時に必ず復元）
#   4. EXPO_PUBLIC_* を EAS の Environment Variables へ push（ビルドに焼き込む）
#   5. iOS ビルド（クラウド or ローカル）→ .ipa を取得
#   6. App Store Connect へ提出（既定 `eas submit`。`--submit-via altool` で Apple 公式 CLI）
#   7. store.config.js があれば App Store メタデータを同期
#
# 事前に一度だけ必要な手作業（公開 API では自動化できない）:
#   - Apple Developer で Bundle ID を登録
#   - App Store Connect にアプリレコードを作成し、その **ASC App ID** を
#     scripts/mobile/config.env の APPLE_ASC_APP_ID に記入
#     （未作成だと `No suitable application records found` で落ちる）
#
# 必要なシークレット（SSM Parameter Store。値はログに出さない）:
#   EXPO_TOKEN … EAS 認証 / APPLE_API_KEY … ASC Key ID / APPLE_API_ISSUER … Issuer ID
#   APPLE_API_KEY_P8 … ASC API キー(.p8。base64 でも PEM でも可) / APPLE_TEAM_ID
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/mobile/lib.sh
. "$SCRIPT_DIR/lib.sh"

BUILD_MODE="cloud"
IPA_INPUT=""
METADATA_ONLY=0
SUBMIT_VIA="${IOS_SUBMIT_VIA:-eas}"
PUSH_ENV=1
DRY_RUN=0

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --local)          BUILD_MODE="local"; shift ;;
      --cloud)          BUILD_MODE="cloud"; shift ;;
      --ipa)            IPA_INPUT="${2:?--ipa に path か URL が必要}"; shift 2 ;;
      --metadata-only)  METADATA_ONLY=1; shift ;;
      --submit-via)     SUBMIT_VIA="${2:?--submit-via に eas|altool が必要}"; shift 2 ;;
      --profile)        EAS_PROFILE="${2:?--profile に値が必要}"; shift 2 ;;
      --skip-env-push)  PUSH_ENV=0; shift ;;
      --dry-run)        DRY_RUN=1; shift ;;
      -h|--help)        mobile_usage "${BASH_SOURCE[0]}"; exit 0 ;;
      *)                mdie "未知のオプション: $1（--help 参照）" ;;
    esac
  done
  case "$SUBMIT_VIA" in eas|altool) : ;; *) mdie "--submit-via は eas か altool" ;; esac
}

# ── eas.json の汚染対策 ──────────────────────────────────────────────────
# eas.json は **コミット対象**だが、ASC 資格情報を渡す CLI フラグが無く、
# eas.json は環境変数展開にも対応していないため、実行中だけ注入するしかない。
# SIGKILL 等で trap が走らないと注入が残るので、**バックアップを取る前に必ず洗う**
# （洗わずに backup すると「復元しても汚れたまま」が恒久化する）。
INJECTED_KEYS='ascApiKeyPath|ascApiKeyId|ascApiKeyIssuerId|ascAppId|credentialsSource'
eas_json_polluted() { grep -qE "\"($INJECTED_KEYS)\"" "$EAS_JSON"; }
restore_eas_json_from_git() {
  git -C "$REPO_ROOT" checkout -- "$EAS_JSON" 2>/dev/null \
    || mwarn "eas.json を git から戻せませんでした。手動で確認してください"
}

cleanup() {
  if [ -f "$EAS_JSON_BACKUP" ]; then mv -f "$EAS_JSON_BACKUP" "$EAS_JSON"; fi
  # バックアップ自体が汚染されていた場合（前回 SIGKILL → その状態を今回 cp した場合）は
  # 戻しても汚染版のまま。最後に必ず実物を見る。
  if eas_json_polluted; then restore_eas_json_from_git; fi
  rm -f "$P8_PATH" "$IPA_PATH" "$APP_DIR/.env.eas"
  rmdir "$CRED_DIR" 2>/dev/null || true
  return 0
}

inject_eas_json() {
  APPLE_API_KEY="$APPLE_API_KEY" APPLE_API_ISSUER="$APPLE_API_ISSUER" \
  APPLE_ASC_APP_ID="$ASC_APP_ID" EAS_PROFILE="$EAS_PROFILE" \
  python3 - "$EAS_JSON" <<'PY'
import json, os, sys
path = sys.argv[1]
with open(path) as f:
    cfg = json.load(f)
profile = os.environ['EAS_PROFILE']
ios = cfg.setdefault('submit', {}).setdefault(profile, {}).setdefault('ios', {})
ios['ascApiKeyPath'] = './credentials/asc_api_key.p8'
ios['ascApiKeyId'] = os.environ['APPLE_API_KEY']
ios['ascApiKeyIssuerId'] = os.environ['APPLE_API_ISSUER']
ios['ascAppId'] = os.environ['APPLE_ASC_APP_ID']
# credentials.json（ローカル保持の証明書 / プロファイル）がある構成では明示する。
# 無いと EAS はリモート credentials を参照し、初回に対話確認を要求して非対話ビルドが落ちる。
if os.path.exists(os.path.join(os.path.dirname(path), 'credentials.json')):
    cfg.setdefault('build', {}).setdefault(profile, {})['credentialsSource'] = 'local'
    print('→ credentials.json を検出。credentialsSource=local で非対話ビルドします')
with open(path, 'w') as f:
    json.dump(cfg, f, indent=2)
    f.write('\n')
print('→ eas.json へ ASC 資格情報を注入（終了時に復元）')
PY
}

build_cloud() {
  mlog "EAS クラウドビルド開始（profile=${EAS_PROFILE}・~20-30分）..."
  local json url
  json="$(cd "$APP_DIR" && eas_cli build --platform ios --profile "$EAS_PROFILE" --json --non-interactive)" \
    || mdie "クラウドビルドに失敗"
  url="$(printf '%s' "$json" | mobile_artifact_url)"
  if [ -z "$url" ]; then
    printf '%s\n' "$json" >&2
    mdie "ビルドは終わったが .ipa の URL を取得できません（上の出力を確認）"
  fi
  mlog ".ipa をダウンロード..."
  curl -fsSL -o "$IPA_PATH" "$url" || mdie ".ipa のダウンロードに失敗"
}

build_local() {
  # devenv(Nix) の C/リンカ env が xcodebuild に干渉して壊れる（`expo run:ios` が
  # -index-store-path で落ちるのと同じ原因）ため、Apple のツールチェーンに固定する。
  # fastlane の `xcodebuild -showBuildSettings` は既定 3 秒 × 4 回しかなく、
  # SPM の依存解決直後などは平気で超えて "unknown error" で落ちる。公式の env で伸ばす。
  mlog "ローカルビルド開始（eas build --local・EAS のビルド枠を消費しない・~20-40分）..."
  env -u SDKROOT -u MACOSX_DEPLOYMENT_TARGET -u LD -u LDFLAGS \
      -u CC -u CXX -u CFLAGS -u CXXFLAGS -u CPPFLAGS -u OBJC -u OBJCXX \
      -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS -u NIX_CC -u NIX_BINTOOLS \
      -u NIX_HARDENING_ENABLE -u NIX_APPLE_SDK_VERSION -u DEVELOPER_DIR \
      DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
      PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" \
      FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT="${FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT:-180}" \
      FASTLANE_XCODEBUILD_SETTINGS_RETRIES="${FASTLANE_XCODEBUILD_SETTINGS_RETRIES:-5}" \
    bash -c 'cd "$1" && pnpm dlx "$2" build --platform ios --profile "$3" --local --non-interactive --output "$4"' \
      _ "$APP_DIR" "$EAS_CLI_SPEC" "$EAS_PROFILE" "$IPA_PATH" \
    || mdie "ローカルビルドに失敗"
}

submit_via_eas() {
  mlog "eas submit で App Store Connect へ提出（ascAppId=${ASC_APP_ID}）..."
  ( cd "$APP_DIR" && eas_cli submit --platform ios --profile "$EAS_PROFILE" \
      --path "$IPA_PATH" --non-interactive ) \
    || mdie "eas submit に失敗"
}

submit_via_altool() {
  # `--use-old-altool` は Xcode 26.x の新アップローダが正常な .ipa を ITMS-90207 と
  # 誤判定する既知バグの回避で、Apple 自身が用意した公式フラグ。
  # EAS の submit キューが混んでいるときの逃げ道として用意している（macOS 専用）。
  command -v xcrun >/dev/null 2>&1 || mdie "altool には macOS + Xcode が必要です（--submit-via eas を使ってください）"
  mkdir -p "$HOME/.appstoreconnect/private_keys"
  cp "$P8_PATH" "$HOME/.appstoreconnect/private_keys/AuthKey_${APPLE_API_KEY}.p8"
  mlog "altool で App Store Connect へアップロード..."
  env -u SDKROOT -u MACOSX_DEPLOYMENT_TARGET -u LD -u LDFLAGS -u CFLAGS -u CPPFLAGS \
      -u NIX_CFLAGS_COMPILE -u NIX_LDFLAGS \
      DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
    xcrun altool --upload-app --type ios --file "$IPA_PATH" \
      --apiKey "$APPLE_API_KEY" --apiIssuer "$APPLE_API_ISSUER" --use-old-altool \
    || mdie "altool でのアップロードに失敗"
}

push_metadata() {
  [ -f "$APP_DIR/store.config.js" ] || return 0
  mlog "App Store メタデータを同期（eas metadata:push）..."
  ( cd "$APP_DIR" && eas_cli metadata:push --profile "$EAS_PROFILE" --non-interactive ) \
    || mwarn "metadata push に失敗（編集可能な version があるか確認）。ビルド配信自体は成功しています。"
}

main() {
  mobile_load_config
  parse_args "$@"
  mobile_load_secrets

  EAS_JSON="$APP_DIR/eas.json"
  EAS_JSON_BACKUP="$EAS_JSON.orig"
  P8_PATH="$CRED_DIR/asc_api_key.p8"
  IPA_PATH="$CRED_DIR/build.ipa"

  [ -f "$EAS_JSON" ] || mdie "eas.json がありません: ${MOBILE_APP_DIR}/eas.json"

  mobile_require_expo_token
  : "${APPLE_API_ISSUER:?APPLE_API_ISSUER がありません（SSM / env）}"
  : "${APPLE_API_KEY:?APPLE_API_KEY(=ASC Key ID) がありません（SSM / env）}"
  : "${APPLE_API_KEY_P8:?APPLE_API_KEY_P8 がありません（SSM / env）}"

  # Team ID は ASC API キーからは自動検出できず EAS に明示が要る。
  if [ -z "${APPLE_TEAM_ID:-}" ] && [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
    APPLE_TEAM_ID="$(printf '%s' "$APPLE_SIGNING_IDENTITY" | grep -oE '\(([A-Z0-9]{10})\)' | tr -d '()' | head -1)"
  fi
  : "${APPLE_TEAM_ID:?APPLE_TEAM_ID を取得できません（SSM に登録してください）}"

  # ASC App ID は App Store の URL に出る**公開値**なのでシークレットではない。
  # アプリ固有なので config.env（非機密設定）に置く。
  ASC_APP_ID="${APPLE_ASC_APP_ID:?APPLE_ASC_APP_ID が未設定です（scripts/mobile/config.env）}"

  local environment; environment="$(mobile_eas_environment)"
  printf '\n'
  mlog "app         : $MOBILE_APP_DIR"
  mlog "profile     : $EAS_PROFILE (EAS environment: $environment)"
  mlog "build       : $([ -n "$IPA_INPUT" ] && echo '既存 .ipa を再利用' || echo "$BUILD_MODE")"
  mlog "submit      : $SUBMIT_VIA"
  mlog "asc app id  : $ASC_APP_ID"
  printf '\n'

  mobile_init_credentials
  trap cleanup EXIT INT TERM

  # バックアップの前に洗う（前回の異常終了で残った注入を恒久化させない）
  if eas_json_polluted; then
    mwarn "eas.json に前回の注入が残っています。git の内容へ戻してから続けます。"
    restore_eas_json_from_git
  fi
  cp -p "$EAS_JSON" "$EAS_JSON_BACKUP"

  mobile_write_secret_file "$APPLE_API_KEY_P8" "$P8_PATH" 'BEGIN PRIVATE KEY'
  inject_eas_json

  # 資格情報を ASC API キーで非対話生成できるようにする。
  # eas-cli の capability 自動 sync は Apple API に不正形式を送って失敗することがあるため無効化し、
  # capability は Apple Developer ポータルで手動管理する。
  export EXPO_ASC_API_KEY_PATH="$P8_PATH"
  export EXPO_ASC_KEY_ID="$APPLE_API_KEY"
  export EXPO_ASC_ISSUER_ID="$APPLE_API_ISSUER"
  export EXPO_APPLE_TEAM_ID="$APPLE_TEAM_ID"
  export EXPO_APPLE_TEAM_TYPE="${EXPO_APPLE_TEAM_TYPE:-COMPANY_OR_ORGANIZATION}"
  export EXPO_NO_CAPABILITY_SYNC=1

  if [ "$DRY_RUN" -eq 1 ]; then
    mok "[dry-run] 注入後の submit プロファイル:"
    python3 -c "
import json
print(json.dumps(json.load(open('$EAS_JSON'))['submit'], indent=2, ensure_ascii=False))
" | sed -E 's/(ascApiKeyId|ascApiKeyIssuerId|ascAppId)": ".*"/\1": "***"/'
    if [ "$PUSH_ENV" -eq 1 ]; then mobile_push_public_env "$environment" dry; fi
    mok "[dry-run] ここで終了（ビルド・提出は実行していません）"
    return 0
  fi

  if [ "$PUSH_ENV" -eq 1 ]; then mobile_push_public_env "$environment"; fi

  if [ "$METADATA_ONLY" -eq 1 ]; then
    push_metadata
    mok "メタデータのみ同期しました。"
    return 0
  fi

  if [ -n "$IPA_INPUT" ]; then
    case "$IPA_INPUT" in
      http://*|https://*) mlog "既存 .ipa をダウンロード..."; curl -fsSL -o "$IPA_PATH" "$IPA_INPUT" ;;
      *) [ -f "$IPA_INPUT" ] || mdie ".ipa が見つかりません: $IPA_INPUT"; cp "$IPA_INPUT" "$IPA_PATH" ;;
    esac
  elif [ "$BUILD_MODE" = "local" ]; then
    build_local
  else
    build_cloud
  fi
  [ -f "$IPA_PATH" ] || mdie ".ipa が生成されていません: $IPA_PATH"
  mok "成果物: $(wc -c <"$IPA_PATH" | tr -d ' ') bytes"

  if [ "$SUBMIT_VIA" = "altool" ]; then submit_via_altool; else submit_via_eas; fi

  printf '\n'
  mok "アップロード完了。Apple の Processing（数分〜30分）後に TestFlight に反映されます。"
  push_metadata
}

main "$@"
