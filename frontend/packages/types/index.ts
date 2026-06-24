export type { Database } from './schema'

// 共通型定義
export interface User {
  id: string
  email: string
  name?: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}
