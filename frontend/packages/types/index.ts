/**
 * @workspace/types - 共通型定義
 *
 * アプリ全体で共有する汎用型。データモデルの型は Amplify Data の `Schema`
 * （`@workspace/backend` / `@workspace/data-client`）を使う。
 */

export interface User {
  id: string
  email: string
  name?: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}
