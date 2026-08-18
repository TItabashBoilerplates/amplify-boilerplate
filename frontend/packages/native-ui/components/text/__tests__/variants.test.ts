import { RAW_COLOR_PATTERN } from '@workspace/tokens/contract'
import { describe, expect, it } from 'vitest'

import { textStyle } from '../variants'

const SIZES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'] as const

describe('native Text / design system conformance', () => {
  it('never hardcodes a raw palette colour', () => {
    for (const size of SIZES) {
      const classes = textStyle({ size, bold: true, italic: true, underline: true })
      const match = classes.match(RAW_COLOR_PATTERN)
      expect(match?.[0], `size ${size} uses a raw colour`).toBeUndefined()
    }
  })

  it('expresses the foreground semantic token by default', () => {
    expect(textStyle({})).toMatch(/\btext-foreground\b/)
  })

  it('defaults to the md size', () => {
    expect(textStyle({})).toBe(textStyle({ size: 'md' }))
  })
})
