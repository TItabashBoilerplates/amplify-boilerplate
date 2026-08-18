/**
 * アプリ全体で使う非 i18n の定数（URL・名称）
 *
 * ページごとの i18n メタデータは `Metadata` メッセージを使うが、
 * sitemap / robots / manifest / OG 画像など「単一ファイルで多言語化できない」箇所は
 * ここの定数を single source として参照する。
 *
 * `NEXT_PUBLIC_` prefix はビルド時にクライアントバンドルへ焼き込まれるので、
 * **公開してよい値だけ**を置く（`.claude/rules/env-naming.md`）。
 *
 * @module shared/config
 */

/** 本番の公開 URL。metadataBase / sitemap / robots / manifest で使用 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/** PWA manifest / OG 画像などで使うアプリ名 */
export const APP_NAME = 'Amplify Boilerplate'
