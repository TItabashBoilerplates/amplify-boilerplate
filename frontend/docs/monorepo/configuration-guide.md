# モノレポ設定ファイルガイド

このドキュメントでは、フロントエンドモノレポで使用する各種設定ファイルの詳細を解説します。

---

## 📋 目次

1. [turbo.json](#turbojson) - Turborepo設定
2. [package.json](#packagejson) - パッケージ定義
3. [tsconfig.json](#tsconfigjson) - TypeScript設定
4. [components.json](#componentsjson) - shadcn/ui設定
5. [tailwind.config.ts](#tailwindconfigts) - TailwindCSS設定
6. [eslint.config.mjs](#eslintconfigmjs) - ESLint設定

---

## turbo.json

**場所:** `frontend/turbo.json`

**役割:** Turborepoのタスク実行、キャッシュ、依存関係を定義

### 完全な設定例

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
      "inputs": [
        "$TURBO_DEFAULT$",
        "eslint.config.*"
      ]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "inputs": [
        "$TURBO_DEFAULT$",
        "tsconfig.json"
      ],
      "outputs": []
    },
    "format": {
      "outputs": [],
      "cache": false
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": [
        "$TURBO_DEFAULT$",
        "**/*.test.ts",
        "**/*.spec.ts"
      ],
      "outputs": [
        "coverage/**"
      ]
    },
    "clean": {
      "cache": false
    }
  },
  "globalDependencies": [
    "**/.env*",
    "turbo.json",
    "package.json"
  ],
  "globalEnv": [
    "NODE_ENV",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ]
}
```

### 各フィールドの解説

#### `$schema`
```json
"$schema": "https://turbo.build/schema.json"
```
- VS CodeでのIntelliSenseを有効化
- 設定の検証を提供

#### `ui`
```json
"ui": "tui"
```
- `"tui"`: ターミナルUIでタスク実行状況を表示
- `"stream"`: ログをストリーム出力（CI推奨）

#### `tasks.build`

**`dependsOn`:**
```json
"dependsOn": ["^build"]
```
- `^build`: 依存パッケージの`build`タスクを先に実行
- `^`: トポロジカルソート（依存順）を意味する

**`inputs`:**
```json
"inputs": [
  "$TURBO_DEFAULT$",
  ".env*",
  "!**/.env*.local"
]
```
- `$TURBO_DEFAULT$`: デフォルトのファイル（ソースコード、設定ファイル）
- `.env*`: 環境変数ファイルも含める
- `!**/.env*.local`: ローカル環境変数は除外

**`outputs`:**
```json
"outputs": [
  ".next/**",
  "!.next/cache/**",
  "dist/**"
]
```
- ビルド結果の出力先
- キャッシュ対象となる
- `.next/cache/**`は除外（Next.jsの内部キャッシュ）

#### `tasks.dev`

```json
"dev": {
  "cache": false,
  "persistent": true
}
```
- `cache: false`: 開発サーバーはキャッシュしない
- `persistent: true`: プロセスが終了するまで実行し続ける

#### `globalDependencies`

```json
"globalDependencies": [
  "**/.env*",
  "turbo.json",
  "package.json"
]
```
- これらのファイルが変更されたら、すべてのキャッシュを無効化

#### `globalEnv`

```json
"globalEnv": [
  "NODE_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
]
```
- これらの環境変数が変更されたら、キャッシュを無効化

---

## package.json

### ルート package.json

**場所:** `frontend/package.json`

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

#### `workspaces`

```json
"workspaces": [
  "apps/*",
  "packages/*",
  "tooling/*"
]
```
- Bunワークスペースの定義
- これらのディレクトリ内の`package.json`を自動認識

#### `scripts`

| スクリプト | 説明 |
|-----------|------|
| `dev` | すべてのアプリの開発サーバーを起動 |
| `build` | すべてのアプリをビルド |
| `lint` | すべてのパッケージでLint実行 |
| `ui:add` | shadcn/uiコンポーネントを追加 |
| `generate:types` | Supabase型を自動生成 |

#### `packageManager`

```json
"packageManager": "bun@1.2.0"
```
- Bunのバージョンを固定
- チーム全体で同じバージョンを使用

---

### apps/web/package.json

**場所:** `frontend/apps/web/package.json`

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
    "@workspace/ui": "workspace:*",
    "@workspace/types": "workspace:*",
    "@workspace/utils": "workspace:*",
    "@workspace/api-client": "workspace:*",
    "@supabase/supabase-js": "^2.55.0",
    "next": "^16.0.0",
    "next-intl": "^4.4.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "zustand": "^5.0.7"
  },
  "devDependencies": {
    "@workspace/eslint-config": "workspace:*",
    "@workspace/typescript-config": "workspace:*",
    "@workspace/tailwind-config": "workspace:*",
    "@types/node": "^24.9.1",
    "@types/react": "^19.2.2",
    "typescript": "^5"
  }
}
```

#### ワークスペース依存関係

```json
"@workspace/ui": "workspace:*"
```
- `workspace:*`: ローカルパッケージを参照
- `*`: 常に最新バージョンを使用

---

### packages/ui/package.json

**場所:** `frontend/packages/ui/package.json`

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
    "@workspace/typescript-config": "workspace:*",
    "@types/react": "^19.2.2",
    "react": "19.1.0",
    "typescript": "^5.8.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

#### `exports`

```json
"exports": {
  "./components/*": "./components/ui/*.tsx",
  "./magicui/*": "./components/magicui/*.tsx",
  "./styles": "./styles/globals.css"
}
```
- パッケージのサブパスをエクスポート
- `import { Button } from '@workspace/ui/components/button'`が可能に

#### `peerDependencies`

```json
"peerDependencies": {
  "react": "^19.0.0"
}
```
- 利用側のReactを使用（重複インストール回避）

---

## tsconfig.json

### ルート tsconfig.json

**場所:** `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "jsx": "preserve",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": ".",
    "composite": true,
    "incremental": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": [
    "node_modules",
    "dist",
    ".turbo"
  ]
}
```

---

### apps/web/tsconfig.json

**場所:** `frontend/apps/web/tsconfig.json`

```json
{
  "extends": "../../tooling/typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@workspace/ui": ["../../packages/ui/components"],
      "@workspace/ui/components/*": ["../../packages/ui/components/ui/*"],
      "@workspace/types": ["../../packages/types/src"],
      "@workspace/utils": ["../../packages/utils/src"],
      "@workspace/api-client": ["../../packages/api-client/src"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

#### `paths`

```json
"paths": {
  "@/*": ["./src/*"],
  "@workspace/ui": ["../../packages/ui/components"]
}
```
- インポートパスのエイリアス
- `@/`はアプリ内、`@workspace/*`は共有パッケージ

---

### tooling/typescript/base.json

**場所:** `frontend/tooling/typescript/base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

### tooling/typescript/nextjs.json

**場所:** `frontend/tooling/typescript/nextjs.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2020"],
    "jsx": "preserve",
    "incremental": true,
    "isolatedModules": true,
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

---

## components.json

**場所:** `frontend/apps/web/components.json`

**役割:** shadcn/uiのモノレポ設定

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@workspace/ui/components",
    "utils": "@/lib/utils",
    "ui": "@workspace/ui/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### 重要なフィールド

#### `aliases.components`

```json
"components": "@workspace/ui/components"
```
- `pnpm dlx shadcn@canary add button`で追加されるコンポーネントの保存先
- `packages/ui/components/ui/button.tsx`に追加される

#### `aliases.utils`

```json
"utils": "@/lib/utils"
```
- `cn()`などのユーティリティ関数の場所

---

## tailwind.config.ts

### apps/web/tailwind.config.ts

**場所:** `frontend/apps/web/tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss"
import { preset } from "@workspace/tailwind-config"

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/components/**/*.{js,ts,jsx,tsx}"
  ],
  presets: [preset],
  theme: {
    extend: {
      // アプリ固有のカスタマイズ
    },
  },
  plugins: [],
}

