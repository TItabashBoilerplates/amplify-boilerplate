/**
 * Auth API - Public API
 *
 * `aws-amplify/auth` の呼び出しを 1 関数 1 ファイルで包み、**i18n キーを返す**
 * 共通の戻り値（`AuthResult`）に揃える層。SDK は throw するため、ここが
 * Boundary として catch + ログ出力を担う（`.claude/rules/error-handling.md`）。
 */

export { changeEmail } from './changeEmail'
export { changePassword } from './changePassword'
export { confirmEmailChange } from './confirmEmailChange'
export { confirmPasswordReset } from './confirmPasswordReset'
export { confirmSignUpCode } from './confirmSignUpCode'
export { deleteAccount } from './deleteAccount'
export { requestPasswordReset } from './requestPasswordReset'
export { resendOtp } from './resendOtp'
export { resendSignUpConfirmation } from './resendSignUpConfirmation'
export { signInWithOtp } from './signInWithOtp'
export { type SignInNextStep, signInWithPassword } from './signInWithPassword'
export { signOut } from './signOut'
export { type SignUpNextStep, signUpWithPassword } from './signUpWithPassword'
export { verifyOtp } from './verifyOtp'
