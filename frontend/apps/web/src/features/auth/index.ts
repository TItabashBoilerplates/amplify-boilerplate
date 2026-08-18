/**
 * Auth Feature - Public API
 *
 * 認証機能のパブリック API。Feature Sliced Design の原則に従い、実装詳細を隠蔽し、
 * 明示的にエクスポートされたインターフェースのみを公開する。
 *
 * **Cognito を呼ぶ API 層は `@workspace/auth/api`（Web / Mobile 共有）にある。**
 * ここから再エクスポートしない（`.claude/rules/clean-code.md`: 互換レイヤー禁止）。
 *
 * **必須導線**（`.claude/rules/auth.md` §2）は
 * `model/required-flows.test.ts` が静的に検査している。エクスポートを消すと落ちる。
 */

// Types（Web の UI 固有）
export type { AuthFormState, AuthResult, LoginFormProps, VerifyOTPFormProps } from './model/types'
// UI Components
export { AuthMessage } from './ui/AuthMessage'
export { ChangeEmailForm } from './ui/ChangeEmailForm'
export { ChangePasswordForm } from './ui/ChangePasswordForm'
export { CodeField } from './ui/CodeField'
export { ConfirmSignUpForm } from './ui/ConfirmSignUpForm'
export { DeleteAccountForm } from './ui/DeleteAccountForm'
export { EmailField } from './ui/EmailField'
export { ForgotPasswordForm } from './ui/ForgotPasswordForm'
export { LoginForm } from './ui/LoginForm'
export { PasskeyManager } from './ui/PasskeyManager'
export { PasswordField } from './ui/PasswordField'
export { PasswordLoginForm } from './ui/PasswordLoginForm'
export { SignUpForm } from './ui/SignUpForm'
export { SocialSignInButtons } from './ui/SocialSignInButtons'
export { UpdatePasswordForm } from './ui/UpdatePasswordForm'
export { VerifyOTPForm } from './ui/VerifyOTPForm'
