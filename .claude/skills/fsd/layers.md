# FSD レイヤー詳細

このドキュメントでは、Feature Sliced Design の各レイヤーについて詳細に説明します。

## レイヤー概要

| レイヤー | 責務 | 配置場所 |
|---------|------|---------|
| **App** | アプリケーション初期化、グローバル設定 | `src/app/` |
| **Views** | フルページコンポーネント | `src/views/` |
| **Widgets** | 複合UIブロック | `src/widgets/` |
| **Features** | ビジネス機能、ユーザーシナリオ | `src/features/` |
| **Entities** | ビジネスエンティティ、ドメインモデル | `src/entities/` |
| **Shared** | 共有インフラ、再利用可能コード | `src/shared/` |

---

## App層

**目的**: アプリケーション初期化、グローバルプロバイダー、スタイル設定

**配置場所**: `src/app/`

**責務**:
- グローバルスタイル（CSS変数、テーマ）
- プロバイダー設定（React Query、Zustand等）
- アプリケーション初期化処理

**ディレクトリ構造**:
```
src/app/
└── styles/
    └── globals.css    # CSS変数、テーマ定義
```

**このプロジェクトでの使用例**:
- `globals.css` - TailwindCSS CSS変数、ダークモードテーマ

---

## Views層

**目的**: フルページコンポーネント（Next.js Pagesとは異なる）

**配置場所**: `src/views/`

**責務**:
- 完全なページUI構成
- Widgets、Features、Entities の組み合わせ
- ページ固有のロジック
- Server Components（認証チェック、データ取得）

**注意**: Next.js App Router の `app/` ディレクトリとは別です。

**ディレクトリ構造**:
```
src/views/
├── home/
│   ├── ui/
│   │   ├── HomePage.tsx      # Server Component
│   │   └── LanguageSwitcher.tsx
│   └── index.ts
├── auth/
│   └── ui/
│       └── LoginPage.tsx
└── dashboard/
    └── ui/
        └── DashboardPage.tsx
```

**実装パターン**:
```typescript
// views/home/ui/HomePage.tsx - Server Component
import { getTranslations } from 'next-intl/server'

export default async function HomePage() {
  const t = await getTranslations('HomePage')
  return <div>{t('title')}</div>
}
```

---

## Widgets層

**目的**: 大きな複合UIブロック（ヘッダー、サイドバー、フッター等）

**配置場所**: `src/widgets/`

**責務**:
- Features と Entities を組み合わせた複雑なUI
- ページ間で共有される大きなUIコンポーネント
- レイアウト構成要素

**ディレクトリ構造**:
```
src/widgets/
├── header/
│   ├── ui/
│   │   └── Header.tsx
│   └── index.ts
└── auth-status/
    ├── ui/
    │   └── AuthStatus.tsx
    └── index.ts
```

**実装パターン**:
```typescript
// widgets/header/ui/Header.tsx
'use client'

export function Header() {
  return (
    <div className="fixed top-0 z-50 flex h-16 w-full items-center">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">App</h1>
      </div>
    </div>
  )
}
```

---

## Features層

**目的**: ビジネス機能、ユーザー操作シナリオ

**配置場所**: `src/features/`

**責務**:
- 具体的なビジネス機能の実装
- ユーザーアクション（フォーム送信、認証等）
- Server Actions
- 機能固有の状態管理

**ディレクトリ構造**:
```
src/features/
├── auth/
│   ├── ui/
│   │   ├── LoginForm.tsx
│   │   └── VerifyOTPForm.tsx
│   ├── api/
│   │   ├── signInWithOtp.ts   # Server Action
│   │   ├── verifyOtp.ts
│   │   └── index.ts
│   ├── model/
│   │   └── types.ts
│   └── index.ts
├── user-menu/
└── locale-switcher/
```

**実装パターン**:
```typescript
// features/auth/api/signInWithOtp.ts - Server Action
'use server'

export async function signInWithOtp(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ email })
  if (error) return { error: error.message }
  return { success: true }
}
```

---

## Entities層

**目的**: ビジネスエンティティ、ドメインモデル

**配置場所**: `src/entities/`

**責務**:
- ビジネスエンティティの定義
- エンティティ関連のUI（UserAvatar等）
- 型定義
- 状態管理（Zustand store）
- カスタムフック

**ディレクトリ構造**:
```
src/entities/
└── user/
    ├── ui/
    │   └── UserAvatar.tsx
    ├── model/
    │   ├── types.ts       # 型定義
    │   ├── store.ts       # Zustand store
    │   └── hooks.ts       # カスタムフック
    └── index.ts
```

**実装パターン**:
```typescript
// entities/user/model/types.ts
import type { Tables } from '@workspace/types/schema'

export type User = Tables<'users'>
export type UserProfile = Tables<'user_profiles'>

// entities/user/model/store.ts
export const useUserStore = create<UserState>((set) => ({
  authUser: null,
  setAuthUser: (authUser) => set({ authUser }),
}))
```

---

## Shared層

**目的**: 共有インフラ、ビジネスロジックに依存しない再利用可能コード

**配置場所**: `src/shared/`

**責務**:
- UIコンポーネント（shadcn/ui、MagicUI）
- ユーティリティ関数
- API クライアント
- 設定ファイル
- i18n設定

**ディレクトリ構造**:
```
src/shared/
├── ui/
│   ├── button.tsx          # shadcn/ui
│   ├── card.tsx
│   └── magicui/            # MagicUI
│       ├── animated-beam.tsx
│       └── shimmer-button.tsx
├── lib/
│   ├── utils.ts
│   └── i18n/               # i18n helpers
├── config/
│   └── i18n/               # 多言語メッセージ
└── api/
    └── client.ts           # API クライアント
```

**重要**: Shared層は他のどのレイヤーからもインポート可能ですが、Shared層からは他のFSD層をインポートできません。
