# フロントエンドモノレポアーキテクチャ

このドキュメントでは、フロントエンドモノレポの全体構造、パッケージ依存関係、インポートパスなどを解説します。

> **重要:** このボイラープレートは単一アプリ（`apps/web`）として提供されていますが、複数アプリへの拡張を前提とした設計になっています。
> 新しいアプリを追加する際は、必ず [設計原則](./design-principles.md) と [新しいアプリの追加方法](./adding-apps.md) を参照してください。

---

## 📐 全体構造

### Before（モノレポ移行前）

```
frontend/
├── app/                    # Next.js App Router
├── src/                    # FSD layers
│   ├── app/               # Application layer
│   ├── views/             # Views layer
│   ├── widgets/           # Widgets layer
│   ├── features/          # Features layer
│   ├── entities/          # Entities layer
│   └── shared/            # Shared layer
│       ├── api/
│       ├── config/
│       ├── lib/
│       └── ui/            # shadcn/ui components（アプリ固有）
├── public/
├── package.json
├── next.config.ts
└── tsconfig.json
```

### After（モノレポ移行後）

```
frontend/
├── apps/                           # 🎯 アプリケーション
│   ├── web/                       # Next.js Web Application
│   │   ├── app/                   # Next.js App Router
│   │   ├── src/                   # FSD layers
│   │   │   ├── app/              # Application layer（providers, styles）
│   │   │   ├── views/            # Views layer（ページコンポーネント）
│   │   │   ├── widgets/          # Widgets layer（大規模UIブロック）
│   │   │   ├── features/         # Features layer（ビジネス機能）
│   │   │   ├── entities/         # Entities layer（エンティティ）
│   │   │   └── shared/           # Shared layer（アプリ固有の共有コード）
│   │   │       ├── api/         # アプリ固有API
│   │   │       ├── config/      # アプリ固有設定
│   │   │       └── lib/         # アプリ固有ユーティリティ
│   │   ├── public/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   └── tsconfig.json
│   │
│   └── docs/                      # Documentation Site（オプション）
│       └── ...
│
├── packages/                       # 📦 共有パッケージ
│   ├── ui/                        # UIコンポーネントライブラリ
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   └── ...
│   │   │   ├── magicui/          # MagicUI components
│   │   │   └── index.ts          # エクスポート定義
│   │   ├── styles/
│   │   │   └── globals.css
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── types/                     # 型定義
│   │   ├── src/
│   │   │   ├── database.ts       # Supabase自動生成型
│   │   │   ├── api/              # Backend API型
│   │   │   │   └── index.ts
│   │   │   └── index.ts          # 共通型定義
│   │   └── package.json
│   │
│   ├── utils/                     # ユーティリティ関数
│   │   ├── src/
│   │   │   ├── date.ts           # 日時処理
│   │   │   ├── validators.ts     # バリデーション
│   │   │   ├── formatters.ts     # フォーマッター
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── api-client/                # APIクライアント
│       ├── src/
│       │   ├── supabase.ts       # Supabaseクライアント
│       │   ├── backend.ts        # Backendクライアント
│       │   └── index.ts
│       └── package.json
│
├── tooling/                        # ⚙️ 開発ツール設定
│   ├── eslint/                    # ESLint設定
│   │   ├── base.js               # ベース設定
│   │   ├── next.js               # Next.js用
│   │   └── package.json
│   │
│   ├── typescript/                # TypeScript設定
│   │   ├── base.json             # ベース設定
│   │   ├── nextjs.json           # Next.js用
│   │   └── package.json
│   │
│   └── tailwind/                  # TailwindCSS設定
│       ├── preset.ts             # プリセット
│       └── package.json
│
├── scripts/                        # 📜 自動化スクリプト
│   ├── generate-types.ts         # 型生成
│   └── codegen.ts                # コード生成
│
├── docs/                          # 📚 ドキュメント
│   └── monorepo/
│       ├── migration-plan.md
│       ├── task-checklist.md
│       ├── architecture.md
│       ├── configuration-guide.md
│       └── troubleshooting.md
│
├── turbo.json                     # Turborepo設定
├── package.json                   # ルートworkspace定義
├── pnpm-lock.yamlb                      # Bunロックファイル
└── README.md
```

---

## 🔗 パッケージ依存関係

### 依存関係グラフ

