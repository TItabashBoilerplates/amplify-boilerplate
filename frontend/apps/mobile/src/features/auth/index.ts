/**
 * Mobile 認証 feature の Public API
 *
 * `.claude/rules/auth.md` が要求する導線一式:
 * - `SignInForm` … メール + パスワード（審査で使われる主経路）
 * - `SignUpForm` … 登録 + 確認コード
 * - `ForgotPasswordForm` … ログイン画面から到達（6 桁コード方式）
 * - `ChangePasswordForm` / `ChangeEmailForm` / `DeleteAccountForm` … 設定画面から到達
 *
 * **Cognito を呼ぶ API 層は `@workspace/auth/api`（Web と共有）**。
 * ここから再エクスポートしない（`.claude/rules/clean-code.md`）。
 */
export type { AuthResult, AuthSuccessKey, AuthValidationKey } from './model/types'
export { AuthField } from './ui/AuthField'
export { AuthMessage } from './ui/AuthMessage'
export { ChangeEmailForm } from './ui/ChangeEmailForm'
export { ChangePasswordForm } from './ui/ChangePasswordForm'
export { DeleteAccountForm } from './ui/DeleteAccountForm'
export { ForgotPasswordForm } from './ui/ForgotPasswordForm'
export { PasswordRequirements } from './ui/PasswordRequirements'
export { SignInForm } from './ui/SignInForm'
export { SignUpForm } from './ui/SignUpForm'
