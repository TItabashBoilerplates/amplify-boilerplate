import log from 'loglevel'
import type { LogContext, Logger, LogLevel } from '../types'

/**
 * 環境変数から設定を取得
 */
const LOG_LEVEL = ((typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_LOG_LEVEL) ||
  (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production'
    ? 'debug'
    : 'warn')) as LogLevel

const IS_PRODUCTION = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'

/**
 * loglevel のレベルを設定
 */
function setLogLevel(level: LogLevel): void {
  const levelMap: Record<LogLevel, log.LogLevelNumbers> = {
    trace: log.levels.TRACE,
    debug: log.levels.DEBUG,
    info: log.levels.INFO,
    warn: log.levels.WARN,
    error: log.levels.ERROR,
    silent: log.levels.SILENT,
  }
  log.setLevel(levelMap[level] ?? log.levels.WARN)
}

// 初期化時にログレベルを設定
setLogLevel(LOG_LEVEL)

/**
 * コンテキストをフォーマット
 */
function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return ''
  }

  if (IS_PRODUCTION) {
    // 本番環境: JSON形式
    return JSON.stringify(context)
  }

  // 開発環境: 読みやすい形式
  const parts = Object.entries(context)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' ')
  return `[${parts}]`
}

/**
 * メッセージをフォーマット
 */
function formatMessage(message: string, context?: LogContext): string {
  const contextStr = formatContext(context)
  if (!contextStr) {
    return message
  }

  if (IS_PRODUCTION) {
    // 本番環境: JSON形式
    return JSON.stringify({ message, ...context })
  }

  // 開発環境: 読みやすい形式
  return `${contextStr} ${message}`
}

/**
 * クライアントサイド用ロガーを作成
 */
function createClientLogger(baseContext?: LogContext): Logger {
  return {
    trace(message: string, context?: LogContext): void {
      const mergedContext = { ...baseContext, ...context }
      log.trace(formatMessage(message, mergedContext))
    },
    debug(message: string, context?: LogContext): void {
      const mergedContext = { ...baseContext, ...context }
      log.debug(formatMessage(message, mergedContext))
    },
    info(message: string, context?: LogContext): void {
      const mergedContext = { ...baseContext, ...context }
      log.info(formatMessage(message, mergedContext))
    },
    warn(message: string, context?: LogContext): void {
      const mergedContext = { ...baseContext, ...context }
      log.warn(formatMessage(message, mergedContext))
    },
    error(message: string, context?: LogContext): void {
      const mergedContext = { ...baseContext, ...context }
      log.error(formatMessage(message, mergedContext))
    },
    child(context: LogContext): Logger {
      return createClientLogger({ ...baseContext, ...context })
    },
  }
}

/**
 * クライアントサイド用ロガー
 */
export const clientLogger: Logger = createClientLogger()

/**
 * コンテキスト付きロガーを作成
 *
 * @param context - ログコンテキスト
 * @returns コンテキスト付きロガー
 *
 * @example
 * ```tsx
 * const logger = createLogger({ component: 'UserProfile', userId: '123' })
 * logger.info('Component mounted')
 * ```
 */
export function createLogger(context: LogContext): Logger {
  return clientLogger.child(context)
}

/**
 * ログレベルを動的に変更
 *
 * @param level - 新しいログレベル
 *
 * @example
 * ```tsx
 * // デバッグ時に詳細ログを有効化
 * setLevel('debug')
 * ```
 */
export function setLevel(level: LogLevel): void {
  setLogLevel(level)
}

// デフォルトエクスポート
export default clientLogger

// 型の再エクスポート
export type { LogContext, Logger, LogLevel } from '../types'
