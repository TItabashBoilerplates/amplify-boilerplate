---
paths: frontend/**/*.{ts,tsx,js,jsx}
---

# Frontend Code Standards

## Architecture

- **Pattern**: Feature Sliced Design (FSD)
- **State Management**: TanStack Query for server state, Zustand for global state

### Web (`apps/web/`)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 with App Router |
| UI Library | shadcn/ui (Radix UI + TailwindCSS 4) |
| i18n | next-intl |

### Mobile (`apps/mobile/`)

| Layer | Technology |
|-------|------------|
| Framework | Expo 55, React Native |
| UI Library | gluestack-ui + NativeWind 5 |
| Styling | tva (Tailwind Variant Authority) |
| Icons | lucide-react-native |

## Monorepo Structure

このプロジェクトは Bun workspace によるモノレポ構成：

```
frontend/
├── apps/
│   ├── web/              # Next.js Web アプリ
│   └── mobile/           # Expo React Native アプリ
└── packages/
    ├── ui/
    │   ├── web/          # shadcn/ui + MagicUI (Web専用)
    │   └── mobile/       # gluestack-ui (Native専用)
    ├── tokens/           # デザイントークン (共有)
    ├── client-supabase/  # Supabase クライアント
    ├── query/            # TanStack Query 設定
    └── tailwind-config/  # TailwindCSS 共通設定
```

## DRY Principle (MANDATORY)

**重複実装は徹底的に排除し、コードをクリーンに保つ。**

### 共通化の原則

| 対象 | 配置場所 | 例 |
|------|---------|-----|
| **Web UI コンポーネント** | `packages/ui/` | Button, Card, Input (shadcn/ui) |
| **Mobile UI コンポーネント** | `packages/native-ui/` | Button, Card (gluestack-ui) |
| **デザイントークン** | `packages/tokens/` | colors, radius |
| **Supabase クライアント** | `packages/client-supabase/` | createClient, types |
| **TanStack Query 設定** | `packages/query/` | QueryClient, hooks |
| **TailwindCSS 設定** | `packages/tailwind-config/` | theme, plugins |
| **型定義** | `packages/*/types/` | 共通インターフェース |
| **ユーティリティ** | `packages/ui/lib/` or app の `shared/lib/` | cn, formatDate |

### 禁止事項

```typescript
// ❌ Bad: 各アプリで同じコンポーネントを実装
// apps/web/src/shared/ui/button.tsx
// apps/mobile/components/ui/button.tsx (同じロジック)

// ✅ Good: packages で共通化（プラットフォーム別）
// packages/ui/components/button.tsx (Web)
// packages/native-ui/components/button/ (Mobile)
import { Button } from '@workspace/ui/components/button' // Web
import { Button } from '@workspace/native-ui/components/button' // Mobile
```

```typescript
// ❌ Bad: Supabase クライアントを各アプリで個別定義
// apps/web/src/shared/lib/supabase/client.ts
// apps/mobile/lib/supabase.ts

// ✅ Good: packages で共通化
// packages/client-supabase/src/client.ts
import { createBrowserClient } from '@workspace/client-supabase'
```

```typescript
// ❌ Bad: シングルトンインスタンスの重複
const queryClient = new QueryClient() // apps/web
const queryClient = new QueryClient() // apps/mobile

// ✅ Good: 共通設定を packages で管理
// packages/query/src/client.ts
import { queryClient, defaultOptions } from '@workspace/query'
```

### チェックリスト

新しいコードを書く前に確認：

1. **既存の packages に同様の機能があるか？** → あれば再利用
2. **他のアプリでも使う可能性があるか？** → あれば packages に実装
3. **ビジネスロジックが重複していないか？** → 共通化を検討
4. **型定義が重複していないか？** → 共通の types パッケージを使用

## Code Style

- **Linting & Formatting**: Biome
- **Indentation**: 2 spaces
- **Line Width**: 100 characters
- **Quotes**: Single quotes
- **Semicolons**: As needed
- **TypeScript**: Strict mode enabled

## Import Organization

```typescript
// 1. External packages
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

// 2. Workspace packages
import { Button } from '@workspace/ui/components/button' // Web
import { Button } from '@workspace/native-ui/components/button' // Mobile
import { colors } from '@workspace/tokens'
import { createClient } from '@workspace/client-supabase/client'

// 3. FSD layers (top to bottom)
import { Header } from '@/widgets/header'
import { LoginForm } from '@/features/auth'
import { useUserStore } from '@/entities/user'
import { cn } from '@/shared/lib/utils'

// 4. Relative imports
import { SomeComponent } from './SomeComponent'
```

## CSS/Styling Rules

**MANDATORY**: Use CSS variables, never hardcode colors.

```typescript
// ✅ Good: CSS variables
<Card className="border-border bg-background">
  <h2 className="text-foreground">Title</h2>
  <p className="text-muted-foreground">Description</p>
</Card>

// ❌ Bad: Hardcoded colors
<Card className="border-gray-200 bg-white">
  <h2 className="text-black">Title</h2>
</Card>
```

## Date/Time Handling

To prevent hydration errors:

- **DB Storage**: `toISOString()` for UTC format
- **Server → Client**: Pass ISO string (not Date object)
- **Timezone Conversion**: Only in `useEffect` on client side

```typescript
// ✅ Good
<DateDisplay utcDate={event.date.toISOString()} />

// ❌ Bad: Date object as prop
<DateDisplay utcDate={new Date()} />

// ❌ Bad: toLocaleString in Server Component
const formatted = new Date(utcDate).toLocaleString('ja-JP')
```

## Testing

- **Framework**: Vitest with jsdom environment
- **RLS Testing**: pgTAP via `supabase test db` — tests live in `supabase/tests/*.sql`
- **TDD**: Write failing tests first, then implement
