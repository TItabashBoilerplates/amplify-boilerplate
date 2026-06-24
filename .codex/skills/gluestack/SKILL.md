---
name: gluestack
description: gluestack-ui + NativeWind によるモバイル UI 実装ガイダンス。コンポーネント追加、tva（Tailwind Variant Authority）、Expo 連携、Supabase 認証についての質問に使用。React Native でのアクセシブルな UI 実装支援を提供。
---

# gluestack-ui + NativeWind ガイダンス

React Native (Expo) アプリケーションにおける gluestack-ui コンポーネント実装のガイダンス。

## 概要

このプロジェクトの Mobile アプリ (`frontend/apps/mobile/`) は以下の技術スタックを使用：

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Expo | 55+ | React Native フレームワーク |
| gluestack-ui | 1.x | アクセシブルなUIプリミティブ |
| NativeWind | 5.0 | TailwindCSS for React Native |
| tva | - | Tailwind Variant Authority |
| lucide-react-native | - | アイコンライブラリ |

## アーキテクチャ

### コンポーネント配置

```
frontend/
├── packages/ui/mobile/              # gluestack-ui コンポーネント（共有）
│   ├── components/
│   │   ├── button/
│   │   │   └── index.tsx
│   │   ├── gluestack-ui-provider/   # プロバイダー
│   │   │   └── index.tsx
│   │   └── ...
│   ├── layout/                      # レイアウトコンポーネント
│   ├── hooks/                       # Mobile固有フック
│   └── gluestack-ui.config.json     # CLI設定
│
└── apps/mobile/
    ├── app/                         # Expo Router ページ
    ├── components/                  # アプリ固有コンポーネント
    ├── global.css                   # TailwindCSS スタイル
    └── tailwind.config.ts
```

### gluestack-ui の設計思想

gluestack-ui は **unstyled primitives** を提供し、スタイリングは NativeWind (TailwindCSS) で行う：

1. **createXxx** - アクセシビリティ対応のプリミティブを生成
2. **tva** - 型安全なバリアントスタイルを定義
3. **withStyleContext** - コンテキストベースのスタイル共有

## コンポーネント実装パターン

### 基本構造

```tsx
'use client'
import { createButton } from '@gluestack-ui/button'
import type { VariantProps } from '@gluestack-ui/nativewind-utils'
import { tva } from '@gluestack-ui/nativewind-utils/tva'
import { useStyleContext, withStyleContext } from '@gluestack-ui/nativewind-utils/withStyleContext'
import React from 'react'
import { Pressable, Text, View, ActivityIndicator } from 'react-native'

const SCOPE = 'BUTTON'

// 1. tva でバリアントスタイルを定義
const buttonStyle = tva({
  base: 'rounded-lg flex-row items-center justify-center gap-2',
  variants: {
    action: {
      primary: 'bg-zinc-900',
      secondary: 'bg-zinc-100',
      positive: 'bg-green-500',
      negative: 'bg-red-500',
    },
    variant: {
      solid: '',
      outline: 'bg-transparent border border-zinc-300',
      link: 'bg-transparent',
    },
    size: {
      sm: 'px-4 h-9',
      md: 'px-4 h-10',
      lg: 'px-6 h-11',
    },
    isDisabled: {
      true: 'opacity-50',
    },
  },
  defaultVariants: {
    action: 'primary',
    variant: 'solid',
    size: 'md',
  },
})

// 2. withStyleContext でコンテキスト対応ラッパー
const UIButton = withStyleContext(Pressable, SCOPE)

// 3. createButton でアクセシブルなコンポーネント生成
const AccessibleButton = createButton({
  Root: UIButton,
  Text: UIButtonText,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: View,
})

// 4. 最終エクスポート
type ButtonProps = React.ComponentProps<typeof AccessibleButton> &
  VariantProps<typeof buttonStyle> & { className?: string }

const Button = React.forwardRef<React.ComponentRef<typeof UIButton>, ButtonProps>(
  ({ className, action, variant, size, ...props }, ref) => {
    return (
      <AccessibleButton
        ref={ref}
        className={buttonStyle({ action, variant, size, class: className })}
        context={{ action, variant, size }}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, ButtonText: AccessibleButton.Text }
```

## tva (Tailwind Variant Authority)

### 基本構文

```tsx
import { tva, type VariantProps } from '@gluestack-ui/nativewind-utils'

const componentStyle = tva({
  base: 'base-classes',
  variants: {
    variant: {
      primary: 'variant-primary-classes',
      secondary: 'variant-secondary-classes',
    },
    size: {
      sm: 'size-sm-classes',
      md: 'size-md-classes',
    },
  },
  compoundVariants: [
    {
      variant: 'primary',
      size: 'lg',
      class: 'compound-classes',
    },
  ],
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

// 型の取得
type ComponentProps = VariantProps<typeof componentStyle>
```

### 使用方法

```tsx
// className を結合
<View className={componentStyle({ variant: 'primary', size: 'md', class: customClassName })} />
```

## アイコン統合

### lucide-react-native

```tsx
import { ChevronRight, Settings, User } from 'lucide-react-native'

// サイズと色はクラスで指定
<ChevronRight className="h-5 w-5 text-white" />
```

## スタイリングルール

### CSS変数は使用不可

React Native では CSS 変数が動作しないため、直接色を指定：

```tsx
// ✅ Good: 直接指定
'bg-zinc-900 text-white'

// ❌ Bad: CSS変数（React Native では動作しない）
'bg-background text-foreground'
```

### ダークモード対応

```tsx
// NativeWind のダークモードサポート
'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white'
```

## 新規コンポーネント追加手順

### gluestack-ui CLI を使用（推奨）

```bash
# frontend ディレクトリから
cd frontend
bun run ui:add:mobile <component-name>

# または packages/ui/mobile から直接
cd packages/ui/mobile
bunx gluestack-ui@latest add <component-name> --use-bun
```

コンポーネントは `packages/ui/mobile/components/` にインストールされます。

### 手動で追加する場合

1. **パッケージインストール**
   ```bash
   cd frontend/packages/ui/mobile
   bun add @gluestack-ui/<component-name>
   ```

2. **コンポーネントファイル作成**
   ```
   packages/ui/mobile/components/<component-name>/index.tsx
   ```

3. **実装パターンに従う**
   - `createXxx` でプリミティブ生成
   - `tva` でバリアント定義
   - `withStyleContext` / `useStyleContext` でコンテキスト共有

4. **エクスポート**
   ```tsx
   export { Component, ComponentText, ComponentIcon, ... }
   export type { ComponentProps }
   ```

## インポートパターン

```tsx
// workspace パッケージから（推奨）
import { Button, ButtonText } from '@workspace/ui/mobile/components/button'
import { GluestackUIProvider } from '@workspace/ui/mobile/components/gluestack-ui-provider'

// ユーティリティ
import { tva } from '@gluestack-ui/nativewind-utils/tva'
```

## 参考リンク

- [gluestack-ui 公式ドキュメント](https://gluestack.io/ui/docs)
- [NativeWind ドキュメント](https://www.nativewind.dev/)
- [Tailwind Variants](https://www.tailwind-variants.org/)
