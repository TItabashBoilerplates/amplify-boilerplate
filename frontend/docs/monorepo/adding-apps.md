# 新しいアプリの追加方法

このドキュメントでは、モノレポに新しいアプリケーションを追加する手順を解説します。

---

## 📋 概要

このボイラープレートは**単一アプリ**（`apps/web`）として提供されていますが、**複数アプリへの拡張**を前提とした設計になっています。

### 追加できるアプリの種類

- 🔐 **管理画面** (`apps/admin`) - Next.js
- 👤 **ユーザー向けアプリ** (`apps/web`) - 既存
- 📱 **モバイルアプリ** (`apps/mobile`) - React Native / Expo
- 📚 **ドキュメントサイト** (`apps/docs`) - Next.js / Docusaurus
- 🔌 **その他のアプリ**

---

## 🎯 設計原則（重要）

新しいアプリを追加する際は、以下の原則を守ってください：

### ✅ DO（推奨）

1. **FSD構造を維持する**
   - アプリ専用のUIは `src/shared/ui/` に配置
   - アプリ専用のロジックは `src/shared/lib/` に配置

2. **実際に共有されるコードのみ `packages/` に置く**
   - 複数アプリで使うことが確定してから共有化

3. **段階的に共有化する**
   - 最初はアプリ内で実装
   - 必要になったら `packages/` に移行

### ❌ DON'T（非推奨）

1. **アプリ専用パッケージを作らない**
   - `packages/ui-admin/` ← ❌
   - `packages/web-components/` ← ❌

2. **推測で共有化しない**
   - 「将来使うかも」で `packages/` に置かない

3. **FSDを無視しない**
   - アプリ専用コードは `src/shared/` で管理

詳細は [設計原則](./design-principles.md) を参照してください。

---

## 🚀 管理画面の追加

### Step 1: アプリのコピー

```bash
cd frontend/apps
cp -r web admin
cd admin
```

### Step 2: `package.json` の編集

```json
{
  "name": "@workspace/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@workspace/ui": "workspace:*",
    "@workspace/types": "workspace:*",
    "@workspace/utils": "workspace:*",
    "@workspace/api-client": "workspace:*",
    "@supabase/supabase-js": "^2.55.0",
    "next": "^16.0.0",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  }
}
```

**ポイント:**
- `name` を `@workspace/admin` に変更
- `dev` のポート番号を変更（`3001`など）

### Step 3: 不要なファイルの削除

```bash
# ユーザー向けコンテンツを削除
rm -rf src/features/landing
rm -rf src/features/pricing

# 管理画面用にディレクトリを作成
mkdir -p src/features/dashboard
mkdir -p src/features/user-management
```

### Step 4: 依存関係のインストール

```bash
cd frontend
bun install
```

### Step 5: 開発サーバーの起動

```bash
# 管理画面のみ起動
cd apps/admin
bun run dev

# または、すべてのアプリを並列起動（Turborepo）
cd frontend
bun run dev
```

### Step 6: 管理画面専用UIの作成

```typescript
// apps/admin/src/shared/ui/DataTable.tsx
'use client'

export function DataTable<T>({ data, columns }: DataTableProps<T>) {
  // 管理画面専用のデータテーブル実装
  return (
    <div className="rounded-md border">
      {/* テーブル実装 */}
    </div>
  )
}
```

**重要:** 管理画面専用UIは `packages/ui/` ではなく、`apps/admin/src/shared/ui/` に配置してください。

### Step 7: 認証ガード（オプション）

```typescript
// apps/admin/src/shared/lib/auth-guard.ts
import { redirect } from 'next/navigation'
import { createClient } from '@workspace/api-client'

export async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.role !== 'admin') {
    redirect('/login')
  }

  return user
}
```

```typescript
// apps/admin/app/dashboard/page.tsx
import { requireAdmin } from '@/shared/lib/auth-guard'

export default async function DashboardPage() {
  const user = await requireAdmin()

  return <div>Admin Dashboard</div>
}
```

