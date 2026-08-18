/**
 * 認証フォームの検証・エラー変換（Web / Mobile 共有）
 *
 * Web (`apps/web`) と Mobile (`apps/mobile`) の両方から使う。**同じ規則を
 * 2 か所に書かない**ための共有層（`.claude/rules/clean-code.md`）。
 *
 * UI は各プラットフォームで別実装だが、**「何を妥当とするか」は 1 か所**に置く。
 *
 * @packageDocumentation
 */

export { isValidEmail, normalizeEmail } from './email'
export {
  AUTH_ERROR_MESSAGE_KEYS,
  type AuthErrorMessageKey,
  type ResolvedAuthError,
  resolveAuthError,
} from './errors'
export {
  AUTH_SUCCESS_KEYS,
  AUTH_VALIDATION_KEYS,
  type AuthSuccessKey,
  type AuthValidationKey,
} from './message-keys'
export {
  getPasswordIssues,
  isPasswordValid,
  PASSWORD_ISSUES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SYMBOLS,
  type PasswordIssue,
  passwordsMatch,
} from './password'
