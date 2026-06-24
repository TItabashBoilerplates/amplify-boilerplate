'use client'

/**
 * TanStack Query プロバイダーコンポーネント
 *
 * @module @workspace/query/provider/QueryProvider
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { ReactNode } from 'react'
import { getQueryClient } from '../client/queryClient'

/**
 * QueryProviderのProps
 */
interface QueryProviderProps {
  children: ReactNode
}

/**
 * TanStack Query プロバイダー
 *
 * アプリケーション全体にQueryClientを提供し、
 * 開発環境ではReactQueryDevtoolsを表示します。
 *
 * ### 使用方法
 *
 * layout.tsxでAuthProviderの外側にラップ:
 * ```tsx
 * <QueryProvider>
 *   <AuthProvider>
 *     {children}
 *   </AuthProvider>
 * </QueryProvider>
 * ```
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // SSR/CSR両対応のQueryClientを取得
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
