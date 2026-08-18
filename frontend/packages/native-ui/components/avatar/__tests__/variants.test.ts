import { RAW_COLOR_PATTERN } from '@workspace/tokens/contract'
import { describe, expect, it } from 'vitest'

import {
  avatarBadgeStyle,
  avatarFallbackTextStyle,
  avatarImageStyle,
  avatarStyle,
} from '../variants'

/**
 * `AvatarBadge` は公式 gluestack-ui v5 では既定で `bg-green-500` を持つが、
 * 生パレット色になるため本リポジトリでは持たせていない（`.claude/rules/frontend.md`）。
 * このテストはその状態を固定する。
 */
describe('native Avatar / design system conformance', () => {
  it('never hardcodes a raw palette colour', () => {
    const classes = [
      avatarStyle({}),
      avatarFallbackTextStyle({}),
      avatarImageStyle({}),
      avatarBadgeStyle({}),
    ].join(' ')
    const match = classes.match(RAW_COLOR_PATTERN)
    expect(match?.[0], 'avatar uses a raw colour').toBeUndefined()
  })

  it('expresses the muted background semantic token', () => {
    expect(avatarStyle({})).toMatch(/\bbg-muted\b/)
  })
})