export default config
```

#### `content`

```typescript
content: [
  "./src/**/*.{js,ts,jsx,tsx,mdx}",
  "../../packages/ui/components/**/*.{js,ts,jsx,tsx}"
]
```
- Tailwindがスキャンするファイルのパス
- **重要:** `packages/ui`も含める（共有コンポーネント）

---

### tooling/tailwind/preset.ts

**場所:** `frontend/tooling/tailwind/preset.ts`

```typescript
import type { Config } from "tailwindcss"

export const preset: Config = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ...
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

---

## eslint.config.mjs

### apps/web/eslint.config.mjs

**場所:** `frontend/apps/web/eslint.config.mjs`

```javascript
import baseConfig from "@workspace/eslint-config/base.js"
import nextConfig from "@workspace/eslint-config/next.js"

export default [
  ...baseConfig,
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "dist/**",
      "node_modules/**"
    ]
  }
]
```

---

### tooling/eslint/base.js

**場所:** `frontend/tooling/eslint/base.js`

```javascript
import js from "@eslint/js"
import typescript from "@typescript-eslint/eslint-plugin"
import typescriptParser from "@typescript-eslint/parser"

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": typescript
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
]
```

---

### tooling/eslint/next.js

**場所:** `frontend/tooling/eslint/next.js`

```javascript
import nextPlugin from "@next/eslint-plugin-next"

export default [
  {
    plugins: {
      "@next/next": nextPlugin
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules
    }
  }
]
```

---

## 環境変数の管理

### .env.example

**場所:** `frontend/.env.example`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### .env.local（ローカル開発用）

```bash
# .gitignoreに追加済み
# 各開発者が個別に作成
```

---

## スクリプトの設定

### scripts/generate-types.ts

**場所:** `frontend/scripts/generate-types.ts`

```typescript
#!/usr/bin/env bun

import { $ } from 'bun'

console.log('🔄 Generating Supabase types...')

try {
  // Supabase型生成
  await $`cd .. && supabase gen types typescript --local > frontend/packages/types/src/database.ts`

  console.log('✅ Type generation complete!')
} catch (error) {
  console.error('❌ Type generation failed:', error)
  process.exit(1)
}
```

**実行:**
```bash
pnpm run scripts/generate-types.ts
```

---

## まとめ

### 設定ファイルの役割分担

| ファイル | 役割 | 場所 |
|---------|------|------|
| `turbo.json` | タスク実行、キャッシュ | ルート |
| `package.json` | パッケージ定義、スクリプト | 各パッケージ |
| `tsconfig.json` | TypeScript設定 | 各パッケージ |
| `components.json` | shadcn/ui設定 | apps/web |
| `tailwind.config.ts` | TailwindCSS設定 | apps/web |
| `eslint.config.mjs` | ESLint設定 | 各パッケージ |

### 設定の継承関係

```
tooling/typescript/base.json
    ↓ extends
tooling/typescript/nextjs.json
    ↓ extends
apps/web/tsconfig.json
```

```
tooling/eslint/base.js
    ↓ import
tooling/eslint/next.js
    ↓ import
apps/web/eslint.config.mjs
```

---

## 参考リンク

- [Turborepo Configuration](https://turborepo.com/docs/reference/configuration)
- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [shadcn/ui Monorepo](https://ui.shadcn.com/docs/monorepo)
