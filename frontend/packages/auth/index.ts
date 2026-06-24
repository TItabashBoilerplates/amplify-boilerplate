/**
 * @workspace/auth - 認証ライブラリ
 *
 * Supabase認証をZustandで管理するための共通パッケージ
 * フレームワーク非依存（Next.js 固有の useRequireAuth は apps/web に移動済み）
 *
 * @packageDocumentation
 */

// Hooks
export { useAuth } from './hooks'
// Providers
export { AuthProvider } from './providers/AuthProvider'
export type { AuthState } from './store/authStore'
// Store
export { useAuthStore } from './store/authStore'
