# フロントエンドモノレポ移行プラン

## 📋 概要

このドキュメントは、現在のNext.jsフロントエンドをTurborepo + Bun Workspacesを使用したモノレポ構成に移行するための段階的なプランです。

**目標:**
- ✅ shadcn/ui公式モノレポ対応
- ✅ UIコンポーネントの共有化
- ✅ 型定義の一元管理
- ✅ 将来のモバイルアプリ対応の準備
- ✅ ビルドキャッシュによる高速化

**所要時間:** 約4-5時間

---

## Phase 1: Turborepo基盤構築（30分）

### 🎯 目標
- Turborepoをインストールし、基本設定を行う
- ワークスペース構造を定義

### 📝 作業手順

#### 1.1 Turborepoのインストール

```bash
cd /Users/tknr/Development/shadcn-boilerplate/frontend
pnpm add -D turbo @turbo/gen
```

#### 1.2 `turbo.json`の作成

`frontend/turbo.json`を以下の内容で作成：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env*",
        "!**/.env*.local"
      ],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "dist/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "eslint.config.*"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "format": {
      "outputs": [],
      "cache": false
    },
    "clean": {
      "cache": false
    }
  },
  "globalEnv": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ]
}
```

#### 1.3 ルート`package.json`の更新

既存の`frontend/package.json`をバックアップしてから、以下を追加：

```json
{
  "name": "@repo/frontend-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "tooling/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "format": "turbo format",
    "test": "turbo test",
    "type-check": "turbo type-check",
    "clean": "turbo clean && rm -rf node_modules",
    "ui:add": "cd apps/web && pnpm dlx shadcn@canary add",
    "generate:types": "pnpm run scripts/generate-types.ts"
  },
  "devDependencies": {
    "turbo": "^2.3.3",
    "@turbo/gen": "^2.3.3",
    "typescript": "^5.8.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "bun": ">=1.2.0"
  },
  "packageManager": "bun@1.2.0"
}
```

#### 1.4 検証

```bash
pnpm install
pnpm dlx turbo --version
```

✅ **Phase 1完了確認:** `turbo --version`が表示されればOK

---

## Phase 2: ディレクトリ再編成（1時間）

### 🎯 目標
- `apps/`、`packages/`、`tooling/`ディレクトリを作成
- 既存のフロントエンドコードを`apps/web`に移動

### 📝 作業手順

#### 2.1 ディレクトリ構造の作成

```bash
cd frontend

# メインディレクトリ作成
mkdir -p apps/web
mkdir -p packages/{ui,types,utils,api-client}
mkdir -p tooling/{eslint,typescript,tailwind}
mkdir -p scripts
```

#### 2.2 既存ファイルの移動

```bash
# apps/webに移動するファイル
mv app/ apps/web/
mv src/ apps/web/
mv public/ apps/web/
mv next.config.ts apps/web/
mv next-env.d.ts apps/web/
mv tsconfig.json apps/web/
mv postcss.config.mjs apps/web/
mv eslint.config.mjs apps/web/
mv .prettierrc.yaml apps/web/

