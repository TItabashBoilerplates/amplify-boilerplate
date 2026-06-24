import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Client Logger テスト
 *
 * loglevel を実際に動作させ、console への出力をスパイして検証する。
 * loglevel は初期化時に console メソッドをキャプチャするため、
 * vi.stubGlobal でモジュール読み込み前に console を差し替える。
 */

// 各テストの出力をキャプチャするための配列
let logOutput: string[] = []
let warnOutput: string[] = []
let errorOutput: string[] = []
let debugOutput: string[] = []

// console メソッドを置き換え
const mockConsole = {
  log: (...args: unknown[]) => {
    logOutput.push(args.map(String).join(' '))
  },
  warn: (...args: unknown[]) => {
    warnOutput.push(args.map(String).join(' '))
  },
  error: (...args: unknown[]) => {
    errorOutput.push(args.map(String).join(' '))
  },
  debug: (...args: unknown[]) => {
    debugOutput.push(args.map(String).join(' '))
  },
  trace: (...args: unknown[]) => {
    debugOutput.push(args.map(String).join(' '))
  },
  info: (...args: unknown[]) => {
    logOutput.push(args.map(String).join(' '))
  },
}

describe('Client Logger', () => {
  let originalEnv: NodeJS.ProcessEnv
  let originalConsole: typeof console

  beforeEach(() => {
    // 出力配列をリセット
    logOutput = []
    warnOutput = []
    errorOutput = []
    debugOutput = []
    // 環境変数をバックアップ
    originalEnv = { ...process.env }
    // console をバックアップ
    originalConsole = { ...console }
    // console を置き換え（モジュール読み込み前に）
    vi.stubGlobal('console', { ...console, ...mockConsole })
  })

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv
    // console を復元
    vi.stubGlobal('console', originalConsole)
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  describe('clientLogger export', () => {
    it('should export clientLogger with all log methods', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'trace'

      const { clientLogger } = await import('./index')

      expect(clientLogger).toBeDefined()
      expect(clientLogger.trace).toBeInstanceOf(Function)
      expect(clientLogger.debug).toBeInstanceOf(Function)
      expect(clientLogger.info).toBeInstanceOf(Function)
      expect(clientLogger.warn).toBeInstanceOf(Function)
      expect(clientLogger.error).toBeInstanceOf(Function)
      expect(clientLogger.child).toBeInstanceOf(Function)
    })
  })

  describe('log output', () => {
    it('should output info message', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'info'

      const { clientLogger } = await import('./index')
      clientLogger.info('test message')

      expect(logOutput.length).toBeGreaterThan(0)
      expect(logOutput.some((line) => line.includes('test message'))).toBe(true)
    })

    it('should output warn message', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'warn'

      const { clientLogger } = await import('./index')
      clientLogger.warn('warning message')

      expect(warnOutput.length).toBeGreaterThan(0)
      expect(warnOutput.some((line) => line.includes('warning message'))).toBe(true)
    })

    it('should output error message', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'error'

      const { clientLogger } = await import('./index')
      clientLogger.error('error message')

      expect(errorOutput.length).toBeGreaterThan(0)
      expect(errorOutput.some((line) => line.includes('error message'))).toBe(true)
    })

    it('should include context in output', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'info'

      const { clientLogger } = await import('./index')
      clientLogger.info('request started', { requestId: 'req-123', userId: 'user-456' })

      expect(logOutput.length).toBeGreaterThan(0)
      const output = logOutput.join('\n')
      expect(output).toContain('request started')
      expect(output).toContain('requestId')
      expect(output).toContain('req-123')
    })
  })

  describe('log level filtering', () => {
    it('should not output logs below current level', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'warn'

      const { clientLogger } = await import('./index')

      clientLogger.debug('should not appear')
      clientLogger.info('should not appear')

      // warn 未満のログは出力されない
      expect(debugOutput.length).toBe(0)
      expect(logOutput.length).toBe(0)
    })

    it('should output logs at or above current level', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'warn'

      const { clientLogger } = await import('./index')

      clientLogger.warn('warning message')
      clientLogger.error('error message')

      expect(warnOutput.some((line) => line.includes('warning message'))).toBe(true)
      expect(errorOutput.some((line) => line.includes('error message'))).toBe(true)
    })
  })

  describe('createLogger', () => {
    it('should create logger with custom context', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'info'

      const { createLogger } = await import('./index')
      const logger = createLogger({ component: 'UserProfile', userId: '123' })

      logger.info('component mounted')

      expect(logOutput.length).toBeGreaterThan(0)
      const output = logOutput.join('\n')
      expect(output).toContain('component')
      expect(output).toContain('UserProfile')
      expect(output).toContain('component mounted')
    })
  })

  describe('setLevel', () => {
    it('should dynamically change log level', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'warn'

      const { clientLogger, setLevel } = await import('./index')

      // warn レベルなので info は出力されない
      clientLogger.info('should not appear')
      expect(logOutput.length).toBe(0)

      // debug レベルに変更
      setLevel('debug')

      // debug レベルなので info が出力される
      clientLogger.info('should appear')
      expect(logOutput.some((line) => line.includes('should appear'))).toBe(true)
    })
  })

  describe('child logger', () => {
    it('should inherit parent context', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'info'

      const { clientLogger } = await import('./index')
      const childLogger = clientLogger.child({ sessionId: 'sess-123' })

      childLogger.info('child log')

      expect(logOutput.length).toBeGreaterThan(0)
      const output = logOutput.join('\n')
      expect(output).toContain('sessionId')
      expect(output).toContain('sess-123')
    })

    it('should merge parent and child context', async () => {
      process.env.NEXT_PUBLIC_LOG_LEVEL = 'info'

      const { createLogger } = await import('./index')
      const parentLogger = createLogger({ component: 'App' })
      const childLogger = parentLogger.child({ page: 'Home' })

      childLogger.info('nested log')

      expect(logOutput.length).toBeGreaterThan(0)
      const output = logOutput.join('\n')
      expect(output).toContain('component')
      expect(output).toContain('App')
      expect(output).toContain('page')
      expect(output).toContain('Home')
    })
  })
})
