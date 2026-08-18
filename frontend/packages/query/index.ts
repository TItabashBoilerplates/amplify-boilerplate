/**
 * @workspace/query - TanStack Query ライブラリ
 *
 * サーバー状態管理のための共通パッケージ。
 * Amplify Data (AppSync) / FastAPI からのデータ取得とキャッシュを効率化する。
 *
 * @packageDocumentation
 */

// Re-export types
export type {
  MutationObserverResult,
  QueryKey,
  QueryObserverResult,
  UseInfiniteQueryOptions,
  UseMutationOptions,
  UseQueryOptions,
} from '@tanstack/react-query'
// Re-export TanStack Query hooks for convenience
// テスト / Storybook でキャッシュを差し替えるための実体（アプリ本体では
// QueryProvider を使い、これを直接生成しないこと）
export {
  QueryClient,
  QueryClientProvider,
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
