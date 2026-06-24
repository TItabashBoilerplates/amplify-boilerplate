'use client'

/**
 * ヘッダーコンポーネント
 *
 * @module widgets/header/ui/Header
 */

/**
 * アプリケーションヘッダー（Client Component）
 *
 * - fixed positioning で画面上部に固定
 * - flex justify-between で左右配置
 * - 左側にロゴのみ表示
 */
export function Header() {
  return (
    <div className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border bg-background px-8 shadow-md">
      {/* ロゴエリア */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <span className="text-lg font-black text-primary-foreground">A</span>
        </div>
        <h1 className="text-2xl font-bold">App</h1>
      </div>
    </div>
  )
}
