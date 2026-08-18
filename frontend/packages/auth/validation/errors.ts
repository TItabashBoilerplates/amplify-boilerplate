/**
 * Cognito / Amplify Auth のエラー → 安定した i18n キーへの変換（Web / Mobile 共有）
 *
 * ## なぜ必要か
 *
 * `aws-amplify/auth` が throw するエラーの `message` は **英語の実装都合の文言**で、
 * ユーザーに見せる前提のものではない。そのまま画面に出すと (a) 日本語ロケールで英語が出る
 * (b) 文言が SDK / サービス側の更新で無言に変わる (c) 何をすれば直るのか分からない、の
 * 3 つが同時に起きる。
 *
 * そこで **`error.name`（Cognito の例外名 = 安定した識別子）だけを見て i18n キーへ落とす**。
 *
 * ## 握りつぶさない
 *
 * 未知の例外は `unexpected` にフォールバックするが、**原文は `raw` に保持**して
 * 呼び出し側がログに出せるようにしている（`.claude/rules/error-handling.md`）。
 *
 * ## ユーザー列挙（user existence）について
 *
 * Cognito には **`PreventUserExistenceErrors: ENABLED`**（本リポジトリの既定）があり、
 * 有効なときサインインは `UserNotFoundException` ではなく `NotAuthorizedException` を返す。
 * ただし **サインアップの `UsernameExistsException` は抑止されない**ため、
 * `revealsAccountExistence` が true のエラーは**画面に出してはならない**
 * （成功時と同じ文言を返す。`.claude/rules/auth.md` §3.2）。
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pool-managing-errors.html
 */

export const AUTH_ERROR_MESSAGE_KEYS = [
  'invalidCredentials',
  'emailNotConfirmed',
  'weakPassword',
  'samePassword',
  'codeMismatch',
  'codeExpired',
  'codeDeliveryFailed',
  'rateLimited',
  'emailExists',
  'userNotFound',
  'emailInvalid',
  'signupDisabled',
  'userDisabled',
  'sessionExpired',
  'passwordResetRequired',
  'validationFailed',
  'forbidden',
  'unexpected',
] as const

export type AuthErrorMessageKey = (typeof AUTH_ERROR_MESSAGE_KEYS)[number]

export type ResolvedAuthError = {
  /** i18n の `Auth.errors.<key>` を引くためのキー */
  messageKey: AuthErrorMessageKey
  /** Cognito の例外名（未知の場合は undefined）。ログ用 */
  name?: string
  /** 元メッセージ。**ログ専用**でユーザーには見せない */
  raw?: string
  /**
   * パスワード再設定へ誘導すべきか。
   *
   * 管理者がリセットを要求した状態（`PasswordResetRequiredException`）や、
   * サインイン後の `nextStep` が `RESET_PASSWORD` になるケースがある。
   * ここを無視するとログイン画面が行き止まりになる。
   */
  requiresPasswordReset: boolean
  /**
   * サインアップ確認（確認コード入力）へ誘導すべきか。
   *
   * `UserNotConfirmedException` を「パスワードが違います」と表示すると、
   * ユーザーは永久に確認できない。
   */
  requiresConfirmation: boolean
  /**
   * そのアカウントが存在するかどうかを暴露しうるエラーか。
   *
   * **パスワード再設定・サインアップの画面ではこのエラーを表示してはならない**
   * （ユーザー列挙攻撃の入口になる）。成功時と同じ文言を返すこと。
   */
  revealsAccountExistence: boolean
}

/** `name` を持ちうる緩い型（Cognito の例外 / 素の Error / unknown を受ける） */
type MaybeAuthError = { name?: unknown; message?: unknown } | Error | null | undefined

const NAME_TO_KEY: Record<string, AuthErrorMessageKey> = {
  // 資格情報
  NotAuthorizedException: 'invalidCredentials',
  UserNotConfirmedException: 'emailNotConfirmed',
  PasswordResetRequiredException: 'passwordResetRequired',

  // パスワード
  InvalidPasswordException: 'weakPassword',
  PasswordHistoryPolicyViolationException: 'samePassword',

  // 確認コード
  CodeMismatchException: 'codeMismatch',
  ExpiredCodeException: 'codeExpired',
  CodeDeliveryFailureException: 'codeDeliveryFailed',

  // レート制限
  LimitExceededException: 'rateLimited',
  TooManyRequestsException: 'rateLimited',
  TooManyFailedAttemptsException: 'rateLimited',

  // アカウントの存在
  UsernameExistsException: 'emailExists',
  AliasExistsException: 'emailExists',
  UserNotFoundException: 'userNotFound',

  // 入力
  InvalidParameterException: 'validationFailed',
  InvalidEmailRoleAccessPolicyException: 'emailInvalid',
  UserLambdaValidationException: 'validationFailed',

  // 状態
  UserDisabledException: 'userDisabled',
  SignUpDisabledException: 'signupDisabled',
  ForbiddenException: 'forbidden',
  InternalErrorException: 'unexpected',

  // セッション（Amplify クライアント側）
  UserUnAuthenticatedException: 'sessionExpired',
  NotAuthorizedError: 'sessionExpired',
}

/** アカウントの存在を暴露しうる例外（列挙攻撃対策で表示を抑制する対象） */
const ACCOUNT_EXISTENCE_NAMES = new Set([
  'UsernameExistsException',
  'AliasExistsException',
  'UserNotFoundException',
])

export function resolveAuthError(error: MaybeAuthError): ResolvedAuthError | null {
  if (!error) {
    return null
  }

  const name =
    typeof (error as { name?: unknown }).name === 'string'
      ? (error as { name: string }).name
      : undefined
  const raw =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : undefined

  // `name` が空文字のケースがあるため `??` で繋がない（`'' ?? x` は `''` になる）
  const mapped = name ? NAME_TO_KEY[name] : undefined

  return {
    messageKey: mapped ?? 'unexpected',
    name,
    raw,
    requiresPasswordReset: name === 'PasswordResetRequiredException',
    requiresConfirmation: name === 'UserNotConfirmedException',
    revealsAccountExistence: name ? ACCOUNT_EXISTENCE_NAMES.has(name) : false,
  }
}
