---
name: shadcn-ui
description: shadcn/ui + TailwindCSS 4 による UI 実装ガイダンス。コンポーネント追加、CSS変数の使用、アクセシビリティ、ダークモード対応についての質問に使用。統一的なデザインシステムの実装支援を提供。
---

# shadcn/ui スキル

このプロジェクトは **shadcn/ui + TailwindCSS 4** を使用した統一的なデザインシステムを採用しています。

## 構成

| 項目 | 場所 |
|------|------|
| shadcn/ui 設定 | `frontend/packages/ui/components.json` |
| CSS 変数定義 | `frontend/apps/web/app/globals.css` |
| デザイントークン | `frontend/packages/tokens/src/` |
| 共有コンポーネント | `frontend/packages/ui/components/` |

## 基盤技術

- **Radix UI Primitives**: アクセシビリティ対応の基盤
- **TailwindCSS 4**: CSS 変数ベースのスタイリング
- **TypeScript**: 型安全なコンポーネント

## コンポーネント追加

```bash
# frontend ディレクトリから実行
cd frontend
bun run ui:add:web <component-name>

# 例: 複数コンポーネントを追加
bun run ui:add:web button card input dialog

# または直接実行
cd packages/ui && bunx shadcn@canary add button
```

コンポーネントは `packages/ui/components/` にインストールされます。

## インポートパターン

```typescript
// workspace パッケージから（推奨）
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'

// ユーティリティ
import { cn } from '@workspace/ui/lib/utils'
```

## CSS 変数の使用（必須）

### 正しい使い方

```typescript
// ✅ Good: CSS 変数を使用
<Card className="border-border bg-background">
  <CardHeader>
    <CardTitle className="text-foreground">タイトル</CardTitle>
    <CardDescription className="text-muted-foreground">説明文</CardDescription>
  </CardHeader>
  <CardContent>
    <Button variant="default">ボタン</Button>
  </CardContent>
</Card>
```

### 禁止パターン

```typescript
// ❌ Bad: ハードコードされた色
<Card className="border-gray-200 bg-white">
  <h2 className="text-black">タイトル</h2>
  <p className="text-gray-600">説明文</p>
</Card>

// ❌ Bad: 直接の色指定
<div className="bg-#ffffff text-#000000">...</div>
<div style={{ backgroundColor: 'white' }}>...</div>
```

## 主要な CSS 変数

| 変数 | 用途 |
|------|------|
| `--background` / `bg-background` | 背景色 |
| `--foreground` / `text-foreground` | テキスト色 |
| `--primary` / `bg-primary` | プライマリカラー |
| `--secondary` / `bg-secondary` | セカンダリカラー |
| `--muted` / `bg-muted` | ミュートカラー |
| `--muted-foreground` / `text-muted-foreground` | ミュートテキスト |
| `--accent` / `bg-accent` | アクセントカラー |
| `--destructive` / `bg-destructive` | エラー・削除色 |
| `--border` / `border-border` | ボーダー色 |
| `--ring` / `ring-ring` | フォーカスリング |
| `--card` / `bg-card` | カード背景 |

## ダークモード対応

TailwindCSS の `dark:` プレフィックスで自動切り替え:

```typescript
<div className="bg-background dark:bg-background">
  <p className="text-foreground dark:text-foreground">
    ダークモード対応テキスト
  </p>
</div>
```

CSS 変数は `globals.css` で定義:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}
```

## アクセシビリティ

### Radix UI の自動機能

- ARIA 属性の自動付与
- キーボードナビゲーション
- フォーカス管理
- スクリーンリーダー対応

### ガイドライン

1. **コントラスト比**: WCAG AA 基準を満たす
2. **色のみに依存しない**: アイコンやテキストで補完
3. **フォーカス表示**: `focus-visible` で明確に
4. **セマンティック HTML**: 適切な要素を使用

```typescript
// ✅ Good: アクセシブルなボタン
<Button aria-label="メニューを開く">
  <MenuIcon className="h-4 w-4" />
</Button>

// ✅ Good: フォームラベル
<div className="grid gap-2">
  <Label htmlFor="email">メールアドレス</Label>
  <Input id="email" type="email" placeholder="example@example.com" />
</div>
```

## レスポンシブデザイン

TailwindCSS のレスポンシブユーティリティを使用:

```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  <Card className="p-4 sm:p-6">
    <CardTitle className="text-lg md:text-xl lg:text-2xl">
      レスポンシブタイトル
    </CardTitle>
  </Card>
</div>
```

| プレフィックス | ブレークポイント |
|--------------|----------------|
| `sm:` | 640px 以上 |
| `md:` | 768px 以上 |
| `lg:` | 1024px 以上 |
| `xl:` | 1280px 以上 |
| `2xl:` | 1536px 以上 |

## Button バリエーション

```typescript
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="destructive">Destructive</Button>

// サイズ
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><IconComponent /></Button>
```

## 使用例

### カード + フォーム

```typescript
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'

export function LoginCard() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
        <CardDescription>
          アカウントにログインしてください
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">メールアドレス</Label>
          <Input id="email" type="email" placeholder="example@example.com" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">パスワード</Label>
          <Input id="password" type="password" />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">ログイン</Button>
      </CardFooter>
    </Card>
  )
}
```

### ダイアログ

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'

export function ConfirmDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">設定を開く</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
          <DialogDescription>
            アプリケーションの設定を変更できます
          </DialogDescription>
        </DialogHeader>
        {/* コンテンツ */}
      </DialogContent>
    </Dialog>
  )
}
```

## 新しい色の追加

`globals.css` に CSS 変数を追加:

```css
:root {
  /* 既存の変数 */
  --background: oklch(1 0 0);

  /* 新しいカスタム変数 */
  --success: oklch(0.6 0.2 145);
  --warning: oklch(0.8 0.15 85);
}

.dark {
  --success: oklch(0.5 0.15 145);
  --warning: oklch(0.7 0.12 85);
}
```

`tailwind.config.ts` に追加:

```typescript
// TailwindCSS 4 では通常不要（CSS 変数が自動認識される）
// 必要な場合のみ設定
```

## チェックリスト

- [ ] ハードコードされた色を使用していない
- [ ] CSS 変数（`text-foreground`, `bg-background` 等）を使用
- [ ] アクセシビリティ対応（ラベル、ARIA 属性）
- [ ] レスポンシブデザイン対応
- [ ] ダークモード対応