# バックアップ
cp package.json package.json.backup
cp pnpm-lock.yaml pnpm-lock.yaml.backup
```

#### 2.3 `apps/web/package.json`の作成

既存の`package.json`を参考に、`apps/web/package.json`を作成：

```json
{
  "name": "@workspace/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.55.0",
    "next": "^16.0.0",
    "next-intl": "^4.4.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "zustand": "^5.0.7",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1"
  },
  "devDependencies": {
    "@types/node": "^24.9.1",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "eslint": "^9",
    "eslint-config-next": "^16.0.0",
    "prettier": "3.6.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

#### 2.4 検証

```bash
cd apps/web
pnpm install
pnpm run dev
```

✅ **Phase 2完了確認:** `http://localhost:3000`で画面が表示されればOK

---

## Phase 3: shadcn/ui モノレポ対応（1時間）

### 🎯 目標
- shadcn/ui公式モノレポサポートを有効化
- UIコンポーネントを`packages/ui`に移行

### 📝 作業手順

#### 3.1 `packages/ui`の初期化

```bash
cd frontend/packages/ui
bun init -y
```

`packages/ui/package.json`を編集：

```json
{
  "name": "@workspace/ui",
  "version": "0.0.0",
  "type": "module",
  "main": "./components/index.ts",
  "types": "./components/index.ts",
  "exports": {
    "./components/*": "./components/ui/*.tsx",
    "./magicui/*": "./components/magicui/*.tsx",
    "./styles": "./styles/globals.css"
  },
  "scripts": {
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.539.0",
    "tailwind-merge": "^3.3.1"
  },
  "devDependencies": {
    "@types/react": "^19.2.2",
    "react": "19.1.0",
    "typescript": "^5.8.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

#### 3.2 shadcn/ui コンポーネントの移行

```bash
# ディレクトリ作成
mkdir -p packages/ui/components/ui
mkdir -p packages/ui/components/magicui
mkdir -p packages/ui/styles

# 既存のshadcn/uiコンポーネントを移行
cp apps/web/src/shared/ui/*.tsx packages/ui/components/ui/
```

#### 3.3 `packages/ui/components/index.ts`の作成

```typescript
// shadcn/ui components
export { Button } from './ui/button'
export { Card, CardContent, CardHeader, CardTitle } from './ui/card'
// ... 他のコンポーネント

// MagicUI components
// export { } from './magicui/...'
```

#### 3.4 `apps/web`から`@workspace/ui`を参照

`apps/web/package.json`に依存追加：

```json
{
  "dependencies": {
    "@workspace/ui": "workspace:*"
  }
}
```

#### 3.5 shadcn/ui モノレポモード有効化

```bash
cd frontend/apps/web
pnpm dlx shadcn@canary init --monorepo
```

**プロンプトへの回答:**
- Would you like to use TypeScript? → Yes
- Which style would you like to use? → New York
- Which color would you like to use as base color? → Slate
- Where is your global CSS file? → `src/app/styles/globals.css`
- Would you like to use CSS variables for colors? → Yes
- Are you using a custom tailwind prefix? → No
- Where is your tailwind.config.js located? → `.`
- Configure the import alias for components → `@workspace/ui/components`
- Configure the import alias for utils → `@/lib/utils`

#### 3.6 検証

```bash
cd frontend/apps/web
pnpm dlx shadcn@canary add button

# 正しく packages/ui/components/ui/ にインストールされるか確認
```

✅ **Phase 3完了確認:** コンポーネントが`packages/ui`に追加されればOK

---

## Phase 4: 型定義の共有化（30分）

### 🎯 目標
- Supabase型定義を`packages/types`に移行
- Backend API型定義を追加

### 📝 作業手順

#### 4.1 `packages/types`の作成

```bash
cd frontend/packages/types
bun init -y
```

`packages/types/package.json`を編集：

```json
{
  "name": "@workspace/types",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./database": "./src/database.ts",
    "./api": "./src/api/index.ts"
  },
  "scripts": {
    "generate": "pnpm run ../../scripts/generate-types.ts",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.55.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

#### 4.2 型生成スクリプトの作成

`frontend/scripts/generate-types.ts`を作成：

```typescript
#!/usr/bin/env bun

import { $ } from 'bun'

console.log('🔄 Generating Supabase types...')

// Supabase型生成
await $`cd .. && supabase gen types typescript --local > frontend/packages/types/src/database.ts`

console.log('✅ Type generation complete!')
```

#### 4.3 型生成の実行

```bash
cd frontend
pnpm run scripts/generate-types.ts
```

#### 4.4 `packages/types/src/index.ts`の作成

```typescript
export type { Database } from './database'

// 共通型定義
export interface User {
  id: string
  email: string
  name?: string
}

// 他の共通型定義...
```

#### 4.5 `apps/web`から型をインポート

`apps/web/package.json`に依存追加：

```json
{
  "dependencies": {
    "@workspace/types": "workspace:*"
  }
}
```

✅ **Phase 4完了確認:** 型がインポートできればOK

---

## Phase 5: インポートパス更新（1時間）

### 🎯 目標
- 既存のインポートパスをワークスペースパスに更新

### 📝 作業手順

#### 5.1 インポートパスの対応表

| Before | After |
|--------|-------|
| `@/shared/ui/button` | `@workspace/ui/components/button` |
| `@/types/supabase` | `@workspace/types` |
| `@/lib/utils` | `@workspace/utils` |

#### 5.2 一括置換（VS Code）

1. VS Codeで`apps/web/src`を開く
2. `Cmd+Shift+F`で検索
3. 正規表現モードを有効化
4. 以下のパターンで検索・置換：

**UIコンポーネント:**
```
検索: from ['"]@/shared/ui/(.+)['"]
置換: from '@workspace/ui/components/$1'
```

**型定義:**
```
検索: from ['"]@/types/(.+)['"]
置換: from '@workspace/types'
```

#### 5.3 手動修正が必要な箇所

- FSD layersの`shared/`ディレクトリは残す（アプリ固有のコード）
- `entities/`, `features/`, `widgets/`, `views/`は変更不要

#### 5.4 検証

```bash
cd frontend/apps/web
pnpm run type-check
pnpm run lint
pnpm run build
```

✅ **Phase 5完了確認:** ビルドエラーがなければOK

---

## Phase 6: 検証とテスト（30分）

### 🎯 目標
- 全体のビルドとテストを実行
- ドキュメントを確認

### 📝 作業手順

#### 6.1 クリーンビルド

```bash
cd frontend
pnpm run clean
pnpm install
pnpm run build
```

#### 6.2 開発サーバー起動

```bash
pnpm run dev
```

ブラウザで`http://localhost:3000`にアクセスし、以下を確認：

- [ ] ページが正常に表示される
- [ ] UIコンポーネントが正しく動作する
- [ ] 型エラーがない

#### 6.3 Turborepoキャッシュの確認

```bash
# 2回目のビルドが高速化されるか確認
pnpm run build

# キャッシュヒット率を確認
```

#### 6.4 shadcn/ui コンポーネント追加テスト

```bash
pnpm run ui:add dialog
```

正しく`packages/ui/components/ui/dialog.tsx`に追加されるか確認。

✅ **Phase 6完了確認:** すべてのチェック項目が✅であればOK

---

## ロールバック手順

万が一問題が発生した場合のロールバック手順：

```bash
cd frontend

# バックアップから復元
cp package.json.backup package.json
cp pnpm-lock.yaml.backup pnpm-lock.yaml

# apps/webの内容をルートに戻す
cp -r apps/web/* .

# モノレポ構造を削除
rm -rf apps/ packages/ tooling/ scripts/
rm turbo.json

# 依存関係を再インストール
pnpm install
```

---

## 次のステップ

移行完了後、以下の拡張が可能になります：

1. **モバイルアプリの追加**
   ```bash
   cd frontend/apps
   pnpm dlx create-expo-app mobile
   ```

2. **ドキュメントサイトの追加**
   ```bash
   cd frontend/apps
   pnpm dlx create-next-app@latest docs
   ```

3. **Storybookの追加**
   ```bash
   cd frontend/packages/ui
   pnpm dlx storybook@latest init
   ```

---

## 参考リンク

- [Turborepo公式ドキュメント](https://turborepo.com/docs)
- [shadcn/ui Monorepo](https://ui.shadcn.com/docs/monorepo)
- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
