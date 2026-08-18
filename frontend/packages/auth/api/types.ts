import type { AuthErrorMessageKey, AuthSuccessKey, AuthValidationKey } from '../validation'

/**
 * 認証 API の戻り値（Web / Mobile 共通の考え方）
 *
 * `aws-amplify/auth` は `{ data, errors }` を返さず **throw する**ため、
 * `features/auth/api/*` が Boundary として catch し、この形に落とす
 * （`.claude/rules/error-handling.md`）。
 *
 * **メッセージ文字列ではなく i18n キーを返す**のが要点。SDK の英語文言をそのまま
 * 画面に出すと (a) 日本語ロケールで英語が出る (b) SDK 更新で文言が無言に変わる
 * (c) 何をすれば直るのか分からない、が同時に起きる（`.claude/rules/i18n.md`）。
 */
export type AuthErrorKey = AuthErrorMessageKey | AuthValidationKey

export type AuthFailure = {
  success: false
  /** i18n の `Auth.errors.<key>` を引くキー */
  errorKey: AuthErrorKey
  /** パスワード再設定へ誘導すべきか（誘導しないとログイン画面が行き止まりになる） */
  requiresPasswordReset?: boolean
  /** サインアップ確認コード画面へ誘導すべきか */
  requiresConfirmation?: boolean
}

export type AuthSuccess<TNext extends string = never> = {
  success: true
  /** i18n の `Auth.success.<key>` を引くキー（画面に何も出さない場合は省略） */
  successKey?: AuthSuccessKey
  /** 続けてユーザーに求める操作（フォームの遷移先を決めるために使う） */
  nextStep?: TNext
}

export type AuthResult<TNext extends string = never> = AuthSuccess<TNext> | AuthFailure
