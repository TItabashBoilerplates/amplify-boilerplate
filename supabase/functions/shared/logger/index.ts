/**
 * Edge Functions 用軽量ロガー
 *
 * 依存ライブラリなしで構造化ログを提供。
 * Supabase のログキャプチャシステムと互換性あり。
 */

import type { LogContext, Logger, LogLevel } from "./types.ts";

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

function getLogLevel(): LogLevel {
  const level = Deno.env.get("LOG_LEVEL")?.toLowerCase() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : "info";
}

function isDevelopment(): boolean {
  const format = Deno.env.get("LOG_FORMAT");
  return format === "pretty" || Deno.env.get("DENO_ENV") === "development";
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext,
): Record<string, unknown> {
  return {
    timestamp: getTimestamp(),
    level,
    message,
    ...context,
  };
}

function formatPretty(
  level: LogLevel,
  message: string,
  context: LogContext,
): string {
  const colors: Record<LogLevel, string> = {
    trace: "\x1b[90m",
    debug: "\x1b[36m",
    info: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    silent: "",
  };
  const reset = "\x1b[0m";
  const color = colors[level] || "";

  const timestamp = new Date().toLocaleTimeString();
  const levelStr = level.toUpperCase().padEnd(5);

  let output = `${color}[${timestamp}] ${levelStr}${reset} ${message}`;

  const contextKeys = Object.keys(context);
  if (contextKeys.length > 0) {
    const contextStr = contextKeys
      .map((k) => `${k}=${JSON.stringify(context[k])}`)
      .join(" ");
    output += ` | ${contextStr}`;
  }

  return output;
}

function createLogger(baseContext: LogContext = {}): Logger {
  const currentLevel = getLogLevel();
  const isDev = isDevelopment();

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
  };

  const log = (
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): void => {
    if (!shouldLog(level)) return;

    const mergedContext = { ...baseContext, ...context };

    if (isDev) {
      const output = formatPretty(level, message, mergedContext);
      if (level === "error") {
        console.error(output);
      } else if (level === "warn") {
        console.warn(output);
      } else {
        console.log(output);
      }
    } else {
      const entry = createLogEntry(level, message, mergedContext);
      const json = JSON.stringify(entry);
      if (level === "error") {
        console.error(json);
      } else if (level === "warn") {
        console.warn(json);
      } else {
        console.log(json);
      }
    }
  };

  return {
    trace: (message, context) => log("trace", message, context),
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
    child: (context) => createLogger({ ...baseContext, ...context }),
  };
}

export const logger = createLogger();

export function createFunctionLogger(functionName: string): Logger {
  return logger.child({ functionName });
}

export type { LogContext, Logger, LogLevel };
