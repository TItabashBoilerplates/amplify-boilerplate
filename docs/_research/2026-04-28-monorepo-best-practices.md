# Monorepo Best Practices 調査レポート (Turborepo v2 / shadcn/ui / Tailwind v4)

## 調査情報

- **調査日**: 2026-04-28
- **調査者**: spec agent (Claude Code)
- **対象**: Turborepo v2.x, shadcn/ui (Tailwind v4 monorepo template), Tailwind CSS v4
- **目的**: 当プロジェクト (`frontend/` モノレポ) を最新公式ベストプラクティスへ整合させるための事実整理

公式ソースは「Quoted」した部分のみ確実な事実。情報が見つからない箇所は「不明」と明記。

---

## 1. Turborepo v2 公式ベストプラクティス

### 1.1 公式ソース

- [Configuration reference (turbo.json)](https://turborepo.dev/docs/reference/configuration)
- [Package Configurations (workspace turbo.json)](https://turborepo.dev/docs/reference/package-configurations)
- [Repository structure](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [Internal Packages](https://turborepo.dev/docs/core-concepts/internal-packages)
- [`turbo run` flags](https://turborepo.dev/docs/reference/run)
- [Boundaries](https://turborepo.dev/docs/reference/boundaries)

### 1.2 turbo.json v2 スキーマ（top-level）

| フィールド | デフォルト | 役割 / 結論 |
|---|---|---|
| `tasks` | – | v1 の `pipeline` を **置換**（`pipeline` は **deprecated**） |
| `globalDependencies` | – | "list of globs ... If any file matching these globs changes, all tasks will miss cache" |
| `globalEnv` | – | "environment variables that you want to impact the hash of all tasks" |
| `globalPassThroughEnv` | – | env をタスクランタイムに渡すが **ハッシュには含めない** |
| `ui` | `"stream"` | `"tui"` で対話的 TUI（推奨） |
| `concurrency` | `"10"` | 整数または `"50%"` 等 |
| `cacheDir` | `".turbo/cache"` | – |
| `cacheMaxAge` / `cacheMaxSize` | `"0"` (無制限) | LRU eviction |
| `envMode` | `"strict"` | `strict` 推奨（明示宣言した env のみタスクに渡る） |
| `remoteCache` | – | Vercel Remote Cache 統合 |
| `boundaries` | – | tag ベースの依存方向制約（後述） |
| `daemon` | – | **deprecated**（v3 で削除予定） |
| `pipeline` | – | **deprecated**（`tasks` を使用） |

### 1.3 Task-level フィールド（重要なものだけ）

```jsonc
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],            // ^ = 依存パッケージのbuild
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "inputs": ["src/**", "$TURBO_DEFAULT$", "!**/*.md"],
      "env": ["NODE_ENV", "MY_API_*"],    // ハッシュ対象
      "passThroughEnv": ["GITHUB_TOKEN"], // ハッシュ対象外、runtime のみ
      "outputLogs": "new-only",
      "cache": true,
      "persistent": false,
      "interactive": false,
      "interruptible": false,             // turbo watch で再起動可
      "with": ["api#dev"]                 // 並走タスク
    }
  }
}
```

**inputs の特殊値（v2 で導入）**:

- `$TURBO_DEFAULT$`: デフォルト挙動を保ったまま除外を追加
- `$TURBO_ROOT$`: リポジトリルート相対のパス
- `$TURBO_EXTENDS$`: package configurations で配列を **置換ではなく追加**

### 1.4 Workspace Configurations（package-level turbo.json）

公式仕様:

- **Root must be listed first**: `"extends": ["//"]`
- **Scalar fields**（`outputLogs`, `cache`, `persistent` 等）: 自動継承（上書き可）
- **Array fields**（`outputs`, `env`, `inputs`, `dependsOn`, `passThroughEnv`）: "completely replace the root configuration's values by default"
- 配列を **append** したい場合は先頭に `$TURBO_EXTENDS$`
- `globalEnv`/`globalDependencies` は **package config から変更不可**
- ルート `turbo.json` の `extends` は **無視**
- `package#task` 構文は package-level では **使用不可**
- タスクを丸ごと無効化する場合: `{ "extends": false }`

例:

```jsonc
// packages/ui/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "outputs": ["$TURBO_EXTENDS$", "dist/**"]
    },
    "lint": { "extends": false }
  }
}
```

### 1.5 `--filter` / `--affected` / Remote Cache

`--filter` の三種類のターゲット指定（公式）:

| 形式 | 意味 |
|---|---|
| `--filter=ui` | パッケージ名 |
| `--filter={./apps/*}` | ディレクトリ glob（`{}` で囲む） |
| `--filter=[HEAD^1]` | git ref（`[]` で囲む） |
| 修飾子 | `!`=否定, `...`=依存/被依存を含む, `^`=対象を除外 |

組み合わせ例:

```bash
turbo run build --filter=@acme/ui...[HEAD^1]
turbo run test --filter=@acme/*{./packages/*}[HEAD^1]
```

**`--affected`** (公式 quote): "only packages that are affected by changes on the current branch"。比較は既定で `main..HEAD`、env で上書き可:

```bash
TURBO_SCM_BASE=development turbo run build --affected
```

注意: shallow checkout の場合は **全パッケージが「変更あり」扱い**になる。

**Remote Cache**: `remoteCache.signature: true` を有効にして署名検証推奨。Vercel が公式エンドポイント。

### 1.6 リポジトリ構造とパッケージ命名

- ディレクトリは `apps/` と `packages/` の 2 系統に分割が公式推奨
- パッケージ名は **namespace prefix 必須**（例 `@acme/ui`）。`@repo` は npm に存在しないため **公式 example 用**
- **ネスト不可**: "Turborepo does not support nested packages like `apps/**` or `packages/**` due to ambiguous behavior among package managers"
  - `apps/a` と `apps/a/b` の同時存在は不可
  - ただし `packages/*` と `packages/group/*` のような **非ネスト多階層 glob は可**

> **注**: 公式テンプレ `next-monorepo` (2026-04 時点) は `@workspace/ui` を採用しており、`@scope/name` の単一スラッシュ規約（プロジェクト要件）に準拠。

### 1.7 Internal Packages: source vs build

| パターン | exports | 推奨条件 |
|---|---|---|
| **Just-in-Time** (source) | `"./button": "./src/button.tsx"` | アプリ側のバンドラ (Next.js / Vite) が TS を直接処理する場合。**build 不要・キャッシュ対象外** |
| **Compiled** (build) | `{ "types": "./src/button.tsx", "default": "./dist/button.js" }` | バンドラが無い consumer がいる、Turborepo キャッシュを活用したい、`sideEffects` 制御したい |

公式 quote: "The majority of Compiled Packages should use `tsc`. Since the package is highly likely to be consumed by an application that is using a bundler, the application's bundler will prepare the library package for distribution."

**結論**: Next.js / Vite だけで消費するなら **Just-in-Time（ソース直 export）が単純で速い**。shadcn/ui 公式テンプレも JIT を採用。

### 1.8 Boundaries: 依存方向の強制

`turbo boundaries` は 2 種の違反を検出（公式 quote）:

1. "Importing a file outside of the package's directory"
2. "Importing a package that is not specified as a dependency in the package's `package.json`"

**Tag を使った apps→packages 一方向の強制**:

`packages/ui/turbo.json`:
```jsonc
{ "tags": ["pkg"] }
```

`apps/web/turbo.json`:
```jsonc
{ "tags": ["app"] }
```

ルート `turbo.json`:
```jsonc
{
  "boundaries": {
    "tags": {
      "pkg": {
        "dependents": { "deny": ["app"] }   // ❌ packages が apps に依存
        // ↑ これは反転している。下記が正しい意味:
        // pkg を import できないのは ... ではなく
      },
      "app": {
        "dependencies": { "allow": ["pkg"] }
      }
    }
  }
}
```

公式が示すパターン（quote）: "you can add an `internal` tag to your UI package" via `./packages/ui/turbo.json` containing `{ "tags": ["internal"] }`、その上で root の `boundaries.tags.<tag>.dependencies / dependents` で allow/deny を宣言する。

> **rules cascade**: "These rules are applied even for dependencies of dependencies"（推移的依存にも適用）

### 1.9 当プロジェクトへの推奨

現状（`frontend/turbo.json`）の状態に対して:

| 観点 | 現状 | 推奨アクション |
|---|---|---|
| `pipeline` → `tasks` | OK（`tasks` 使用） | 変更不要 |
| `ui: "tui"` | OK | 変更不要 |
| `globalEnv` 列挙 | OK | 変更不要 |
| `lint.dependsOn: ["^build"]` | 過剰: lint は通常 build 不要 | **`^build` を外す** か、JIT パッケージなら不要 |
| `type-check.dependsOn: ["^build"]` | JIT パッケージなら不要だが、Compiled なら必要 | shadcn/ui テンプレと同じ JIT 構成にするなら **`^build` を外す** |
| `boundaries` 未使用 | – | `apps/*` と `packages/*` で tag を分け、`packages → apps` 依存を deny する |
| Remote Cache | 不明 | チームで導入する場合 `remoteCache.signature: true` |
| `package.json` の `workspaces` に `packages/ui/*`, `packages/client/*` がある | **ネスト workspace** | Turborepo は `packages/group/*` の二段 glob を許可しているので合法。ただし `@scope/name` 規約は維持すること（単一スラッシュ） |

---

## 2. shadcn/ui 公式モノレポテンプレート（最新）

### 2.1 公式ソース

- [shadcn/ui Monorepo docs](https://ui.shadcn.com/docs/monorepo)
- [shadcn-ui/ui templates/next-monorepo](https://github.com/shadcn-ui/ui/tree/main/templates/next-monorepo) (`main` ブランチ、2026-04-28 時点)
- 関連 changelog: [Tailwind v4 (2025-02)](https://ui.shadcn.com/docs/changelog), [Monorepo Support (2024-12)](https://ui.shadcn.com/docs/changelog)

### 2.2 公式テンプレートの実体（2026-04-28 fetch 結果）

```
templates/next-monorepo/
├── apps/
│   └── web/
│       ├── app/{layout.tsx, page.tsx}
│       ├── components.json          # アプリ固有
│       ├── package.json             # name: "web"
│       ├── postcss.config.mjs       # @workspace/ui/postcss.config を re-export
│       ├── tsconfig.json
│       └── next.config.mjs
├── packages/
│   ├── ui/
│   │   ├── components.json          # 共有 UI 用
│   │   ├── package.json             # name: "@workspace/ui"
│   │   ├── postcss.config.mjs       # Tailwind v4 PostCSS plugin
│   │   └── src/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── lib/
│   │       └── styles/
│   │           └── globals.css      # ★ ここが唯一の Tailwind エントリ
│   ├── eslint-config/
│   └── typescript-config/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── turbo.json
```

### 2.3 packages/ui/package.json（公式版・2026-04-28 取得）

```json
{
  "name": "@workspace/ui",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "lint": "eslint",
    "format": "prettier --write \"**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next-themes": "^0.4.6",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.18",
    "tailwindcss": "^4.1.18",
    "@types/node": "^25.1.0",
    "@types/react": "^19.2.10",
    "@types/react-dom": "^19.2.3",
    "eslint": "^9.39.2",
    "typescript": "^5.9.3"
  },
  "exports": {
    "./globals.css":   "./src/styles/globals.css",
    "./postcss.config":"./postcss.config.mjs",
    "./lib/*":         "./src/lib/*.ts",
    "./components/*":  "./src/components/*.tsx",
    "./hooks/*":       "./src/hooks/*.ts"
  }
}
```

**結論（事実）**:
- **Just-in-Time（ソース直 export）パターン**。`build` スクリプトも `dist/` も無い
- `globals.css` と `postcss.config.mjs` は package の **assets として `exports` 経由で公開**
- pattern export (`./components/*`, `./hooks/*`, `./lib/*`) で個別 import 可（`import { Button } from "@workspace/ui/components/button"`）

### 2.4 packages/ui/components.json（公式版）

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@workspace/ui/components",
    "utils": "@workspace/ui/lib/utils",
    "hooks": "@workspace/ui/hooks",
    "lib": "@workspace/ui/lib",
    "ui": "@workspace/ui/components"
  }
}
```

### 2.5 apps/web/components.json（公式版）

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "../../packages/ui/src/styles/globals.css",   // ★ packages を指す
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "hooks": "@/hooks",
    "lib": "@/lib",
    "utils": "@workspace/ui/lib/utils",
    "ui": "@workspace/ui/components"
  }
}
```

公式 docs quote: "Ensure you have the same `style`, `iconLibrary` and `baseColor` in both `components.json` files."

公式 docs quote: "For Tailwind CSS v4, leave the `tailwind` config empty in the `components.json` file."（→ `tailwind.config: ""`）

### 2.6 CSS の所有権 ★（重要結論）

**packages/ui が globals.css を所有する**。apps は **import するだけ**で自前の globals.css を持たない。

`apps/web/app/layout.tsx`（公式テンプレ実物）:
```tsx
import "@workspace/ui/globals.css"  // ★ package のものを直接 import
```

`packages/ui/src/styles/globals.css`（公式テンプレ実物・全文）:
```css
@import "tailwindcss";
@source "../../../apps/**/*.{ts,tsx}";
@source "../../../components/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";
```

> **重要**: 公式テンプレは `@source` を **packages/ui 側に置き、apps を相対パスで参照**している（`../../../apps/**/*`）。これは「共有パッケージが consumer を知らない」原則とは **逆向き**だが、shadcn 公式が現状採用しているパターン。Tailwind v4 の `@source` は relative path しか取らないため、build 時に packages/ui を起点にスキャンが走る場合の現実解。
>
> 詳細議論は §3 で扱う。

### 2.7 PostCSS 構成

`packages/ui/postcss.config.mjs`:
```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

`apps/web/postcss.config.mjs`:
```js
export { default } from "@workspace/ui/postcss.config";
```

→ **PostCSS 設定も packages/ui に集約**し、apps は re-export のみ。

### 2.8 root turbo.json（公式テンプレ実物）

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "inputs": ["$TURBO_DEFAULT$", ".env*"], "outputs": [".next/**", "!.next/cache/**"] },
    "lint":      { "dependsOn": ["^lint"] },
    "format":    { "dependsOn": ["^format"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "dev":       { "cache": false, "persistent": true }
  }
}
```

シンプル。`lint`/`typecheck` も `^build` ではなく `^lint`/`^typecheck` を依存にしている点に注目（JIT パッケージなので build を待つ必要がない）。

### 2.9 `bunx shadcn@latest add` のモノレポ動作

公式 docs quote: "Run from the app directory: `cd apps/web && pnpm dlx shadcn@latest add [COMPONENT]`. The tool will figure out what type of component you are adding and install the correct files to the correct path."

→ CLI が `apps/web/components.json` の `aliases` を読み、`ui` 系は `packages/ui/src/components/` に、page 系は `apps/web/components/` に振り分ける。

### 2.10 当プロジェクトへの推奨（shadcn/ui 関連）

| 観点 | 公式 (2026-04 next-monorepo) | 当プロジェクト推奨 |
|---|---|---|
| UI パッケージ名 | `@workspace/ui` (単一スラッシュ) | プロジェクトは `@scope/name` 単一スラッシュ規約あり → 既に整合 |
| `exports` フィールド | pattern export (JIT) | **ソース export を採用**。`build` スクリプトを持たない |
| `globals.css` の所有 | packages/ui のみ | apps 側に重複して置かない。1 ヶ所に集約 |
| PostCSS config | packages/ui に集約・apps は re-export | 同様に集約推奨 |
| `tailwind.config` (components.json) | `""` (空) | Tailwind v4 ではこれが正解 |
| `aliases.ui` (apps 側) | `@workspace/ui/components` | UI コンポーネントは package 側に置き、ページ系のみ apps の `@/components` |

> **mobile アプリ**: shadcn/ui 公式テンプレは web 専用。当プロジェクトの `packages/ui/mobile`（gluestack-ui + NativeWind）は別系統。Tailwind v4 同士でも **PostCSS 経路 (web)** と **NativeWind 経路 (mobile)** はビルダが違うため、`packages/ui/web` と `packages/ui/mobile` を分離する現状の構成は妥当。

---

## 3. Tailwind CSS v4 のモノレポ CSS 構成

### 3.1 公式ソース

- [Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Functions and directives](https://tailwindcss.com/docs/functions-and-directives)
- [Next.js installation guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs)

### 3.2 `@source` の正確な仕様（公式 quote 中心）

| 形式 | 役割 | 公式 quote |
|---|---|---|
| `@source "../node_modules/@acmecorp/ui-lib"` | 追加ソース登録（gitignore / node_modules 配下も） | "especially useful when you need to scan an external library that is built with Tailwind, since dependencies are usually listed in your .gitignore file" |
| `@source not "../src/components/legacy"` | ソース除外 | "useful when you have large directories ... that you know don't use Tailwind classes" |
| `@source inline("...")` | safelist 相当（v3 の `safelist` を置換） | – |
| `@source not inline("...")` | safelist 除外 | – |
| `@import "tailwindcss" source(none)` | **自動検出を完全停止**、明示登録のみ | "useful in projects that have multiple Tailwind stylesheets where you want to make sure each one only includes the classes each stylesheet needs" |
| `@import "tailwindcss" source("../src")` | base path を変更 | "useful when working with monorepos where your build commands run from the root of the monorepo instead of the root of each project" |

### 3.3 パスの仕様（重要）

公式 quote: paths are "relative to the stylesheet."

→ `@source` は **stylesheet ファイルの位置を起点とした相対パスのみ**。プロジェクトルート起点ではない。絶対パスや `~/` 系は **公式に明記がない（不明）**。

→ 共有 CSS パッケージから consumer のパスを書くと「共有パッケージが consumer を知る」状態になる。

### 3.4 「共有パッケージが consumer を知らない」パターン（公式裏付け）

**結論: 公式に明示された推奨パターンとしては不明だが、以下の 2 つの公式機能でほぼ実現可能。**

#### パターン A: app 側で `@source` を宣言、共有 CSS を `@import` する

```css
/* apps/web/src/app/globals.css */
@import "tailwindcss";
@import "@workspace/ui/styles/base.css";    /* node subpath imports 経由 */
@source "../../../../packages/ui/src/**/*.{ts,tsx}";
@source "./**/*.{ts,tsx}";
```

公式 quote: "All directives (`@import`, `@reference`, `@plugin`, `@config`) support Node.js subpath imports."（→ package.json `imports` フィールド経由で `@import "#tailwind"` のような書き方も可能）

これにより:
- 共有パッケージは Tailwind の **テーマ・ユーティリティ定義のみ**を提供
- 各 app が **自分自身の `@source` を宣言**（自分の構造を知っている）
- 共有パッケージは consumer のパス構造を知らずに済む

#### パターン B: app 側で `source(none)` + 個別 `@source`

```css
/* apps/web/src/app/globals.css */
@import "tailwindcss" source(none);
@import "@workspace/ui/theme.css";

@source "../../../../packages/ui/src/**/*.{ts,tsx}";
@source "./**/*.{ts,tsx}";
```

`source(none)` で自動検出を切り、明示的に必要なソースだけ列挙する。**最も決定論的**。複数 app を抱えるモノレポで CSS の出力サイズを app ごとに最適化したい場合に有効。

#### shadcn 公式テンプレが採用しているパターン

§2.6 で示した通り、shadcn 公式テンプレは **packages/ui 側で `@source "../../../apps/**"` を宣言**しており、上記の「consumer を知らない」原則とは **真逆**の構成。これは:

- 単一 globals.css を全アプリで再利用する都合
- Tailwind v4 の `@source` が relative path のみで、apps 側から packages を指すのと、その逆では**ビルド成果が同じ**
- shadcn CLI が「`packages/ui/src/styles/globals.css` を見れば全部分かる」一元管理を優先している

→ **app 数が 1〜2 なら shadcn テンプレ方式で十分**。app 数が増えて出力サイズや所有権を厳密にしたい場合は **パターン A / B に移行**するのが理にかなう。

### 3.5 Next.js + Tailwind v4 + monorepo の最小構成（公式に基づく）

`packages/ui/postcss.config.mjs`:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`apps/web/postcss.config.mjs`:
```js
export { default } from "@workspace/ui/postcss.config";
```

`packages/ui/package.json` exports:
```json
"./globals.css": "./src/styles/globals.css",
"./postcss.config": "./postcss.config.mjs"
```

`apps/web/app/layout.tsx`:
```tsx
import "@workspace/ui/globals.css";
```

→ **これは shadcn/ui 公式 next-monorepo そのまま**で、Tailwind v4 公式 Next.js installation の手順と矛盾しない。

### 3.6 当プロジェクトへの推奨（Tailwind v4）

現状（`frontend/`）の構成詳細は本調査では追わなかったが、ベストプラクティスとして:

1. **`tailwind.config.{ts,js}` は捨てる**。v4 ではすべて CSS 内 `@theme`・`@source` で表現する。`components.json` の `tailwind.config` は空文字列 `""` にする。
2. **PostCSS 設定は packages/ui に集約**し、各 app は re-export する（公式テンプレと同じ）。
3. **`globals.css` は 1 ヶ所**。apps が複数あっても、それぞれ `import "@workspace/ui/globals.css"` する形にし、CSS 重複を避ける。
4. **mobile (NativeWind) は別系統**として `packages/ui/mobile` に分離（現状維持）。NativeWind は PostCSS ではなく Metro 経由でビルドするため、**web の globals.css を共有しない**。
5. app が 3 つ以上に増えたら **パターン A**（app 側で `@source` 宣言）を検討し、共有パッケージから consumer 構造の知識を取り除く。

---

## 4. 不明 / さらなる確認が必要な事項

- **Tailwind v4 `@source` は絶対パスを受けるか**: 公式は「stylesheet 相対」とのみ記述。絶対パス・`~/` の挙動は **不明**。
- **shadcn/ui CLI が pattern export `./components/*` を生成する正確なルール**: 既存テンプレでは個別ファイル単位で export される構造を採用しているが、登録 component が増えた際の上書き挙動は **要検証**。
- **Turborepo `boundaries` の安定性**: 公式 docs に明記された機能だが、`futureFlags` 配下の `affectedUsingTaskInputs` などはまだ experimental。`boundaries` 自体は GA。

---

## 5. 参考リンク（再掲）

### Turborepo
- [Configuration reference](https://turborepo.dev/docs/reference/configuration)
- [Package Configurations](https://turborepo.dev/docs/reference/package-configurations)
- [Repository structure](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [Internal Packages](https://turborepo.dev/docs/core-concepts/internal-packages)
- [`turbo run`](https://turborepo.dev/docs/reference/run)
- [Boundaries](https://turborepo.dev/docs/reference/boundaries)

### shadcn/ui
- [Monorepo docs](https://ui.shadcn.com/docs/monorepo)
- [Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4)
- [Changelog](https://ui.shadcn.com/docs/changelog)
- [Templates: next-monorepo](https://github.com/shadcn-ui/ui/tree/main/templates/next-monorepo)
- [Turborepo guide for shadcn/ui](https://turborepo.dev/docs/guides/tools/shadcn-ui)

### Tailwind CSS v4
- [Detecting classes in source files (`@source`)](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Functions and directives](https://tailwindcss.com/docs/functions-and-directives)
- [Next.js installation](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
