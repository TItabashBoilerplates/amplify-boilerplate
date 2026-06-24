'use client'

import NextError from 'next/error'

/**
 * ルート not-found ページ
 * ロケールプレフィックスがないパスに対して表示される
 */
export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <NextError statusCode={404} />
      </body>
    </html>
  )
}