```
┌─────────────────────────────────────────────────────────────┐
│                         @workspace/web                       │
│                    (Next.js Application)                     │
└───────────┬────────────────┬────────────────┬───────────────┘
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌──────────────┐ ┌─────────────────┐
    │ @workspace/ui │ │@workspace/   │ │ @workspace/     │
    │               │ │types         │ │ api-client      │
    └───────────────┘ └──────────────┘ └────────┬────────┘
            │                                     │
            │                                     ▼
            │                             ┌──────────────┐
            └────────────────────────────>│@workspace/   │
                                          │types         │
                                          └──────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    Tooling Packages                          │
├──────────────────────────────────────────────────────────────┤
│ @workspace/eslint-config                                     │
│ @workspace/typescript-config                                 │
│ @workspace/tailwind-config                                   │
└──────────────────────────────────────────────────────────────┘
                             ▲
                             │
                   (devDependencies)
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    @workspace/web    @workspace/ui     @workspace/types
```

### 依存関係の詳細

| パッケージ | 依存先 | 目的 |
|-----------|--------|------|
| `@workspace/web` | `@workspace/ui` | UIコンポーネントを使用 |
| `@workspace/web` | `@workspace/types` | 型定義を使用 |
| `@workspace/web` | `@workspace/utils` | ユーティリティ関数を使用 |
| `@workspace/web` | `@workspace/api-client` | APIクライアントを使用 |
| `@workspace/api-client` | `@workspace/types` | API型を使用 |
| `@workspace/ui` | `@workspace/typescript-config` | TypeScript設定を継承 |
| `@workspace/ui` | `@workspace/tailwind-config` | TailwindCSS設定を継承 |

---

## 📂 パッケージの役割

> **重要な設計原則:**
> - `packages/` には**複数アプリで実際に共有されるコード**のみを配置
> - アプリ専用のUIは `apps/{app}/src/shared/ui/` に配置（FSD原則）
> - 「将来使うかも」という推測で共有化しない
>
> 詳細は [設計原則](./design-principles.md) を参照してください。

### 1. `@workspace/web`（アプリケーション）

**役割:** メインのNext.jsアプリケーション

**責務:**
- ページルーティング（App Router）
- FSD layersに基づいた機能実装
- ビジネスロジック
- アプリ固有の設定

**公開API:** なし（実行可能アプリケーション）

**アプリ専用UIの配置:**
```
apps/web/src/shared/ui/   # このアプリでしか使わないUIコンポーネント
```

---

### 2. `@workspace/ui`（UIコンポーネント）

**役割:** 複数アプリで共有される再利用可能なUIコンポーネントライブラリ

**責務:**
- shadcn/uiコンポーネントの管理（Button, Card, Dialogなど）
- MagicUIコンポーネントの管理
- グローバルスタイル
- **全アプリで共通して使われる**コンポーネントのみ

**⚠️ 重要:** アプリ専用のコンポーネント（DataTable、Hero、PricingCardなど）は、`apps/{app}/src/shared/ui/` に配置してください。

**公開API:**
```typescript
// components/index.ts
export { Button } from './ui/button'
export { Card, CardContent, CardHeader, CardTitle } from './ui/card'
export { Dialog, DialogContent, DialogTrigger } from './ui/dialog'
// ...
```

**使用例:**
```typescript
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
```

---

### 3. `@workspace/types`（型定義）

**役割:** 全体で使用する型定義の一元管理

**責務:**
- Supabase自動生成型
- Backend API型
- 共通型定義
- 型の再エクスポート

**公開API:**
```typescript
// src/index.ts
export type { Database } from './database'

// 共通型定義
export interface User {
  id: string
  email: string
  name?: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}
```

**使用例:**
```typescript
import type { Database } from '@workspace/types'
import type { User, ApiResponse } from '@workspace/types'
```

---

### 4. `@workspace/utils`（ユーティリティ）

**役割:** 再利用可能なユーティリティ関数

**責務:**
- 日時処理
- バリデーション
- フォーマッター
- 共通ヘルパー関数

**公開API:**
```typescript
// src/index.ts
export * from './date'
export * from './validators'
export * from './formatters'
```

**使用例:**
```typescript
import { formatDate, isValidEmail } from '@workspace/utils'
```

---

### 5. `@workspace/api-client`（APIクライアント）

**役割:** API通信の抽象化

**責務:**
- Supabaseクライアントの設定
- Backend APIクライアントの設定
- 共通エラーハンドリング

**公開API:**
```typescript
// src/index.ts
export { createSupabaseClient } from './supabase'
export { backendApi } from './backend'
```

**使用例:**
```typescript
import { createSupabaseClient } from '@workspace/api-client'
```

---

## 🔀 インポートパスの対応表

### UIコンポーネント

| Before | After |
|--------|-------|
| `@/shared/ui/button` | `@workspace/ui/components/button` |
| `@/shared/ui/card` | `@workspace/ui/components/card` |
| `@/shared/ui/dialog` | `@workspace/ui/components/dialog` |

### 型定義

