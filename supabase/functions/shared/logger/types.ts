/**
 * ログレベル定義
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent";

/**
 * ログコンテキスト
 */
export interface LogContext {
  /** リクエストID */
  requestId?: string;
  /** ユーザーID */
  userId?: string;
  /** 関数名 */
  functionName?: string;
  /** 追加のメタデータ */
  [key: string]: unknown;
}

/**
 * Logger インターフェース
 */
export interface Logger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}
