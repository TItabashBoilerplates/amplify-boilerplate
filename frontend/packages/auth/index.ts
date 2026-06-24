/**
 * @workspace/auth - 認証ライブラリ
 *
 * Amplify (Cognito) の認証状態を Zustand で管理する共通パッケージ。
 * フレームワーク非依存（Web 用 `AuthProvider` / Native 用 `NativeAuthProvider` を提供）。
 *
 * @packageDocumentation
 */

// Hooks（セレクタ付き）
export { useAuth, useAuthUser, useIsAuthenticated } from './hooks'
// Providers（Web）
export { AuthProvider } from './providers/AuthProvider'
// Store
export { useAuthStore } from './store/authStore'
export type { AuthState, AuthUser } from './store/authStore'
