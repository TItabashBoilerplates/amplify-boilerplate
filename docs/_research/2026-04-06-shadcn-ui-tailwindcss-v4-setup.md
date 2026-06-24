# shadcn/ui + TailwindCSS v4 Setup 調査レポート

## 調査情報
- **調査日**: 2026-04-06
- **調査者**: spec agent

## バージョン情報
- **shadcn (npm)**: v4.1.2 (latest)
- **tailwindcss**: v4.x
- **tw-animate-css**: v1.3.7 (project current)
- **@tailwindcss/postcss**: v4.x

## 1. 公式 CSS ファイル構造 (globals.css)

### 最新の公式 imports (3つ)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

**重要な変更点**: `shadcn/tailwind.css` は `shadcn` npm パッケージが提供する CSS ファイル。`shadcn` をランタイム依存に追加する必要がある。

### @custom-variant

```css
@custom-variant dark (&:is(.dark *));
```

### @theme inline ブロック (公式最新)

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}
```

### :root (Light Mode - oklch)

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
```

### .dark (Dark Mode - oklch)

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

### @layer base

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

## 2. postcss.config.mjs (公式)

```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

**注**: Tailwind CSS v4 では `@tailwindcss/postcss` プラグインのみ。`autoprefixer` は不要。

## 3. tailwind.config.ts は不要

Tailwind CSS v4 では CSS-first 設定に完全移行。`tailwind.config.ts` / `tailwind.config.js` は **不要**。

`components.json` の `tailwind.config` は空文字列 `""` にする。

## 4. components.json (公式最新)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### 主要プロパティ

| プロパティ | 値 | 備考 |
|-----------|-----|------|
| style | `"new-york"` | `"default"` は非推奨 |
| tailwind.config | `""` | v4 では空文字列 |
| tailwind.baseColor | `"neutral"` | 他: stone, zinc, mauve, olive, mist, taupe |
| iconLibrary | `"lucide"` | Lucide React |

## 5. tw-animate-css vs tailwindcss-animate

| パッケージ | ステータス | TW v4 対応 |
|-----------|-----------|-----------|
| `tw-animate-css` | **推奨 (現行)** | Yes |
| `tailwindcss-animate` | **非推奨** | No (プラグインベース) |

公式ドキュメントより:
> "We've deprecated tailwindcss-animate in favor of tw-animate-css. New projects will have tw-animate-css installed by default."

CSS での使用方法:
```css
@import "tw-animate-css";  /* 推奨 */
/* @plugin 'tailwindcss-animate';  非推奨 */
```

## 6. @theme inline の radius 計算式

### 現在のプロジェクト (旧)
```css
--radius-sm: calc(var(--radius) - 4px);
--radius-md: calc(var(--radius) - 2px);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) + 4px);
```

### 公式最新
```css
--radius-sm: calc(var(--radius) * 0.6);
--radius-md: calc(var(--radius) * 0.8);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) * 1.4);
--radius-2xl: calc(var(--radius) * 1.8);
--radius-3xl: calc(var(--radius) * 2.2);
--radius-4xl: calc(var(--radius) * 2.6);
```

**変更点**: 減算ベース (`- Npx`) から乗算ベース (`* N`) に変更。2xl/3xl/4xl が追加。

## 7. `shadcn/tailwind.css` について

`shadcn` npm パッケージ (v4.1.2) が提供する CSS ファイル。

### 現在のプロジェクトの状態

- `shadcn` パッケージは **未インストール** (CLI として `bunx shadcn@canary` のみ使用)
- `@import "shadcn/tailwind.css"` は globals.css に **含まれていない**
- `@theme inline` ブロックで手動マッピングしている

### 公式推奨

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";   /* shadcn パッケージから */
```

`shadcn` を依存関係に追加する必要がある:
```bash
bun add shadcn
```

## 8. プロジェクトの現状との差分

| 項目 | 現在のプロジェクト | 公式最新 | 要対応 |
|------|------------------|---------|--------|
| `@import "shadcn/tailwind.css"` | なし | あり | Yes (shadcn 依存追加) |
| `--font-sans` / `--font-mono` | @theme に含む | @theme に含まない | 確認 |
| radius 計算 | 減算ベース (`- Npx`) | 乗算ベース (`* N`) | Yes |
| radius 種類 | sm/md/lg/xl | sm/md/lg/xl/2xl/3xl/4xl | Yes |
| `--destructive-foreground` | @theme に含む | @theme に含む | OK |
| oklch カラー | 使用中 | 使用中 | OK |
| `tw-animate-css` | 使用中 | 使用中 | OK |
| `@custom-variant dark` | あり | あり | OK |
| `@layer base` | 使用中 | 使用中 | OK |
| postcss.config.mjs | `@tailwindcss/postcss` | `@tailwindcss/postcss` | OK |
| tailwind.config.ts | なし | 不要 | OK |

## 参考リンク
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui Manual Installation](https://ui.shadcn.com/docs/installation/manual)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui components.json](https://ui.shadcn.com/docs/components-json)
- [shadcn npm package](https://www.npmjs.com/package/shadcn)
- [Tailwind CSS v4 PostCSS Installation](https://tailwindcss.com/docs/installation/using-postcss)
- [shadcn app-tailwind-v4 Example Repo](https://github.com/shadcn/app-tailwind-v4)
