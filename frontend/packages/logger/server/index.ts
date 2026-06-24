import pino from 'pino'
import type { LogContext, Logger, LogLevel } from '../types'

/**
 * 環境変数から設定を取得
 */
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info'
const LOG_FORMAT =
  process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty')

/**
 * Pino オプションを構築
 */
function createPinoOptions(): pino.LoggerOptions {
  const baseOptions: pino.LoggerOptions = {
    level: LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
  }

  // 本番環境: JSON出力
  if (LOG_FORMAT === 'json') {
    return baseOptions
  }

  // 開発環境: pino-pretty でカラー出力
  return {
    ...baseOptions,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }
}

/**
 * ベースとなる Pino インスタンス
 */
const basePino = pino(createPinoOptions())

/**
 * Pino インスタンスを Logger インターフェースにラップ
 */
function wrapPino(pinoInstance: pino.Logger): Logger {
  return {
    trace(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.trace(context, message)
      } else {
        pinoInstance.trace(message)
      }
    },
    debug(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.debug(context, message)
      } else {
        pinoInstance.debug(message)
      }
    },
    info(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.info(context, message)
      } else {
        pinoInstance.info(message)
      }
    },
    warn(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.warn(context, message)
      } else {
        pinoInstance.warn(message)
      }
    },
    error(message: string, context?: LogContext): void {
      if (context) {
        pinoInstance.error(context, message)
      } else {
        pinoInstance.error(message)
      }
    },
    child(context: LogContext): Logger {
      return wrapPino(pinoInstance.child(context))
    },
  }
}

/**
 * サーバーサイド用ロガー
 */
export const serverLogger: Logger = wrapPino(basePino)

/**
 * リクエストスコープのロガーを作成
 *
 * @param requestId - リクエストID
 * @param userId - ユーザーID（オプション）
 * @returns リクエストコンテキスト付きロガー
 *
 * @example
 * ```ts
 * const logger = createRequestLogger('req-123', 'user-456')
 * logger.info('Request started')
 * ```
 */
export function createRequestLogger(requestId: string, userId?: string): Logger {
  const context: LogContext = { requestId }
  if (userId) {
    context.userId = userId
  }
  return serverLogger.child(context)
}

/**
 * カスタムコンテキストでロガーを作成
 *
 * @param context - ログコンテキスト
 * @returns コンテキスト付きロガー
 *
 * @example
 * ```ts
 * const logger = createLogger({ service: 'payment', traceId: 'abc-123' })
 * logger.info('Payment processing')
 * ```
 */
export function createLogger(context: LogContext): Logger {
  return serverLogger.child(context)
}

// デフォルトエクスポート
export default serverLogger

// 型の再エクスポート
export type { LogContext, Logger, LogLevel } from '../types'
