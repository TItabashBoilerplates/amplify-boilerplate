/**
 * User Entity - Public API
 *
 * ユーザーエンティティのパブリックAPIです。
 * Feature Sliced Designの原則に従い、エンティティの実装詳細を隠蔽し、
 * 明示的にエクスポートされたインターフェースのみを公開します。
 */

// Hooks
export { useAuthUser, useUser } from './model/hooks'

// Store
export { useUserStore } from './model/store'
// Types
export type { AuthUser, User } from './model/types'

// UI Components
export { UserAvatar } from './ui/UserAvatar'
