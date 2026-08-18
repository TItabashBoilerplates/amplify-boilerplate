import { describe, expect, it } from 'vitest'

import { colors } from '../colors'
import { cssVar, toKebabCase } from '../index'

describe('toKebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(toKebabCase('primaryForeground')).toBe('primary-foreground')
    expect(toKebabCase('sidebarAccentForeground')).toBe('sidebar-accent-foreground')
  })

  it('separates letter/digit boundaries so chart tokens match shadcn naming', () => {
    expect(toKebabCase('chart1')).toBe('chart-1')
    expect(toKebabCase('chart5')).toBe('chart-5')
  })

  it('leaves already-lowercase single words untouched', () => {
    expect(toKebabCase('background')).toBe('background')
  })
})

describe('cssVar', () => {
  it('builds a CSS variable reference from a token name', () => {
    expect(cssVar('primaryForeground')).toBe('var(--primary-foreground)')
    expect(cssVar('chart1')).toBe('var(--chart-1)')
  })
})

describe('colors', () => {
  it('defines the exact same token keys for light and dark', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort())
  })
})
