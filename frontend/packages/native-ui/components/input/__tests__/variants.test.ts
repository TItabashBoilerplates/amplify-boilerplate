import {
  INPUT_DEFAULTS,
  INPUT_SEMANTICS,
  INPUT_SIZES,
  RAW_COLOR_PATTERN,
} from '@workspace/tokens/contract'
import { describe, expect, it } from 'vitest'

import { inputFieldStyle, inputIconStyle, inputStyle } from '../variants'

/**
 * 共有デザインシステムへの適合（Mobile Input）。
 *
 * Button と同じく、クラス文字列そのものはプラットフォーム別でよいが
 * **サイズ名とセマンティックトークンは契約に従う**ことを機械的に担保する。
 */
describe('native Input / design system conformance', () => {
  it('expresses the semantic tokens the contract requires', () => {
    const classes = `${inputStyle({})} ${inputFieldStyle({})}`
    for (const token of INPUT_SEMANTICS) {
      expect(classes, `input must express "${token}"`).toMatch(
        new RegExp(`(?:^|[\\s:])[a-z-]*-${token}(?:\\b|/)`)
      )
    }
  })

  it('never hardcodes a raw palette colour', () => {
    for (const size of INPUT_SIZES) {
      const classes = [
        inputStyle({ size }),
        inputStyle({ size, isInvalid: true }),
        inputFieldStyle({ size }),
        inputIconStyle({ size }),
      ].join(' ')
      expect(classes.match(RAW_COLOR_PATTERN)?.[0], `${size} uses a raw colour`).toBeUndefined()
    }
  })

  it('uses the shared defaults', () => {
    expect(inputStyle({})).toBe(inputStyle(INPUT_DEFAULTS))
    expect(inputFieldStyle({})).toBe(inputFieldStyle(INPUT_DEFAULTS))
  })

  it('gives every contract size a height', () => {
    for (const size of INPUT_SIZES) {
      expect(inputStyle({ size }), size).toMatch(/\bh-\d+\b/)
    }
  })

  /**
   * これが本テストの主目的。
   *
   * `text-sm`(14px) / `text-xs`(12px) を入力欄に使うと、**Web ビルドの iOS Safari で
   * フォーカス時に自動ズーム**する（`.claude/rules/form-controls.md`）。過去に
   * `textareaClass` を 6 ファイルへコピペして全部がズーム対象になった事故があるため、
   * 「見た目を小さくしたい」で下げられないよう機械的に固定する。
   */
  it('never drops the field below 16px (iOS Safari auto-zoom guard)', () => {
    for (const size of INPUT_SIZES) {
      const classes = inputFieldStyle({ size })
      expect(classes, `${size} must not use text-sm/xs`).not.toMatch(/\btext-(?:sm|xs)\b/)
      expect(classes, `${size} must set a base-or-larger font size`).toMatch(
        /\btext-(?:base|lg|xl|2xl)\b/
      )
    }
  })

  it('marks invalid state with the destructive token, not a raw red', () => {
    expect(inputStyle({ isInvalid: true })).toMatch(/border-destructive/)
  })
})
