import { describe, expect, it } from 'vitest'
import {
  buildDerivativePath,
  IMAGE_WIDTH_LADDER,
  isDerivativePath,
  MAX_IMAGE_WIDTH,
  snapImageWidth,
} from './ladder'

describe('IMAGE_WIDTH_LADDER', () => {
  it('is strictly ascending（段が昇順でないと丸めが壊れる）', () => {
    const sorted = [...IMAGE_WIDTH_LADDER].sort((a, b) => a - b)
    expect([...IMAGE_WIDTH_LADDER]).toEqual(sorted)
    expect(new Set(IMAGE_WIDTH_LADDER).size).toBe(IMAGE_WIDTH_LADDER.length)
  })

  it('stays within the Next.js image optimizer の実用範囲', () => {
    expect(MAX_IMAGE_WIDTH).toBe(2048)
  })
})

describe('snapImageWidth', () => {
  it('rounds up to the smallest step >= requested', () => {
    expect(snapImageWidth(1)).toBe(16)
    expect(snapImageWidth(16)).toBe(16)
    expect(snapImageWidth(17)).toBe(32)
    expect(snapImageWidth(40)).toBe(48)
    expect(snapImageWidth(1000)).toBe(1080)
  })

  it('rounds fractional widths up before snapping（DPR 倍で小数になる）', () => {
    expect(snapImageWidth(40 * 2.625)).toBe(128)
  })

  it('clamps above the ladder to the max step', () => {
    expect(snapImageWidth(5000)).toBe(MAX_IMAGE_WIDTH)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('throws on %s', (value) => {
    expect(() => snapImageWidth(value)).toThrow(/positive finite number/)
  })
})

describe('buildDerivativePath', () => {
  it('inserts the snapped width before the extension', () => {
    expect(buildDerivativePath('media/u1/avatar.jpg', 40)).toBe('media/u1/avatar@48w.jpg')
    expect(buildDerivativePath('public/hero/cover.jpeg', 1080)).toBe('public/hero/cover@1080w.jpeg')
  })

  it('appends when there is no extension', () => {
    expect(buildDerivativePath('media/u1/avatar', 64)).toBe('media/u1/avatar@64w')
  })

  /** `media/v1.2/avatar` のようにディレクトリ名だけに `.` がある場合 */
  it('does not treat a dot in a directory name as an extension', () => {
    expect(buildDerivativePath('media/v1.2/avatar', 64)).toBe('media/v1.2/avatar@64w')
  })

  it('snaps the width itself（呼び出し側の生の幅をそのまま埋め込まない）', () => {
    expect(buildDerivativePath('a/b.png', 33)).toBe('a/b@48w.png')
  })
})

describe('isDerivativePath', () => {
  /**
   * 派生の書き戻しが再び S3 イベントを起こすので、生成側はこれで自分の出力を弾く。
   * 弾かないと**無限ループになり料金だけが増え続ける**。
   */
  it('recognises generated derivatives', () => {
    expect(isDerivativePath('media/u1/avatar@128w.jpg')).toBe(true)
    expect(isDerivativePath('media/u1/avatar@16w')).toBe(true)
  })

  it('does not flag originals', () => {
    expect(isDerivativePath('media/u1/avatar.jpg')).toBe(false)
    expect(isDerivativePath('media/u1/avatar')).toBe(false)
    // 途中に `@…w` があってもファイル名末尾でなければ派生ではない
    expect(isDerivativePath('media/@128w/avatar.jpg')).toBe(false)
  })

  it('round-trips with buildDerivativePath', () => {
    expect(isDerivativePath(buildDerivativePath('media/u1/avatar.jpg', 40))).toBe(true)
  })
})
