import { describe, expect, it } from 'vitest'

import { DEFAULT_SAFE_AREA_EDGES, resolveSafeAreaPadding } from '../style'

const insets = { top: 47, right: 12, bottom: 34, left: 12 }

describe('resolveSafeAreaPadding', () => {
  it('applies every edge by default', () => {
    expect(DEFAULT_SAFE_AREA_EDGES).toEqual(['top', 'right', 'bottom', 'left'])
    expect(resolveSafeAreaPadding(insets, DEFAULT_SAFE_AREA_EDGES)).toEqual({
      paddingTop: 47,
      paddingRight: 12,
      paddingBottom: 34,
      paddingLeft: 12,
    })
  })

  it('zeroes out edges that are not requested', () => {
    expect(resolveSafeAreaPadding(insets, ['top', 'bottom'])).toEqual({
      paddingTop: 47,
      paddingRight: 0,
      paddingBottom: 34,
      paddingLeft: 0,
    })
  })

  it('returns all zeroes when no edges are requested', () => {
    expect(resolveSafeAreaPadding(insets, [])).toEqual({
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    })
  })
})
