import { isServer, QueryClient } from '@tanstack/react-query'

/**
 * QueryClient ファクトリ関数
 *
 * SSR対応のデフォルト設定を持つQueryClientを作成
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSRでは即座に再フェッチしないようstaleTimeを設定
        staleTime: 60 * 1000, // 1分
        // Supabase/FastAPIリクエストのリトライ設定
        retry: 1,
        // ウィンドウフォーカス時の自動再フェッチを無効化
        refetchOnWindowFocus: false,
      },
    },
  })
}

// ブラウザ用のシングルトンクライアント
let browserQueryClient: QueryClient | undefined

/**
 * QueryClient を取得
 *
 * - サーバー: 毎回新しいクライアントを作成（リクエスト間の状態共有を防止）
 * - ブラウザ: シングルトンを再利用
 */
export function getQueryClient() {
  if (isServer) {
    // サーバー: 毎回新しいクライアントを作成
    return makeQueryClient()
  }
  // ブラウザ: シングルトンを再利用
  // React Suspense中の再作成を防ぐため、既存のクライアントを維持
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}
