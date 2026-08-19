import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui'
import { Monitor, Package, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getPlatformLabel } from '@/shared/lib/platform'

/**
 * デスクトップアプリのホーム画面（FSD views レイヤー）。
 *
 * UI は `@workspace/ui`（shadcn/ui）をそのまま使う。**デスクトップ用に
 * コンポーネントやクラス文字列を複製しない**（`.claude/rules/clean-code.md`）。
 */
export function HomePage() {
  const [platform, setPlatform] = useState<string | null>(null)

  // Tauri の API はブラウザには存在しないため、マウント後にだけ触る
  // （`frontend/CLAUDE.md` の mounted パターンと同じ理由）。
  useEffect(() => {
    let cancelled = false

    getPlatformLabel()
      .then((label) => {
        if (!cancelled) setPlatform(label)
      })
      .catch((error: unknown) => {
        // 握りつぶさない。取得できないこと自体は致命的ではないので表示だけ落とす。
        console.error('プラットフォーム情報の取得に失敗:', error)
        if (!cancelled) setPlatform(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="bg-background text-foreground min-h-screen">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Monitor className="size-5" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-tight">デスクトップアプリ</h1>
            {platform ? <Badge variant="secondary">{platform}</Badge> : null}
          </div>
          <p className="text-muted-foreground text-sm">
            Tauri 2 + Vite + React。UI は Web と同じ <code>@workspace/ui</code> を共有しています。
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4" aria-hidden="true" />
                共有デザインシステム
              </CardTitle>
              <CardDescription>
                shadcn/ui とデザイントークンを Web / Desktop で共有します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm">プライマリ</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="size-4" aria-hidden="true" />
                ネイティブ WebView
              </CardTitle>
              <CardDescription>
                Electron と違い Chromium を同梱せず、OS の WebView に描画します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline">
                セカンダリ
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
