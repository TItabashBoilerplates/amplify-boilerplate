/**
 * Auth Feature - Public API
 */

export type { PasskeyCredential, SocialProvider } from './api'
// API（passkey / social）— Web/Native 共通のクライアント操作
export {
  deletePasskey,
  listPasskeys,
  registerPasskey,
  signInWithPasskey,
  signInWithSocial,
} from './api'
export type { AuthActionState } from './model/useAuthActions'
export { useAuthActions } from './model/useAuthActions'
