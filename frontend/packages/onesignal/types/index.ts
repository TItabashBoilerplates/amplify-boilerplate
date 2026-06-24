/**
 * OneSignal Frontend 型定義
 */

/**
 * OneSignal 初期化オプション
 */
export interface OneSignalInitOptions {
  /**
   * OneSignal App ID
   */
  appId: string

  /**
   * Safari Web ID（Safari 対応の場合）
   */
  safariWebId?: string

  /**
   * 開発環境で localhost を許可
   * @default true (NODE_ENV === 'development')
   */
  allowLocalhostAsSecureOrigin?: boolean

  /**
   * 通知ボタンを表示
   */
  notifyButton?: {
    enable: boolean
  }
}

/**
 * OneSignal コンテキスト値
 */
export interface OneSignalContextValue {
  /**
   * SDK 初期化完了状態
   */
  isInitialized: boolean

  /**
   * プッシュ通知購読状態
   */
  isSubscribed: boolean

  /**
   * 初期化中のエラー
   */
  error: Error | null

  /**
   * プッシュ通知の許可を促すスライドダウンを表示
   */
  promptPush: () => Promise<void>

  /**
   * ユーザーログイン（external_id を設定）
   *
   * @param externalUserId - 外部ユーザーID（Supabase user.id）
   */
  login: (externalUserId: string) => Promise<void>

  /**
   * ユーザーログアウト（external_id をクリア）
   */
  logout: () => Promise<void>
}

/**
 * OneSignal Provider Props
 */
export interface OneSignalProviderProps {
  /**
   * 子コンポーネント
   */
  children: React.ReactNode

  /**
   * OneSignal App ID
   */
  appId: string

  /**
   * Safari Web ID（オプション）
   */
  safariWebId?: string
}
