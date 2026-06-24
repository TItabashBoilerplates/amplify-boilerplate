import { describe, expect, it, vi } from 'vitest'
import { getLogger, requireEnv } from './index'

describe('getLogger', () => {
  it('emits structured JSON to stdout for info', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    getLogger('test').info('hello', { a: 1 })
    expect(spy).toHaveBeenCalledOnce()
    const payload = JSON.parse(spy.mock.calls[0]?.[0] as string)
    expect(payload).toMatchObject({ level: 'info', name: 'test', msg: 'hello', a: 1 })
    spy.mockRestore()
  })

  it('routes errors to stderr', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getLogger('test').error('boom')
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })
})

describe('requireEnv', () => {
  it('returns the value when set', () => {
    process.env.MY_TEST_VAR = 'value'
    expect(requireEnv('MY_TEST_VAR')).toBe('value')
    process.env.MY_TEST_VAR = undefined
  })

  it('throws when missing', () => {
    expect(() => requireEnv('DEFINITELY_NOT_SET_VAR')).toThrow(/Missing required/)
  })
})
