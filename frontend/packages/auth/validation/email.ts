/**
 * メールアドレスの検証・正規化（Web / Mobile 共有）
 *
 * 目的は **入力ミスの早期発見**であって RFC 5322 の完全な実装ではない
 * （完全な検証は不可能で、唯一の確実な確認方法は「確認コードが届くこと」）。
 * したがってここでは「明らかに送れないもの」だけを弾き、判定に迷うものは通す。
 */

/**
 * ローカル部 + `@` + ラベル 1 つ以上 + TLD。
 *
 * - 空白を含むものは弾く
 * - `@` は 1 つだけ
 * - ドットの連続（`example..com`）とドット始まり/終わりは弾く
 * - TLD は 2 文字以上の英字
 */
const EMAIL_PATTERN = /^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)*\.[A-Za-z]{2,}$/

/**
 * 入力ミスを許容するため **trim してから**判定する。
 * （コピー&ペーストで前後に空白が入るのはよくある操作ミスであり、
 * それを「不正なアドレス」として叱るのはユーザーに不親切）
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

/**
 * Cognito に渡す前の正規化。
 *
 * 本リポジトリの User Pool は `email` をサインイン識別子（alias）にしている。
 * Cognito は alias の照合を大文字小文字を区別せずに行うが、**アプリ側で表示・
 * 比較する値がバラつくと「登録したはずのアドレスでログインできない」ように見える**
 * 表示上の不一致が起きるため、クライアント側でも揃えておく。
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
