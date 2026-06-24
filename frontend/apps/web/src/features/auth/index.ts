/**
 * Auth Feature - Public API
 *
 * 認証機能のパブリックAPIです。
 * Feature Sliced Designの原則に従い、実装詳細を隠蔽し、
 * 明示的にエクスポートされたインターフェースのみを公開します。
 */

// API (Server Actions)
export { resendOtp, signInWithOtp, signOut, verifyOtp } from './api'

// Types
export type { AuthFormState, LoginFormProps, VerifyOTPFormProps } from './model/types'

// UI Components
export { LoginForm } from './ui/LoginForm'
export { VerifyOTPForm } from './ui/VerifyOTPForm'
