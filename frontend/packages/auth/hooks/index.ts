/**
 * 認証フック - Public API
 *
 * フレームワーク非依存のフックのみ
 * Next.js 固有の useRequireAuth は apps/web に移動済み
 *
 * @module @workspace/auth/hooks
 */

export { useAuthStore } from '../store/authStore'
export { useAuth } from './useAuth'
