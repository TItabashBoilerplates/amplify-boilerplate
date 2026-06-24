'use client'

import { Link } from '@/shared/lib/i18n'

/**
 * 言語切り替えコンポーネント（Client Component）
 * ユーザーインタラクション（言語切り替え）を処理するため、Client Componentとして実装
 */
export function LanguageSwitcher() {
  return (
    <div className="flex gap-4">
      <Link
        href="/"
        locale="en"
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        English
      </Link>
      <Link
        href="/"
        locale="ja"
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        日本語
      </Link>
    </div>
  )
}
