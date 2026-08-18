/**
 * パスワードポリシー（Web / Mobile 共有）
 *
 * **Cognito User Pool の `passwordPolicy` と一対一に対応させること。**
 *
 * ```ts
 * // frontend/packages/backend/amplify/backend.ts
 * cfnUserPool.policies = {
 *   passwordPolicy: {
 *     minimumLength: 12,
 *     requireLowercase: true,
 *     requireUppercase: true,
 *     requireNumbers: true,
 *     requireSymbols: true,
 *   },
 * }
 * ```
 *
 * ここでの検証は「サーバーに弾かれる前に親切に教える」ための **UX 上の先出し**であって、
 * セキュリティ境界ではない（本当の判定は Cognito が行い `InvalidPasswordException` を返す）。
 * したがって **設定より緩くても厳しくてもいけない**: 緩いと「フォームは通ったのに失敗」、
 * 厳しいとサーバーが受け付けるパスワードを弾いてしまう。
 *
 * 設定を変えたら、この定数とテストも同じコミットで更新する。
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-policies.html
 */

/** Cognito の `minimumLength` と一致させる。公式は「8 文字以上」を複雑なパスワードの条件としている。 */
export const PASSWORD_MIN_LENGTH = 12

/**
 * Cognito がユーザーに許可するパスワードの最大長（公式: "users can set passwords up to
 * 256 characters long"）。`<input maxLength>` に使う。
 */
export const PASSWORD_MAX_LENGTH = 256

/**
 * Cognito が「特殊文字」として認める文字（公式ドキュメントの列挙そのまま）。
 *
 * ```
 * ^ $ * . [ ] { } ( ) ? " ! @ # % & / \ , > < ' : ; | _ ~ ` = + -
 * ```
 *
 * **独自に拡張してはならない**（ここに無い文字は Cognito 側で特殊文字として数えられず、
 * 「フォームは通ったのに InvalidPasswordException」になる）。
 *
 * 半角スペースは別扱い: 公式は「**non-leading, non-trailing** space characters」を
 * 特殊文字として認めるため、{@link getPasswordIssues} で位置を見て判定する。
 */
export const PASSWORD_SYMBOLS = '^$*.[]{}()?"!@#%&/\\,><\':;|_~`=+-'

export const PASSWORD_ISSUES = [
  'too_short',
  'missing_lowercase',
  'missing_uppercase',
  'missing_digit',
  'missing_symbol',
] as const

export type PasswordIssue = (typeof PASSWORD_ISSUES)[number]

const SYMBOL_SET = new Set(PASSWORD_SYMBOLS)

/**
 * 特殊文字を 1 つ以上含むか。
 *
 * 内側の半角スペースも Cognito は特殊文字として数えるので、**先頭・末尾以外の
 * スペース**を許容する（ここを落とすと、サーバーが受け付けるパスワードを
 * クライアントが弾いてしまう）。
 */
function hasSymbol(password: string): boolean {
  return [...password].some((char, index) => {
    if (SYMBOL_SET.has(char)) {
      return true
    }
    const isInnerSpace = char === ' ' && index > 0 && index < password.length - 1
    return isInnerSpace
  })
}

/**
 * 満たしていない要件を返す。
 *
 * 順序は `PASSWORD_ISSUES` の宣言順で安定させている（UI のチェックリストが
 * 入力のたびに並び替わらないようにするため）。
 *
 * @returns 満たしていない要件の配列。空配列ならポリシーを満たしている
 */
export function getPasswordIssues(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = []

  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push('too_short')
  }
  if (!/[a-z]/.test(password)) {
    issues.push('missing_lowercase')
  }
  if (!/[A-Z]/.test(password)) {
    issues.push('missing_uppercase')
  }
  if (!/[0-9]/.test(password)) {
    issues.push('missing_digit')
  }
  if (!hasSymbol(password)) {
    issues.push('missing_symbol')
  }

  return issues
}

export function isPasswordValid(password: string): boolean {
  return getPasswordIssues(password).length === 0
}

/**
 * 新パスワードと確認用入力の一致判定。
 *
 * **両方空のときは `false`** を返す。未入力を「一致している」と扱うと、
 * 送信ボタンが有効化されてしまうため。
 */
export function passwordsMatch(password: string, confirmation: string): boolean {
  if (password.length === 0) {
    return false
  }
  return password === confirmation
}
