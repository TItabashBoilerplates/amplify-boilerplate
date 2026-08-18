import { resolveAuthError } from '../validation'
import type { AuthFailure } from './types'

/**
 * throw された Cognito の例外を `AuthFailure` に落とす（api/ 共通の Boundary）。
 *
 * **必ずログを出す**（`.claude/rules/error-handling.md`: catch したら必ずログ）。
 * ユーザーに見せるのは i18n キーだけで、SDK の原文は `console.error` にのみ出す。
 *
 * @param context - どの操作で失敗したか（ログの見出し）
 * @param error - catch した値（`unknown`）
 * @param options.hideAccountExistence - アカウントの存在を暴露しうるエラーを
 *   一般的な文言へ丸める。**パスワード再設定・サインアップでは必ず true**
 *   （ユーザー列挙攻撃の入口になる。`.claude/rules/auth.md` §3.2）
 */
export function toAuthFailure(
  context: string,
  error: unknown,
  options: { hideAccountExistence?: boolean } = {}
): AuthFailure {
  const resolved = resolveAuthError(error as { name?: unknown; message?: unknown })

  console.error(`[auth] ${context} failed:`, {
    name: resolved?.name,
    message: resolved?.raw,
  })

  if (!resolved) {
    return { success: false, errorKey: 'unexpected' }
  }

  if (options.hideAccountExistence && resolved.revealsAccountExistence) {
    // 成功時と区別が付かないよう、専用の文言を返さない
    return { success: false, errorKey: 'unexpected' }
  }

  return {
    success: false,
    errorKey: resolved.messageKey,
    requiresPasswordReset: resolved.requiresPasswordReset,
    requiresConfirmation: resolved.requiresConfirmation,
  }
}
