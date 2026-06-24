/**
 * @workspace/backend-core — shared TypeScript backend utilities.
 *
 * Used by the Amplify (Node) Lambda functions in `@workspace/backend`
 * (`amplify/functions/*`). The TS analogue of the Python `core` package.
 * Dependency-free so function bundles stay small.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
  error(msg: string, meta?: Record<string, unknown>): void
}

function emit(level: Level, name: string, msg: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({ level, name, msg, ts: new Date().toISOString(), ...meta })
  // Lambda forwards stdout/stderr to CloudWatch Logs.
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

/**
 * Create a named structured (JSON) logger suitable for Lambda / CloudWatch.
 *
 * @example
 * const log = getLogger('rest-api')
 * log.info('handled request', { path: '/health' })
 */
export function getLogger(name: string): Logger {
  return {
    debug: (msg, meta) => emit('debug', name, msg, meta),
    info: (msg, meta) => emit('info', name, msg, meta),
    warn: (msg, meta) => emit('warn', name, msg, meta),
    error: (msg, meta) => emit('error', name, msg, meta),
  }
}

/** Read a required environment variable or throw a clear error. */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}
