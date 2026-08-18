import { describe, expect, it } from 'vitest'
import {
  getPasswordIssues,
  isPasswordValid,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SYMBOLS,
  passwordsMatch,
} from './password'

/**
 * ここが Cognito の `passwordPolicy` とズレると、
 * 「フォームは通ったのに InvalidPasswordException」または
 * 「サーバーが受け付けるパスワードをフォームが弾く」のどちらかが起きる。
 */
describe('ポリシー定数', () => {
  it('最低長は 8 未満にしない（公式が 8 文字以上を条件としている）', () => {
    expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8)
  })

  it('最大長は Cognito の上限 256 と一致する', () => {
    expect(PASSWORD_MAX_LENGTH).toBe(256)
  })

  it('特殊文字の集合が Cognito 公式の列挙と完全に一致する', () => {
    // 公式: ^ $ * . [ ] { } ( ) ? " ! @ # % & / \ , > < ' : ; | _ ~ ` = + -
    const official = [
      '^',
      '$',
      '*',
      '.',
      '[',
      ']',
      '{',
      '}',
      '(',
      ')',
      '?',
      '"',
      '!',
      '@',
      '#',
      '%',
      '&',
      '/',
      '\\',
      ',',
      '>',
      '<',
      "'",
      ':',
      ';',
      '|',
      '_',
      '~',
      '`',
      '=',
      '+',
      '-',
    ]
    expect([...new Set(PASSWORD_SYMBOLS)].sort()).toEqual([...official].sort())
  })
})

describe('getPasswordIssues', () => {
  it('すべて満たすパスワードは issue 無し', () => {
    expect(getPasswordIssues('Str0ng-Passw0rd!')).toEqual([])
  })

  it('短いパスワードは too_short', () => {
    expect(getPasswordIssues('Ab1!')).toContain('too_short')
  })

  it.each([
    ['ALLUPPER1234!X', 'missing_lowercase'],
    ['alllower1234!x', 'missing_uppercase'],
    ['NoDigitsHere!!x', 'missing_digit'],
    ['NoSymbolsHere12', 'missing_symbol'],
  ])('%s は %s を返す', (password, issue) => {
    expect(getPasswordIssues(password)).toContain(issue)
  })

  it('issue の順序は宣言順で安定する（UI のチェックリストが並び替わらない）', () => {
    expect(getPasswordIssues('')).toEqual([
      'too_short',
      'missing_lowercase',
      'missing_uppercase',
      'missing_digit',
      'missing_symbol',
    ])
  })

  /**
   * 公式は「non-leading, non-trailing space characters」を特殊文字として認める。
   * ここを落とすと、Cognito が受け付けるパスワードをクライアントが弾いてしまう。
   */
  it('内側の半角スペースは特殊文字として数える', () => {
    expect(getPasswordIssues('Correct Horse1x')).not.toContain('missing_symbol')
  })

  it('先頭・末尾のスペースは特殊文字として数えない', () => {
    expect(getPasswordIssues(' CorrectHorse1x')).toContain('missing_symbol')
    expect(getPasswordIssues('CorrectHorse1x ')).toContain('missing_symbol')
  })
})

describe('isPasswordValid', () => {
  it('ポリシーを満たすときだけ true', () => {
    expect(isPasswordValid('Str0ng-Passw0rd!')).toBe(true)
    expect(isPasswordValid('weak')).toBe(false)
  })
})

describe('passwordsMatch', () => {
  it('一致していれば true', () => {
    expect(passwordsMatch('Str0ng-Passw0rd!', 'Str0ng-Passw0rd!')).toBe(true)
  })

  it('一致していなければ false', () => {
    expect(passwordsMatch('Str0ng-Passw0rd!', 'other')).toBe(false)
  })

  it('未入力を「一致」と扱わない（送信ボタンが有効化されてしまうため）', () => {
    expect(passwordsMatch('', '')).toBe(false)
  })
})
