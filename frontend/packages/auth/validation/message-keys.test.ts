import { describe, expect, it } from 'vitest'
import { AUTH_SUCCESS_KEYS, AUTH_VALIDATION_KEYS } from './message-keys'

/**
 * キー集合そのものを固定する。web / mobile の翻訳ファイルはこの集合を参照して
 * 検査される（`required-flows.test.ts`）ので、ここが正本になる。
 */
describe('メッセージキー', () => {
  it('成功キーに重複が無い', () => {
    expect(new Set(AUTH_SUCCESS_KEYS).size).toBe(AUTH_SUCCESS_KEYS.length)
  })

  it('バリデーションキーに重複が無い', () => {
    expect(new Set(AUTH_VALIDATION_KEYS).size).toBe(AUTH_VALIDATION_KEYS.length)
  })

  it('成功キーとバリデーションキーが衝突しない（namespace が違うので混ざると事故る）', () => {
    const overlap = AUTH_SUCCESS_KEYS.filter((key) =>
      (AUTH_VALIDATION_KEYS as readonly string[]).includes(key)
    )
    expect(overlap).toEqual([])
  })

  it('必須導線に対応するキーが揃っている', () => {
    expect(AUTH_SUCCESS_KEYS).toContain('passwordResetCodeSent')
    expect(AUTH_SUCCESS_KEYS).toContain('passwordUpdated')
    expect(AUTH_SUCCESS_KEYS).toContain('emailChangeRequested')
    expect(AUTH_SUCCESS_KEYS).toContain('accountDeleted')
  })
})
