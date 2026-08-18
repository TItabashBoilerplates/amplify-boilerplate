/**
 * 認証フローの i18n メッセージキー（Web / Mobile 共有）
 *
 * ## なぜ共有するのか
 *
 * これらは**翻訳ファイルとの契約**であって、プラットフォーム固有の実装詳細ではない。
 * web と mobile で別々に持つと、片方にキーを足したときにもう片方の翻訳が
 * 追従せず、**そのプラットフォームでだけキー文字列が画面に出る**（`emailRequired`
 * とそのまま表示される）という形で壊れる。しかも**型チェックも lint も通る**ので、
 * その画面を実際に踏むまで気づけない。
 *
 * `.claude/rules/minimal-implementation.md` §2.1 が「不整合が事故になるもの
 * （バリデーション規則・API 契約）は 2 回目で即共通化」と定めている対象。
 *
 * ## 何を共有し、何を共有しないか
 *
 * 共有するのは**キーの集合**だけ。戻り値の器はプラットフォームで違ってよい
 * （Web は Server Action + `useActionState`、Mobile は直接呼び出し）。
 */

/**
 * 成功時のメッセージキー（i18n の `Auth.success.<key>`）
 *
 * Cognito のパスワード再設定は **Web / Mobile とも 6 桁コード方式**なので、
 * Supabase 版と違い `passwordResetSent` は 1 つでよい（`.claude/rules/auth.md` §3.2）。
 */
export const AUTH_SUCCESS_KEYS = [
  'signedIn',
  'signUpConfirmationSent',
  'signUpConfirmed',
  'passwordResetCodeSent',
  'passwordUpdated',
  'emailChangeRequested',
  'emailChanged',
  'accountDeleted',
] as const

export type AuthSuccessKey = (typeof AUTH_SUCCESS_KEYS)[number]

/**
 * クライアント側バリデーションのメッセージキー（i18n の `Auth.errors.<key>`）
 *
 * Cognito が返すサーバー側エラーは `AuthErrorMessageKey`（`./errors`）で別に持つ。
 * 「送信前に弾いたもの」と「サーバーが拒否したもの」は原因も文言も違うため分けている。
 */
export const AUTH_VALIDATION_KEYS = [
  'emailRequired',
  'emailInvalidFormat',
  'passwordRequired',
  'passwordTooWeak',
  'passwordMismatch',
  'currentPasswordRequired',
  'codeRequired',
  'deleteConfirmationMismatch',
] as const

export type AuthValidationKey = (typeof AUTH_VALIDATION_KEYS)[number]
