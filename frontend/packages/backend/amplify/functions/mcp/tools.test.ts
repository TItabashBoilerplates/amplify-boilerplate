import { describe, expect, it } from 'vitest'
import { add, generate, ping } from './tools'

describe('mcp tools', () => {
  it('ping returns ok status', () => {
    expect(ping()).toMatchObject({ status: 'ok', server: 'backend-mcp-ts' })
  })

  it('add sums integers', () => {
    expect(add(2, 3)).toBe(5)
  })

  it('generate echoes the prompt', () => {
    expect(generate('hello')).toContain('hello')
  })
})
