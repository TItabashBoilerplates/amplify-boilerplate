'use client'

/**
 * useRequireAuth - 認証必須フック (Next.js専用)
 *
 * @module @/shared/hooks/useRequireAuth
 */

import { useAuthStore } from '@workspace/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * 認証必須ページで使用するフック
 *
 * 未認証の場合、指定されたパス（デフォルト: /login）にリダイレクトします。
 * Client Component専用です。
 *
 * 初期マウント時の無限リダイレクトを防ぐため、短時間の遅延を設けています。
 * これにより、AuthProviderの初期化が完了してから認証チェックが実行されます。
 *
 * @param redirectTo - リダイレクト先のパス（デフォルト: '/login'）
 * @returns 認証状態オブジェクト（isLoading含む）
 *
 * @example
 * ```tsx
 * 'use client'
 *
 * function ProtectedPage() {
 *   const { isAuthenticated, isLoading } = useRequireAuth()
 *
 *   if (isLoading) {
 *     return <div>Loading...</div>
 *   }
 *
 *   return <div>Protected content</div>
 * }
 * ```
 *
 * @example
 * ```tsx
 * // カスタムリダイレクト先を指定
 * function AdminPage() {
 *   const { isAuthenticated, isLoading } = useRequireAuth('/admin/login')
 *
 *   if (isLoading) {
 *     return <div>Loading...</div>
 *   }
 *
 *   return <div>Admin content</div>
 * }
 * ```
 */
export function useRequireAuth(redirectTo = '/login') {
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // AuthProviderの初期化を待つための短い遅延
    const timer = setTimeout(() => {
      setIsLoading(false)

      // 初期化完了後、未認証ならリダイレクト
      if (!isAuthenticated) {
        router.push(redirectTo)
      }
    }, 100) // 100ms待機（AuthProviderの初回セッション取得を待つ）

    return () => clearTimeout(timer)
  }, [isAuthenticated, redirectTo, router])

  return {
    /** 認証済みかどうか */
    isAuthenticated,
    /** 現在のユーザー情報 */
    user,
    /** 認証状態の初期化中かどうか */
    isLoading,
  }
}
