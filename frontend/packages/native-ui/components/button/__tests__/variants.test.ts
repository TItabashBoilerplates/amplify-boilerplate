import {
  BUTTON_DEFAULTS,
  BUTTON_SEMANTICS,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  RAW_COLOR_PATTERN,
} from '@workspace/tokens/contract'
import { describe, expect, it } from 'vitest'

import { buttonIconStyle, buttonStyle, buttonTextStyle } from '../variants'

/**
 * 共有デザインシステムへの適合（Mobile 側）。
 *
 * Web 側 (`packages/ui/src/components/__tests__/button.test.tsx`) と対になるテスト。
 * クラス文字列そのものは意図的にプラットフォーム別だが、
 * **バリアント名とセマンティックトークンは契約に従う**ことをここで担保する。
 */
describe('native Button / design system conformance', () => {
  const resting = (variant: (typeof BUTTON_VARIANTS)[number]) =>
    `${buttonStyle({ variant })} ${buttonTextStyle({ variant })}`

  it('expresses the semantic tokens the contract requires for each variant', () => {
    for (const variant of BUTTON_VARIANTS) {
      const classes = resting(variant)
      for (const token of BUTTON_SEMANTICS[variant]) {
        expect(classes, `${variant} must express "${token}"`).toMatch(
          new RegExp(`(?:^|[\\s:])[a-z-]*-${token}(?:\\b|/)`)
        )
      }
    }
  })

  it('never hardcodes a raw palette colour', () => {
    for (const variant of BUTTON_VARIANTS) {
      for (const size of BUTTON_SIZES) {
        const classes = [
          buttonStyle({ variant, size }),
          buttonTextStyle({ variant, size }),
          buttonIconStyle({ variant, size }),
        ].join(' ')
        const match = classes.match(RAW_COLOR_PATTERN)
        expect(match?.[0], `${variant}/${size} uses a raw colour`).toBeUndefined()
      }
    }
  })

  it('uses the shared defaults', () => {
    expect(buttonStyle({})).toBe(buttonStyle(BUTTON_DEFAULTS))
    expect(buttonTextStyle({})).toBe(buttonTextStyle(BUTTON_DEFAULTS))
  })

  it('sizes the button for every contract size', () => {
    for (const size of BUTTON_SIZES) {
      expect(buttonStyle({ size }), size).toMatch(/\bh-\d+\b/)
    }
  })
})
