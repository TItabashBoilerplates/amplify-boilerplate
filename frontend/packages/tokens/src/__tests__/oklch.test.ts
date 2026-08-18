import { describe, expect, it } from 'vitest'

import { colors } from '../colors'
import { oklchToHex, resolvedColors } from '../oklch'

describe('oklchToHex', () => {
  it('resolves the achromatic extremes', () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff')
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000')
  })

  it('resolves the shadcn dark background to its documented sRGB value', () => {
    expect(oklchToHex('oklch(0.145 0 0)')).toBe('#0a0a0a')
  })

  it('resolves a chromatic colour', () => {
    // oklch(0.577 0.245 27.325) は shadcn の light destructive
    expect(oklchToHex('oklch(0.577 0.245 27.325)')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('appends an alpha channel when the colour carries one', () => {
    expect(oklchToHex('oklch(1 0 0 / 10%)')).toBe('#ffffff1a')
    expect(oklchToHex('oklch(1 0 0 / 0.5)')).toBe('#ffffff80')
  })

  it('clamps out-of-gamut colours into sRGB instead of overflowing', () => {
    const hex = oklchToHex('oklch(0.9 0.4 140)')
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('rejects values that are not oklch', () => {
    expect(() => oklchToHex('#ffffff')).toThrow(/oklch/i)
  })
})

describe('resolvedColors', () => {
  it('exposes the same token keys as the oklch source', () => {
    expect(Object.keys(resolvedColors.light).sort()).toEqual(Object.keys(colors.light).sort())
    expect(Object.keys(resolvedColors.dark).sort()).toEqual(Object.keys(colors.dark).sort())
  })

  it('resolves every token to a hex string usable by React Native style props', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const [key, value] of Object.entries(resolvedColors[mode])) {
        expect(value, `${mode}.${key}`).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/)
      }
    }
  })
})
