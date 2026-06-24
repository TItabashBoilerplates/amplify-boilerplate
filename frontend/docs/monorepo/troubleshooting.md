# トラブルシューティング

モノレポ移行・運用時によくある問題と解決方法をまとめています。

---

## 📋 目次

1. [Turborepoの問題](#turborepoの問題)
2. [Bunワークスペースの問題](#bunワークスペースの問題)
3. [shadcn/uiの問題](#shadcnuiの問題)
4. [TypeScriptの問題](#typescriptの問題)
5. [ビルドエラー](#ビルドエラー)
6. [パフォーマンスの問題](#パフォーマンスの問題)
7. [環境変数の問題](#環境変数の問題)

---

## Turborepoの問題

### ❌ エラー: `turbo: command not found`

**原因:** Turborepoがインストールされていない

**解決方法:**

```bash
cd frontend
bun add -D turbo @turbo/gen
```

または、グローバルインストール:

```bash
bun add -g turbo
```

---

### ❌ エラー: `Could not find turbo.json`

**原因:** `turbo.json`がルートディレクトリに存在しない

**解決方法:**

```bash
# frontend/turbo.json が存在するか確認
ls frontend/turbo.json

# 存在しない場合は作成
cd frontend
cat > turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
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
EOF
```

---

### ❌ エラー: `turbo` runs forever without output

**原因:** キャッシュが破損している

**解決方法:**

```bash
# キャッシュをクリア
cd frontend
rm -rf .turbo
bun run build
```

---

### ⚠️ Turborepoがキャッシュヒットしない

**原因:** `globalDependencies`や`inputs`の設定が不適切

**解決方法:**

`turbo.json`を確認:

```json
{
  "tasks": {
    "build": {
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env*"
      ]
    }
  },
  "globalDependencies": [
    "**/.env*",
    "turbo.json"
  ]
}
```

---

## Bunワークスペースの問題

### ❌ エラー: `Cannot find module '@workspace/ui'`

**原因:** ワークスペースが正しく解決されていない

**解決方法:**

1. `package.json`の`workspaces`を確認:

```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

2. 依存関係を再インストール:

```bash
cd frontend
rm -rf node_modules
rm bun.lockb
bun install
```

---

### ❌ エラー: `Package "@workspace/ui" not found`

**原因:** パッケージ名が一致していない

**解決方法:**

1. `packages/ui/package.json`の`name`を確認:

```json
{
  "name": "@workspace/ui"
}
```

2. `apps/web/package.json`の`dependencies`を確認:

```json
{
  "dependencies": {
    "@workspace/ui": "workspace:*"
  }
}
```

3. 再インストール:

```bash
cd frontend
bun install
```

---

### ⚠️ 依存関係の重複インストール

**症状:** `react`や`typescript`が複数回インストールされる

**解決方法:**

`peerDependencies`を使用:

```json
// packages/ui/package.json
{
  "peerDependencies": {
    "react": "^19.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "react": "19.1.0",
    "typescript": "^5.8.0"
  }
}
```

---

## shadcn/uiの問題

### ❌ エラー: `bunx shadcn@canary add button` でコンポーネントが追加されない

**原因:** `components.json`のパス設定が間違っている

**解決方法:**

`apps/web/components.json`を確認:

```json
{
  "aliases": {
    "components": "@workspace/ui/components",
    "ui": "@workspace/ui/components/ui"
  }
}
```

---

### ❌ コンポーネントが`apps/web/src`に追加される

**原因:** モノレポモードが有効になっていない

**解決方法:**

1. `apps/web`で再初期化:

```bash
cd apps/web
bunx shadcn@canary init --monorepo
```

2. プロンプトで正しいパスを指定:
   - Components alias: `@workspace/ui/components`

---

### ⚠️ コンポーネントのインポートエラー

**症状:** `Cannot find module '@workspace/ui/components/button'`

**解決方法:**

1. `packages/ui/components/index.ts`を確認:

```typescript
export { Button } from './ui/button'
```

2. インポートパスを確認:

```typescript
// ✅ 正しい
import { Button } from '@workspace/ui/components/button'

// ❌ 間違い
import { Button } from '@workspace/ui/button'
```

---

### ⚠️ Tailwindスタイルが適用されない

**原因:** `tailwind.config.ts`の`content`に`packages/ui`が含まれていない

**解決方法:**

`apps/web/tailwind.config.ts`を編集:

```typescript
const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/components/**/*.{js,ts,jsx,tsx}" // ← 追加
  ],
  // ...
}
```

---

## TypeScriptの問題

### ❌ エラー: `Cannot find module '@workspace/ui'`

**原因:** `tsconfig.json`のパス設定が間違っている

**解決方法:**

`apps/web/tsconfig.json`を確認:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@workspace/ui": ["../../packages/ui/components"],
      "@workspace/ui/components/*": ["../../packages/ui/components/ui/*"]
    }
  }
}
```

---

### ❌ エラー: `Type error: Cannot find type definitions`

**原因:** `@types`パッケージが不足している

**解決方法:**

```bash
cd apps/web
bun add -D @types/node @types/react @types/react-dom
```

---

### ⚠️ `tsc --noEmit`が遅い

**原因:** プロジェクトリファレンスが設定されていない

**解決方法:**

`tsconfig.json`に`composite`と`references`を追加:

```json
{
  "compilerOptions": {
    "composite": true,
    "incremental": true
  },
  "references": [
    { "path": "../../packages/ui" },
    { "path": "../../packages/types" }
  ]
}
```

---

## ビルドエラー

### ❌ エラー: `Module not found: Can't resolve '@workspace/ui'`

**原因:** Next.jsがワークスペースを解決できない

**解決方法:**

`apps/web/next.config.ts`を確認:

```typescript
import type { NextConfig } from "next"

const config: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@workspace/types",
    "@workspace/utils"
  ]
}

export default config
```

---

### ❌ エラー: `Failed to compile. Module build failed`

**原因:** 依存関係が正しくビルドされていない

**解決方法:**

1. クリーンビルド:

```bash
cd frontend
bun run clean
rm -rf node_modules .turbo
bun install
bun run build
```

2. `turbo.json`の`dependsOn`を確認:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

### ⚠️ ビルドが遅い

**原因:** Turborepoキャッシュが効いていない

**解決方法:**

1. `turbo.json`の`outputs`を確認:

```json
{
  "tasks": {
    "build": {
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "dist/**"
      ]
    }
  }
}
```

2. キャッシュを確認:

```bash
# 2回目のビルドが高速になるか確認
bun run build
bun run build
```

---

## パフォーマンスの問題

### ⚠️ `bun install`が遅い

**解決方法:**

1. ローカルキャッシュをクリア:

```bash
rm -rf ~/.bun/install/cache
```

2. `bun.lockb`を削除して再インストール:

```bash
rm bun.lockb
bun install
```

---

### ⚠️ `turbo build`が遅い

**解決方法:**

1. 並列実行数を制限:

```bash
turbo build --concurrency=4
```

2. リモートキャッシュを有効化（Vercel）:

```bash
turbo login
turbo link
```

---

### ⚠️ 開発サーバーが遅い

**解決方法:**

1. Next.js 16のTurbopackを使用（デフォルト有効）:

```bash
bun run dev
```

2. 不要なパッケージをワークスペースから除外:

```json
// package.json
{
  "workspaces": [
    "apps/*",
    "packages/*"
    // "tooling/*" は必要時のみ
  ]
}
```

---

## 環境変数の問題

### ❌ エラー: `process.env.NEXT_PUBLIC_SUPABASE_URL is undefined`

**原因:** 環境変数が読み込まれていない

**解決方法:**

1. `.env.local`を作成:

```bash
cd frontend/apps/web
cp ../../.env.example .env.local
```

2. 環境変数を設定:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. 開発サーバーを再起動:

```bash
bun run dev
```

---

### ⚠️ 環境変数が更新されない

**原因:** Next.jsがキャッシュしている

**解決方法:**

```bash
# .nextキャッシュを削除
rm -rf apps/web/.next
bun run dev
```

---

## よくある質問（FAQ）

### Q1: `workspace:*`と`workspace:0.1.0`の違いは？

**A:**
- `workspace:*`: 常に最新バージョンを使用（推奨）
- `workspace:0.1.0`: 特定バージョンを固定

通常は`workspace:*`を使用してください。

---

### Q2: `packages/ui`を外部パッケージとして公開できる？

**A:** はい、可能です。

1. `packages/ui/package.json`の`private: true`を削除
2. npm publishで公開

```bash
cd packages/ui
npm publish --access public
```

---

### Q3: モノレポ内で異なるReactバージョンを使える？

**A:** 推奨しません。`peerDependencies`で統一することを推奨します。

```json
{
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

---

### Q4: `apps/web`と`apps/mobile`でUIコンポーネントを共有できる？

**A:** はい、`@workspace/ui`を両方でインポートできます。

```typescript
// apps/web
import { Button } from '@workspace/ui/components/button'

// apps/mobile
import { Button } from '@workspace/ui/components/button'
```

---

## デバッグコマンド

### ワークスペースの確認

```bash
# すべてのパッケージをリスト
turbo ls

# パッケージの依存関係を表示
cd apps/web
bun pm ls --all
```

### Turborepoのデバッグ

```bash
# 詳細ログを表示
turbo build --verbosity=2

# ドライラン（実行せずに確認）
turbo build --dry-run
```

### キャッシュの確認

```bash
# キャッシュディレクトリを確認
ls -la .turbo/cache/

# キャッシュサイズを確認
du -sh .turbo/cache/
```

### 型チェックのデバッグ

```bash
# 詳細な型エラーを表示
cd apps/web
tsc --noEmit --listFiles
```

---

## 緊急対応

### すべてクリーンにする

```bash
cd frontend

# すべてのnode_modules削除
find . -name "node_modules" -type d -prune -exec rm -rf {} +

# すべてのビルド成果物削除
find . -name ".next" -type d -prune -exec rm -rf {} +
find . -name "dist" -type d -prune -exec rm -rf {} +

# Turborepoキャッシュ削除
rm -rf .turbo

# ロックファイル削除
rm bun.lockb

# 再インストール
bun install
```

---

## サポート

### 問題が解決しない場合

1. **GitHub Issues**: [プロジェクトのIssues](https://github.com/your-org/your-repo/issues)
2. **Turborepo公式**: [Turborepo Docs](https://turborepo.com/docs)
3. **shadcn/ui Discord**: [discord.gg/shadcn](https://discord.gg/shadcn)
4. **Bun Discord**: [discord.gg/bun](https://discord.gg/bun)

---

## ログの収集方法

バグレポートを作成する際は、以下の情報を含めてください:

```bash
# 環境情報
bun --version
turbo --version
node --version

# パッケージ情報
cd frontend
cat package.json

# ビルドログ
turbo build --verbosity=2 > build.log 2>&1

# エラーログ
cat build.log
```

---

## 定期メンテナンス

### 月次メンテナンス

```bash
# 依存関係の更新
bun update

# 未使用の依存関係を確認
bunx depcheck

# キャッシュのクリーンアップ
rm -rf .turbo/cache/*
```

### 週次メンテナンス

```bash
# Turborepoキャッシュのサイズ確認
du -sh .turbo/cache/

# 大きすぎる場合はクリア
rm -rf .turbo/cache/*
```

---

このトラブルシューティングガイドは随時更新されます。新しい問題が発見されたら、Issue またはPRでお知らせください。
