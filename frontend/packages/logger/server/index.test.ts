import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server Logger テスト
 *
 * Pino を実際に動作させ、stdout への出力をスパイして検証する。
 * モジュール全体をモックせず、I/O 境界のみをスパイする方針。
 */
describe('Server Logger', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // 環境変数をバックアップ
    originalEnv = { ...process.env }
    // stdout.write をスパイ
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv
    stdoutWriteSpy.mockRestore()
    vi.resetModules()
  })

  describe('serverLogger export', () => {
    it('should export serverLogger with all log methods', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'trace'

      const { serverLogger } = await import('./index')

      expect(serverLogger).toBeDefined()
      expect(serverLogger.trace).toBeInstanceOf(Function)
      expect(serverLogger.debug).toBeInstanceOf(Function)
      expect(serverLogger.info).toBeInstanceOf(Function)
      expect(serverLogger.warn).toBeInstanceOf(Function)
      expect(serverLogger.error).toBeInstanceOf(Function)
      expect(serverLogger.child).toBeInstanceOf(Function)
    })
  })

  describe('JSON output format (production mode)', () => {
    it('should output valid JSON with message field', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'info'

      const { serverLogger } = await import('./index')
      serverLogger.info('test message')

      expect(stdoutWriteSpy).toHaveBeenCalled()
      const output = stdoutWriteSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.msg).toBe('test message')
      expect(parsed.level).toBe(30) // pino info level
      expect(parsed.time).toBeDefined()
    })

    it('should include context in JSON output', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'info'

      const { serverLogger } = await import('./index')
      serverLogger.info('request started', { requestId: 'req-123', userId: 'user-456' })

      const output = stdoutWriteSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.msg).toBe('request started')
      expect(parsed.requestId).toBe('req-123')
      expect(parsed.userId).toBe('user-456')
    })
  })

  describe('log level filtering', () => {
    it('should not output logs below current level', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'warn'

      const { serverLogger } = await import('./index')

      serverLogger.debug('should not appear')
      serverLogger.info('should not appear')

      // warn 未満のログは出力されない
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })

    it('should output logs at or above current level', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'warn'

      const { serverLogger } = await import('./index')

      serverLogger.warn('warning message')
      serverLogger.error('error message')

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(2)

      const warnOutput = JSON.parse(stdoutWriteSpy.mock.calls[0][0] as string)
      const errorOutput = JSON.parse(stdoutWriteSpy.mock.calls[1][0] as string)

      expect(warnOutput.msg).toBe('warning message')
      expect(warnOutput.level).toBe(40) // pino warn level
      expect(errorOutput.msg).toBe('error message')
      expect(errorOutput.level).toBe(50) // pino error level
    })
  })

  describe('createRequestLogger', () => {
    it('should create logger with requestId in context', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'info'

      const { createRequestLogger } = await import('./index')
      const logger = createRequestLogger('req-789')

      logger.info('processing')

      const output = stdoutWriteSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.requestId).toBe('req-789')
      expect(parsed.msg).toBe('processing')
    })

    it('should create logger with requestId and userId', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'info'

      const { createRequestLogger } = await import('./index')
      const logger = createRequestLogger('req-abc', 'user-xyz')

      logger.info('authenticated request')

      const output = stdoutWriteSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.requestId).toBe('req-abc')
      expect(parsed.userId).toBe('user-xyz')
    })
  })

  describe('createLogger', () => {
    it('should create logger with custom context', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'info'

      const { createLogger } = await import('./index')
      const logger = createLogger({ service: 'payment', traceId: 'trace-123' })

      logger.info('payment initiated')

      const output = stdoutWriteSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.service).toBe('payment')
      expect(parsed.traceId).toBe('trace-123')
      expect(parsed.msg).toBe('payment initiated')
    })
  })

  describe('child logger', () => {
    it('should inherit parent context', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'info'

      const { serverLogger } = await import('./index')
      const childLogger = serverLogger.child({ component: 'Header' })

      childLogger.info('rendered')

      const output = stdoutWriteSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.component).toBe('Header')
      expect(parsed.msg).toBe('rendered')
    })

    it('should merge parent and child context', async () => {
      process.env.LOG_FORMAT = 'json'
      process.env.LOG_LEVEL = 'info'

      const { createLogger } = await import('./index')
      const parentLogger = createLogger({ app: 'web' })
      const childLogger = parentLogger.child({ page: 'dashboard' })

      childLogger.info('page loaded')

      const output = stdoutWriteSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)

      expect(parsed.app).toBe('web')
      expect(parsed.page).toBe('dashboard')
    })
  })
})
