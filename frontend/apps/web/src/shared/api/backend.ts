/**
 * バックエンドAPI（FastAPI）クライアント
 *
 * @module shared/api/backend
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_PY_URL || 'http://localhost:4040'

/**
 * バックエンドAPIレスポンスの型
 */
export interface BackendApiResponse<T> {
  data: T | null
  error: string | null
}

/**
 * ユーザー情報のレスポンス型
 */
export interface UserInfoResponse {
  message: string
}

/**
 * バックエンドAPIクライアント
 * Server Component / Server Actionsで使用
 */
export class BackendApiClient {
  private baseUrl: string
  private accessToken: string | null

  constructor(accessToken: string | null = null) {
    this.baseUrl = BACKEND_URL
    this.accessToken = accessToken
  }

  /**
   * 認証付きGETリクエスト
   */
  async get<T>(endpoint: string): Promise<BackendApiResponse<T>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (this.accessToken) {
        headers.Authorization = `Bearer ${this.accessToken}`
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
        cache: 'no-store', // Server Componentでキャッシュを無効化
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          data: null,
          error: `HTTP ${response.status}: ${errorText}`,
        }
      }

      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { data: null, error: error.message }
      }
      return { data: null, error: 'Unknown error occurred' }
    }
  }

  /**
   * 認証付きPOSTリクエスト
   */
  async post<T, R>(endpoint: string, body: T): Promise<BackendApiResponse<R>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (this.accessToken) {
        headers.Authorization = `Bearer ${this.accessToken}`
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          data: null,
          error: `HTTP ${response.status}: ${errorText}`,
        }
      }

      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      if (error instanceof Error) {
        return { data: null, error: error.message }
      }
      return { data: null, error: 'Unknown error occurred' }
    }
  }

  /**
   * ヘルスチェック
   */
  async healthcheck(): Promise<BackendApiResponse<{ message: string }>> {
    return this.get<{ message: string }>('/healthcheck')
  }

  /**
   * ルートエンドポイント（認証必須）
   * ユーザー情報を取得
   */
  async getUserInfo(): Promise<BackendApiResponse<UserInfoResponse>> {
    return this.get<UserInfoResponse>('/')
  }
}
