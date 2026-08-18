import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'

/**
 * 認証画面の外枠（ログイン / サインアップ / パスワード再設定で共通）
 *
 * **同じ `<div className="flex min-h-screen items-center justify-center …">` を
 * 画面ごとにコピペしないための共有部品**（`.claude/rules/clean-code.md`）。
 * 4 画面に散らすと、片方だけ余白やカード幅を直して不整合が残る。
 */
export function AuthCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-2xl">{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