| Before | After |
|--------|-------|
| `@/types/supabase` | `@workspace/types` |
| `@/types/api` | `@workspace/types/api` |

### ユーティリティ

| Before | After |
|--------|-------|
| `@/lib/utils` | `@/lib/utils` または `@workspace/utils` |
| `@/lib/validators` | `@workspace/utils` |

### APIクライアント

| Before | After |
|--------|-------|
| `@/lib/supabase` | `@workspace/api-client` |

---

## 🏗️ Turborepoタスク依存グラフ

### タスクの実行順序

```
┌──────────────────────────────────────────────────────────────┐
│                        turbo build                            │
└───────────────────────────┬──────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌───────────────┐       ┌──────────────┐
        │ packages/ui   │       │ packages/    │
        │ build         │       │ types build  │
        └───────┬───────┘       └──────┬───────┘
                │                      │
                └──────────┬───────────┘
                           ▼
                   ┌───────────────┐
                   │ apps/web      │
                   │ build         │
                   └───────────────┘
```

### タスク定義（turbo.json）

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],  // 依存パッケージのbuildが先
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## 🔧 TypeScriptパス設定

### ルートtsconfig.json（apps/web）

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@workspace/ui": ["../../packages/ui/components"],
      "@workspace/ui/components/*": ["../../packages/ui/components/ui/*"],
      "@workspace/types": ["../../packages/types/src"],
      "@workspace/utils": ["../../packages/utils/src"],
      "@workspace/api-client": ["../../packages/api-client/src"]
    }
  }
}
```

---

## 📊 ビルドフロー

### 開発時（`pnpm run dev`）

```
1. Turborepo が turbo.json を読み込み
   ↓
2. 各パッケージの dev タスクを並列実行
   ↓
3. apps/web の Next.js 開発サーバーが起動
   ↓
4. packages/* の変更を watch（必要に応じて）
   ↓
5. ホットリロード
```

### 本番ビルド（`pnpm run build`）

```
1. Turborepo が依存関係を解析
   ↓
2. packages/types をビルド（型生成）
   ↓
3. packages/ui をビルド（コンポーネント）
   ↓
4. packages/utils をビルド（ユーティリティ）
   ↓
5. apps/web をビルド（Next.js）
   ↓
6. キャッシュに保存（次回高速化）
```

---

## 🚀 スケーラビリティ

### 将来の拡張可能性

#### 1. モバイルアプリ追加

```bash
cd frontend/apps
pnpm dlx create-expo-app mobile
```

```
apps/
├── web/         # Next.js
└── mobile/      # React Native（新規）
```

共有パッケージ（`@workspace/ui`, `@workspace/types`）を再利用可能。

#### 2. ドキュメントサイト追加

```bash
cd frontend/apps
pnpm dlx create-next-app@latest docs
```

```
apps/
├── web/         # メインアプリ
├── mobile/      # モバイル
└── docs/        # ドキュメント（新規）
```

#### 3. マイクロフロントエンド

各`apps/*`を独立してデプロイ可能：

- `apps/web` → Vercel
- `apps/docs` → Cloudflare Pages
- `apps/admin` → 別のホスティング

---

## 📈 パフォーマンス最適化

### Turborepoキャッシュ

**ローカルキャッシュ:**
- `.turbo/cache/` にビルド結果を保存
- 2回目以降のビルドが劇的に高速化

**リモートキャッシュ（Vercel）:**
```bash
bun turbo login
bun turbo link
```

チーム全体でキャッシュを共有可能。

### ビルド時間の比較

| 状態 | 時間 | 改善率 |
|------|------|--------|
| 初回ビルド | 30秒 | - |
| キャッシュあり | 0.2秒 | **99%削減** |

---

## 🎯 ベストプラクティス

### 1. パッケージの独立性

各パッケージは独立してビルド・テスト可能にする。

### 2. 循環依存の回避

パッケージ間の循環依存を避ける：

❌ **悪い例:**
```
@workspace/ui → @workspace/utils → @workspace/ui
```

✅ **良い例:**
```
@workspace/ui → @workspace/utils
```

### 3. 明確な公開API

各パッケージは`index.ts`で公開APIを定義：

```typescript
// packages/ui/components/index.ts
export { Button } from './ui/button'
export { Card } from './ui/card'
// 内部実装は公開しない
```

### 4. 型の一元管理

型定義は`@workspace/types`に集約：

```typescript
// ❌ 各パッケージで重複定義
// ✅ @workspace/types で一元管理
```

---

## 📚 参考資料

- [Turborepo公式ドキュメント](https://turborepo.com/docs)
- [shadcn/ui Monorepo](https://ui.shadcn.com/docs/monorepo)
- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
- [Feature-Sliced Design](https://feature-sliced.design/)
