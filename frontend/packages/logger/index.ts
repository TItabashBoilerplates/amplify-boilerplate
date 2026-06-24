/**
 * @workspace/logger
 *
 * Frontend Logger パッケージ
 *
 * サーバーサイドとクライアントサイドで異なるロガー実装を提供します。
 *
 * @example Server-side (Server Components, API Routes)
 * ```ts
 * import { serverLogger, createRequestLogger } from '@workspace/logger/server'
 *
 * // 基本的なログ出力
 * serverLogger.info('Application started')
 *
 * // リクエストスコープのロガー
 * const logger = createRequestLogger('req-123', 'user-456')
 * logger.info('Request received')
 * ```
 *
 * @example Client-side (Client Components)
 * ```tsx
 * import { clientLogger, createLogger } from '@workspace/logger/client'
 *
 * // 基本的なログ出力
 * clientLogger.info('Button clicked')
 *
 * // コンポーネント用ロガー
 * const logger = createLogger({ component: 'UserProfile' })
 * logger.debug('Rendering profile')
 * ```
 *
 * @deprecated このモジュールからの直接インポートは非推奨です。
 * 代わりに明示的に `/server` または `/client` をインポートしてください。
 */

// 型のエクスポート
export type { LogContext, Logger, LogLevel } from './types'

// 注意: デフォルトロガーは提供しません。
// サーバー/クライアントを明示的に選択してください。
//
// Server: import { serverLogger } from '@workspace/logger/server'
// Client: import { clientLogger } from '@workspace/logger/client'