---

## 📱 モバイルアプリの追加

### Step 1: Expoプロジェクトの作成

```bash
cd frontend/apps
bunx create-expo-app mobile
cd mobile
```

### Step 2: ワークスペース依存関係の追加

```json
// apps/mobile/package.json
{
  "name": "@workspace/mobile",
  "dependencies": {
    "@workspace/ui": "workspace:*",
    "@workspace/types": "workspace:*",
    "@workspace/utils": "workspace:*",
    "@workspace/api-client": "workspace:*",
    "expo": "~51.0.0",
    "react": "19.1.0",
    "react-native": "0.75.0"
  }
}
```

### Step 3: FSD構造の作成

```bash
cd apps/mobile
mkdir -p src/{app,features,entities,shared}
mkdir -p src/shared/{ui,lib,api,config}
```

### Step 4: 共有UIコンポーネントの使用

```typescript
// apps/mobile/src/shared/ui/Button.tsx
import { Button as BaseButton } from '@workspace/ui/components/button'

// React Native用にラップ
export function Button(props) {
  return <BaseButton {...props} />
}
```

**注意:** Web用のshadcn/uiコンポーネントは、React Nativeでは**そのまま使えません**。ラッパーを作成するか、モバイル専用UIを `src/shared/ui/` に実装してください。

### Step 5: モバイル専用UIの実装

```typescript
// apps/mobile/src/shared/ui/BottomTab.tsx
import { View, Text, TouchableOpacity } from 'react-native'

export function BottomTab({ items }) {
  // モバイル専用のボトムタブ実装
  return (
    <View>
      {items.map(item => (
        <TouchableOpacity key={item.id}>
          <Text>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}
```

---

## 🏗️ 共有コンポーネントの判断

### シナリオ1: Button（全アプリ共通）

```
✅ packages/ui/components/ui/button.tsx

理由: admin、web、mobile全てで使用される
```

### シナリオ2: DataTable（管理画面専用）

```
✅ apps/admin/src/shared/ui/DataTable.tsx

理由: 管理画面でしか使わない
```

### シナリオ3: Hero（ユーザー向けアプリ専用）

```
✅ apps/web/src/shared/ui/Hero.tsx

理由: ユーザー向けアプリでしか使わない
```

### シナリオ4: BottomTab（モバイル専用）

```
✅ apps/mobile/src/shared/ui/BottomTab.tsx

理由: モバイルアプリでしか使わない
```

### シナリオ5: PricingCard（web と admin で使用）

**初期:**
```
apps/web/src/shared/ui/PricingCard.tsx  # web専用
```

**admin でも使うことが確定したら:**
```bash
# packages/ に移行
mv apps/web/src/shared/ui/PricingCard.tsx packages/ui/components/pricing-card.tsx
```

**移行後:**
```typescript
// apps/web & apps/admin
import { PricingCard } from '@workspace/ui/components/pricing-card'
```

---

## ⚙️ デプロイ設定

### Vercel（Next.js）

#### 管理画面

**Vercel Project Settings:**
- **Root Directory:** `frontend/apps/admin`
- **Build Command:** `cd ../.. && turbo build --filter=@workspace/admin`
- **Output Directory:** `apps/admin/.next`
- **Environment Variables:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### ユーザー向けアプリ

**Vercel Project Settings:**
- **Root Directory:** `frontend/apps/web`
- **Build Command:** `cd ../.. && turbo build --filter=@workspace/web`
- **Output Directory:** `apps/web/.next`

### Expo EAS（モバイル）

```bash
cd apps/mobile
eas init
eas build --platform ios
eas build --platform android
```

---

## 🔧 Turborepo設定

### `turbo.json` に追加

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### フィルタリングコマンド

