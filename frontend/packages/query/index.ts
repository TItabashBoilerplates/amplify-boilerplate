/**
 * @workspace/query - TanStack Query ライブラリ
 *
 * サーバー状態管理のための共通パッケージ
 * Supabase/FastAPIからのデータフェッチ・キャッシュを効率化
 *
 * @packageDocumentation
 */

// Re-export types
export type {
  MutationObserverResult,
  QueryClient,
  QueryKey,
  QueryObserverResult,
  UseInfiniteQueryOptions,
  UseMutationOptions,
  UseQueryOptions,
} from '@tanstack/react-query'
// Re-export TanStack Query hooks for convenience
export {
  useInfiniteQuery,
  useIsFetching,
  useIsMutating,
  useMutation,
  usePrefetchQuery,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
export { getQueryClient } from './client/queryClient'
// Provider
export { QueryProvider } from './provider/QueryProvider'
