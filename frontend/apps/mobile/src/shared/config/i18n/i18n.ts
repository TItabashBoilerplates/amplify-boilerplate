import { getLocales } from 'expo-localization'
import { I18n } from 'i18n-js'

import { en } from './translations/en'
import { ja } from './translations/ja'

// 翻訳データを設定
const translations = { en, ja }

// i18n インスタンスを作成
const i18n = new I18n(translations)

// デバイスのロケールを取得してデフォルト設定
const deviceLocale = getLocales()[0]?.languageCode ?? 'en'
i18n.locale = deviceLocale

// フォールバックを有効化（キーが見つからない場合は英語にフォールバック）
i18n.enableFallback = true
i18n.defaultLocale = 'en'

// サポートするロケールのリスト
export const supportedLocales = ['en', 'ja'] as const
export type Locale = (typeof supportedLocales)[number]

// ロケール変更関数
export function setLocale(locale: Locale): void {
  i18n.locale = locale
}

// 現在のロケール取得
export function getLocale(): Locale {
  return i18n.locale as Locale
}

export { i18n }