```bash
# 管理画面のみビルド
turbo build --filter=@workspace/admin

# ユーザー向けアプリのみビルド
turbo build --filter=@workspace/web

# すべてのアプリをビルド
turbo build
```

---

## 🧪 テスト

### アプリが正しく動作するか確認

```bash
# 1. 依存関係のインストール
cd frontend
bun install

# 2. 型チェック
turbo type-check

# 3. Lint
turbo lint

# 4. ビルド
turbo build

# 5. 開発サーバー起動
turbo dev
```

**確認項目:**
- [ ] すべてのアプリが起動する
- [ ] 共有パッケージが正しくインポートできる
- [ ] 型エラーがない
- [ ] ビルドエラーがない

---

## 📊 ディレクトリ構造（複数アプリ）

```
frontend/
├── apps/
│   ├── admin/                    # 管理画面
│   │   ├── app/
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── dashboard/
│   │   │   │   └── user-management/
│   │   │   └── shared/
│   │   │       └── ui/          # 管理画面専用UI
│   │   │           ├── DataTable.tsx
│   │   │           └── AnalyticsChart.tsx
│   │   └── package.json
│   │
│   ├── web/                      # ユーザー向けアプリ
│   │   ├── app/
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── landing/
│   │   │   │   └── pricing/
│   │   │   └── shared/
│   │   │       └── ui/          # Web専用UI
│   │   │           ├── Hero.tsx
│   │   │           └── PricingCard.tsx
│   │   └── package.json
│   │
│   └── mobile/                   # モバイルアプリ
│       ├── src/
│       │   ├── features/
│       │   └── shared/
│       │       └── ui/          # モバイル専用UI
│       │           ├── BottomTab.tsx
│       │           └── SwipeableCard.tsx
│       └── package.json
│
├── packages/
│   ├── ui/                       # 全アプリ共通UIのみ
│   │   └── components/ui/
│   │       ├── button.tsx       # 全アプリで使用
│   │       ├── card.tsx         # 全アプリで使用
│   │       └── dialog.tsx       # 全アプリで使用
│   ├── types/                    # 型定義（全アプリ共通）
│   ├── utils/                    # ユーティリティ（全アプリ共通）
│   └── api-client/               # APIクライアント（全アプリ共通）
│
└── turbo.json
```

---

## ✅ チェックリスト

新しいアプリを追加する前に確認：

- [ ] [設計原則](./design-principles.md)を読んだ
- [ ] アプリ専用UIは `src/shared/ui/` に配置する
- [ ] アプリ専用パッケージ（`ui-{app}`）は作らない
- [ ] 実際に共有されるコードのみ `packages/` に置く
- [ ] FSD構造を維持する
- [ ] `package.json` の name とポート番号を変更する
- [ ] Turborepo設定を確認する
- [ ] デプロイ設定を確認する

---

## 🔄 既存アプリからの共有化

### Step 1: 複数アプリで使うことが確定

```typescript
// apps/admin と apps/web で PricingCard が必要
```

### Step 2: packages/ に移行

```bash
mv apps/web/src/shared/ui/PricingCard.tsx packages/ui/components/pricing-card.tsx
```

### Step 3: インポートパスを更新

```typescript
// Before
import { PricingCard } from '@/shared/ui/PricingCard'

// After
import { PricingCard } from '@workspace/ui/components/pricing-card'
```

### Step 4: 両アプリで動作確認

```bash
turbo build --filter=@workspace/admin --filter=@workspace/web
```

---

## 📚 関連ドキュメント

- [設計原則](./design-principles.md) - **必読**
- [アーキテクチャ設計図](./architecture.md)
- [設定ファイルガイド](./configuration-guide.md)
- [トラブルシューティング](./troubleshooting.md)

---

**重要:** アプリ追加時は、必ず[設計原則](./design-principles.md)に従ってください。過度な抽象化を避け、実際のニーズに基づいて設計することが成功の鍵です。
