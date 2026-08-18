import { describe, expect, it } from 'vitest'

import {
  BUTTON_DEFAULTS,
  BUTTON_SEMANTICS,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  RAW_COLOR_PATTERN,
} from '../contract'

describe('button contract', () => {
  it('declares semantics for every variant', () => {
    expect(Object.keys(BUTTON_SEMANTICS).sort()).toEqual([...BUTTON_VARIANTS].sort())
  })

  it('points its defaults at declared names', () => {
    expect(BUTTON_VARIANTS).toContain(BUTTON_DEFAULTS.variant)
    expect(BUTTON_SIZES).toContain(BUTTON_DEFAULTS.size)
  })

  it('requires only semantic token names, never utility class strings', () => {
    for (const [variant, tokens] of Object.entries(BUTTON_SEMANTICS)) {
      for (const token of tokens) {
        expect(token, `${variant} -> ${token}`).toMatch(/^[a-z]+(?:-[a-z]+)*$/)
      }
    }
  })
})

describe('RAW_COLOR_PATTERN', () => {
  it('flags raw palette utilities', () => {
    expect('bg-zinc-900').toMatch(RAW_COLOR_PATTERN)
    expect('text-blue-500').toMatch(RAW_COLOR_PATTERN)
    expect('border-gray-300').toMatch(RAW_COLOR_PATTERN)
  })

  it('flags raw black and white', () => {
    expect('text-white').toMatch(RAW_COLOR_PATTERN)
    expect('bg-black').toMatch(RAW_COLOR_PATTERN)
  })

  it('does not flag semantic tokens', () => {
    expect('bg-primary text-primary-foreground').not.toMatch(RAW_COLOR_PATTERN)
    expect('border border-input bg-background').not.toMatch(RAW_COLOR_PATTERN)
    expect('hover:bg-accent hover:text-accent-foreground').not.toMatch(RAW_COLOR_PATTERN)
    expect('focus-visible:ring-ring/50').not.toMatch(RAW_COLOR_PATTERN)
  })

  it('does not flag non-colour utilities that contain numbers', () => {
    expect('h-9 px-4 rounded-md gap-1.5').not.toMatch(RAW_COLOR_PATTERN)
  })
})
