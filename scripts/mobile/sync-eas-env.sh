#!/usr/bin/env bash
# 現在の env にある EXPO_PUBLIC_* を EAS の Environment Variables へ同期する（ビルドはしない）。
#
#   sync-eas-env production      # → EAS production
#   sync-eas-env staging         # → EAS preview
#   sync-eas-env dev             # → EAS development
#   DRY_RUN=1 sync-eas-env production   # 対象キーを表示するだけ
#
# なぜ必要か:
#   eas.json の各ビルドプロファイルは `"environment": "production"` 等で **EAS 側の**
#   Environment Variables を参照する。ローカルの env はビルドマシンには届かないので、
#   ここで橋渡しする。無いとその値を使う画面がビルド済みアプリでクラッシュする。
#
#   ⚠️ Amplify backend の接続情報（Cognito / AppSync / S3）はここで運ばない。
#   `amplify_outputs.json` が正本で、env に複製すると二重管理になる
#   （`.claude/rules/env-naming.md` §4）。
#
# release-ios.sh / release-android.sh はビルド前に同じ処理を自動で行うので、
# 通常このスクリプトを単体で叩く必要はない（EAS 側の値だけ直したいときに使う）。
#
# 同期対象は env にある EXPO_PUBLIC_* **全部**。この prefix は「バンドルに出てよい公開値」を
# 意味するので、prefix 自体が安全性の判定条件になっている。サーバ側 secret は
# この prefix を持たないので自動的に除外される。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/mobile/lib.sh
. "$SCRIPT_DIR/lib.sh"

main() {
  mobile_load_config

  # 引数を優先する。`ENV` はシェル起動ごとに外部から上書きされることがあるため
  # （devenv の enterShell が ENV=local を入れる）、引数で明示できるようにしてある。
  local target="${1:-${ENV:-}}"
  case "$target" in
    production|staging|dev) ENV="$target"; export ENV ;;
    *)
      mdie "対象環境を指定してください: production | staging | dev（例: sync-eas-env production）" ;;
  esac

  mobile_load_secrets
  mobile_require_expo_token

  local environment; environment="$(mobile_eas_environment)"
  mlog "env → EAS[${environment}]"
  mobile_push_public_env "$environment" "${DRY_RUN:-}"

  printf '\n'
  mok "確認: cd ${MOBILE_APP_DIR} && pnpm dlx ${EAS_CLI_SPEC} env:list --environment ${environment}"
}

main "$@"
