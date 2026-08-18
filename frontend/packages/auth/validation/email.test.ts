import { describe, expect, it } from 'vitest'
import { isValidEmail, normalizeEmail } from './email'

describe('isValidEmail', () => {
  it.each([
    'user@example.com',
    'user.name+tag@example.co.jp',
    'u@e.io',
    "o'brien@example.com",
    'user_name@sub.example.com',
  ])('妥当なアドレスを受け付ける: %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each([
    '',
    'user',
    'user@',
    '@example.com',
    'user@example',
    'user @example.com',
    'user@exa mple.com',
    'user@@example.com',
    'user@example..com',
  ])('不正なアドレスを弾く: %s', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })

  it('前後の空白は入力ミスとして許容し、trim して判定する', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true)
  })
})

describe('normalizeEmail', () => {
  it('前後の空白を除去し小文字化する', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })

  it('ローカル部の大文字も小文字化する（Cognito の email alias は大小を区別しない）', () => {
    expect(normalizeEmail('First.Last@Example.com')).toBe('first.last@example.com')
  })
})
