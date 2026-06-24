---
name: fsd
description: Feature Sliced Design (FSD) アーキテクチャのガイダンス。新しいfeature、entity、widget、viewを作成する際や、FSD構造についての質問に使用。レイヤー、スライス、セグメントに関する実装支援を提供。
---

# Feature Sliced Design (FSD) スキル

このプロジェクトは Feature Sliced Design (FSD) アーキテクチャに基づいて構築されています。

## ディレクトリ構造

```
frontend/apps/web/
├── app/                    # Next.js App Router（プロジェクトルート）
│   └── [locale]/          # Locale-based routes
└── src/                   # FSD層
    ├── app/               # Application層 - プロバイダー、グローバルスタイル
    ├── views/             # Views層 - フルページコンポーネント
    ├── widgets/           # Widgets層 - 複合UIブロック
    ├── features/          # Features層 - ビジネス機能
    ├── entities/          # Entities層 - ビジネスエンティティ
    └── shared/            # Shared層 - 共有インフラ
```

## レイヤー階層とインポートルール

```
App → Views → Widgets → Features → Entities → Shared
↓       ↓       ↓         ↓          ↓         ↓
低レイヤーへのみインポート可能（上位へのインポートは禁止）
```

**重要なルール**:
- 各レイヤーは下位レイヤーからのみインポート可能
- 同一レイヤー間のインポートは原則禁止
- 上位レイヤーへのインポートは厳禁

## セグメント構成

各スライスは以下のセグメントで構成:

| セグメント | 用途 | 例 |
|-----------|------|-----|
| **ui/** | Reactコンポーネント | `UserAvatar.tsx`, `LoginForm.tsx` |
| **api/** | Server Actions、API呼び出し | `signInWithOtp.ts`, `verifyOtp.ts` |
| **model/** | 型定義、状態管理、ビジネスロジック | `types.ts`, `store.ts`, `hooks.ts` |

## Public API パターン（必須）

すべてのスライスは `index.ts` でPublic APIを定義する必要があります:

```typescript
// entities/user/index.ts
export { useAuthUser, useUser } from './model/hooks'
export { useUserStore } from './model/store'
export type { AuthUser, User, UserProfile } from './model/types'
export { UserAvatar } from './ui/UserAvatar'
```

**メリット**:
- 実装詳細の隠蔽
- 変更の影響範囲を限定
- IDEのオートコンプリートが正確

## 新規スライス作成手順

### 1. Entity 作成

```bash
# ディレクトリ構造
src/entities/new-entity/
├── ui/
│   └── EntityComponent.tsx
├── model/
│   ├── types.ts
│   ├── store.ts
│   └── hooks.ts
└── index.ts
```

### 2. Feature 作成

```bash
# ディレクトリ構造
src/features/new-feature/
├── ui/
│   └── FeatureComponent.tsx
├── api/
│   └── featureAction.ts
├── model/
│   └── types.ts
└── index.ts
```

### 3. Widget 作成

```bash
# ディレクトリ構造
src/widgets/new-widget/
├── ui/
│   └── Widget.tsx
└── index.ts
```

### 4. View 作成

```bash
# ディレクトリ構造
src/views/new-view/
├── ui/
│   └── NewViewPage.tsx
└── index.ts
```

## インポート例

```typescript
// ✅ Good - 下位レイヤーからインポート
import { Button } from '@/shared/ui/button'
import { useUserStore } from '@/entities/user'
import { LoginForm } from '@/features/auth'
import { Header } from '@/widgets/header'

// ❌ Bad - 上位レイヤーへのインポート
import { HomePage } from '@/views/home'  // features内から
```

## 詳細ドキュメント

- レイヤーの詳細: [layers.md](layers.md)
- セグメントの詳細: [segments.md](segments.md)
- 実装例: [examples.md](examples.md)
