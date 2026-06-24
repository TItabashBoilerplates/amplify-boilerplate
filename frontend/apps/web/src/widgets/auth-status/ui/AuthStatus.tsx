'use client'

/**
 * 認証状態表示コンポーネント（デバッグ用）
 *
 * @module widgets/auth-status/ui/AuthStatus
 */

import { useAuth } from '@workspace/auth'

/**
 * 認証状態デバッグコンポーネント
 *
 * Zustandストアの認証状態を表示します（開発用）
 */
export function AuthStatus() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="rounded-md border border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground">Not authenticated</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">Auth Store State</h3>
      <div className="space-y-1 text-sm">
        <p>
          <span className="font-medium">Authenticated:</span>{' '}
          <span className="text-green-600">✓ Yes</span>
        </p>
        <p>
          <span className="font-medium">User Email:</span> {user?.email || 'N/A'}
        </p>
        <p>
          <span className="font-medium">User ID:</span> {user?.id || 'N/A'}
        </p>
      </div>
    </div>
  )
}
