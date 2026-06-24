---
name: storybook
description: Storybook ローカル環境でのコンポーネント開発ガイダンス。Story ファイルの作成、FSD 構成に合わせたサイドバー構造、Next.js モック、Lucide React アイコン、HMR 設定についての質問に使用。UIコンポーネントのカタログ管理の実装支援を提供。
---

# Storybook スキル

このプロジェクトは **Storybook 10 + Vite** をローカルプロセスで実行し、packages と apps の UI コンポーネントを一元管理しています。

## 構成

| 項目           | 場所                                |
| -------------- | ----------------------------------- |
| Storybook 設定 | `frontend/.storybook/`              |
| CSS            | `frontend/.storybook/storybook.css` |

## 起動方法

Storybook は `frontend` で Next.js と同時にバックグラウンドで起動します。

```bash
# 軽量セット (Supabase + backend + storybook) を起動 → TUI 内で Storybook ログ閲覧・再起動可能
devenv up

# Storybook + Next.js (web) を同時起動
dev-web
```

ブラウザで `http://localhost:6006` にアクセス。

## Story ファイルの配置

### 対象ディレクトリ

```typescript
// frontend/.storybook/main.ts
stories: [
  // Packages
  "../packages/ui/**/*.stories.@(ts|tsx)",
  "../packages/native-ui/**/*.stories.@(ts|tsx)",
  // Apps - FSD レイヤー
  "../apps/web/src/entities/**/*.stories.@(ts|tsx)",
  "../apps/web/src/features/**/*.stories.@(ts|tsx)",
  "../apps/web/src/widgets/**/*.stories.@(ts|tsx)",
  "../apps/mobile/src/widgets/**/*.stories.@(ts|tsx)",
];
```

### サイドバー構造（FSD 準拠）

**MANDATORY**: Story の `title` はプロジェクトのモノレポ・FSD 構成に合わせる。

| 対象               | title パターン                          | 例                                   |
| ------------------ | --------------------------------------- | ------------------------------------ |
| packages/ui    | `packages/ui/{Component}`           | `packages/ui/Button`             |
| packages/native-ui | `packages/native-ui/{Component}`        | `packages/native-ui/Button`          |
| apps/web entities  | `apps/web/entities/{slice}/{Component}` | `apps/web/entities/quest/QuestCard`  |
| apps/web features  | `apps/web/features/{slice}/{Component}` | `apps/web/features/vote/VoteModal`   |
| apps/web widgets   | `apps/web/widgets/{slice}/{Component}`  | `apps/web/widgets/app-shell/Sidebar` |

```typescript
// ✅ Good: FSD 構造に準拠
const meta = {
  title: "apps/web/entities/quest/QuestCard",
  component: QuestCard,
} satisfies Meta<typeof QuestCard>;

// ❌ Bad: 独自のカテゴリ名
const meta = {
  title: "Entities/Quest/QuestCard",
  component: QuestCard,
};

// ❌ Bad: フラットな構造
const meta = {
  title: "QuestCard",
  component: QuestCard,
};
```

## Story ファイルの書き方

### 基本テンプレート

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ComponentName } from "./component-name";

const meta = {
  title: "apps/web/entities/slice/ComponentName",
  component: ComponentName,
  parameters: {
    layout: "centered", // or 'fullscreen', 'padded'
  },
  tags: ["autodocs"],
  args: {
    // イベントハンドラーはデフォルト値として fn() を設定
    onClick: fn(),
  },
  argTypes: {
    // Props のコントロール設定
    category: {
      control: "select",
      options: ["option1", "option2"],
    },
  },
} satisfies Meta<typeof ComponentName>;

export default meta;
type Story = StoryObj<typeof meta>;

// 基本ストーリー
export const Default: Story = {
  args: {
    title: "Default Title",
    // ...other props
  },
};

// バリエーション
export const WithCustomProps: Story = {
  args: {
    title: "Custom Title",
    variant: "secondary",
  },
};

// カスタムレンダリング
export const CustomRender: Story = {
  render: () => (
    <div className="flex gap-4">
      <ComponentName title="Item 1" />
      <ComponentName title="Item 2" />
    </div>
  ),
};
```

### Decorator の使用

```typescript
const meta = {
  // ...
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
};
```

## Storybook 10 のお作法（MANDATORY）

### インポートパターン

**CRITICAL**: Storybook 10 では `storybook/*` からインポートする。`@storybook/*` は非推奨。

| 用途                 | Storybook 10          | 旧（非推奨）              |
| -------------------- | --------------------- | ------------------------- |
| テストユーティリティ | `storybook/test`      | `@storybook/test`         |
| React ユーティリティ | `storybook/react`     | `@storybook/react`（一部）|
| プレビュー API       | `storybook/preview-api` | `@storybook/preview-api` |

### 必須インポート

```typescript
// テスト・アクション用（MANDATORY）
import { fn, expect, userEvent, within } from "storybook/test";

// 型定義（これは @storybook/react のまま）
import type { Meta, StoryObj } from "@storybook/react";

// Portable Stories（コンポーネントテスト連携用）
import { composeStories } from "storybook/react";
```

### アクションの定義

**MANDATORY**: イベントハンドラーには必ず `fn()` を使用する。

```typescript
// ✅ GOOD: fn() を使用
import { fn } from "storybook/test";

const meta = {
  component: Button,
  args: {
    onClick: fn(),
    onHover: fn(),
  },
} satisfies Meta<typeof Button>;

// ❌ BAD: action() を使用（Storybook 8 以前の書き方）
import { action } from "@storybook/addon-actions";

const meta = {
  component: Button,
  argTypes: {
    onClick: { action: "clicked" },  // 使用禁止
  },
};
```

### Play Function（インタラクションテスト）

```typescript
import { fn, expect, userEvent, within } from "storybook/test";

export const ClickTest: Story = {
  args: {
    onClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

### Portable Stories（コンポーネントテスト連携）

Story を Vitest/Jest のテストで再利用する場合：

```typescript
// component.stories.tsx
export const Default: Story = { args: { title: "Hello" } };
export const Loading: Story = { args: { isLoading: true } };

// component.test.tsx（Vitest/Jest）
import { composeStories } from "storybook/react";
import { render, screen } from "@testing-library/react";
import * as stories from "./component.stories";

const { Default, Loading } = composeStories(stories);

test("renders default state", () => {
  render(<Default />);
  expect(screen.getByText("Hello")).toBeInTheDocument();
});

test("renders loading state", () => {
  render(<Loading />);
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});
```

## Next.js モック

### 設定済みモック

| モジュール        | モックファイル                        |
| ----------------- | ------------------------------------- |
| `next/navigation` | `.storybook/mocks/next-navigation.ts` |
| `next/link`       | `.storybook/mocks/next-link.tsx`      |
| `next/image`      | `.storybook/mocks/next-image.tsx`     |

### エイリアス設定

**CRITICAL**: 配列形式で定義し、**より具体的なパスを先に**記述する。

```typescript
// frontend/.storybook/main.ts viteFinal
resolve: {
  // 配列形式で順序を保証（オブジェクト形式は使用しない）
  alias: [
    // React Native Web
    { find: 'react-native', replacement: 'react-native-web' },
    // Workspace - 具体的なパスを先に
    { find: '@workspace/ui', replacement: join(__dirname, '../packages/ui') },
    { find: '@workspace/native-ui', replacement: join(__dirname, '../packages/native-ui') },
    { find: '@workspace/tokens', replacement: join(__dirname, '../packages/tokens/src') },
    // App aliases - 具体的なパスを先に
    { find: '@/shared/lib/i18n', replacement: join(__dirname, './mocks/shared-lib-i18n.tsx') },
    { find: '@', replacement: join(__dirname, '../apps/web/src') },
    // Next.js mocks
    { find: 'next/navigation', replacement: join(__dirname, './mocks/next-navigation.ts') },
    { find: 'next/link', replacement: join(__dirname, './mocks/next-link.tsx') },
    { find: 'next/image', replacement: join(__dirname, './mocks/next-image.tsx') },
    // next-intl - 具体的なサブパスを先に
    { find: 'next-intl/navigation', replacement: join(__dirname, './mocks/next-intl.tsx') },
    { find: 'next-intl/routing', replacement: join(__dirname, './mocks/next-intl.tsx') },
    { find: 'next-intl/server', replacement: join(__dirname, './mocks/next-intl.tsx') },
    { find: 'next-intl', replacement: join(__dirname, './mocks/next-intl.tsx') },
  ],
}
```

→ 詳細は「トラブルシューティング > Vite エイリアスの順序問題」を参照

### モックの実装例

**next-navigation.ts**:

```typescript
export const usePathname = () => "/";
export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  back: () => {},
});
export const useSearchParams = () => new URLSearchParams();
```

**next-image.tsx**:

```typescript
import type { CSSProperties } from "react";
import * as React from "react"; // JSX 用に必須

interface MockImageProps {
  src: string | { src: string };
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
}

function NextImage({
  src,
  alt,
  fill,
  className,
  style,
  ...props
}: MockImageProps) {
  const imgSrc = typeof src === "string" ? src : src.src;

  if (fill) {
    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        style={{
          position: "absolute",
          height: "100%",
          width: "100%",
          inset: 0,
          objectFit: "cover",
          ...style,
        }}
        {...props}
      />
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={style}
      {...props}
    />
  );
}

export default NextImage;
```

## アイコン

**MANDATORY**: Lucide React を使用する。Material Symbols は使用しない。

```typescript
// ✅ Good: Lucide React
import { Trophy, Flag, TrendingUp } from "lucide-react";

// ❌ Bad: Material Symbols / Google Fonts
<span className="material-symbols-outlined">sports</span>;
```

アイコンマッピングは `packages/ui/components/icon/icon.tsx` で管理。

## HMR（Hot Module Replacement）

### 有効化の条件

1. `CI=true` 環境変数を設定しない
2. `storybook:ci` ではなく `storybook` スクリプトを使用

### 確認方法

ファイルを編集して自動リロードされることを確認。

## 既知の制限事項

### NativeWind v5 + Storybook

**問題**: NativeWind v5 は `jsx-runtime` をエクスポートしていないため、Mobile コンポーネントはスタイルが適用されない状態で表示される。

**対応**: NativeWind v5 の安定版リリースを待つ。Mobile コンポーネントは構造のみ確認可能。

## TailwindCSS 4 統合

```typescript
// frontend/.storybook/main.ts viteFinal
const { default: tailwindcss } = await import("@tailwindcss/vite");
config.plugins ||= [];
config.plugins.push(tailwindcss());
```

CSS は `.storybook/storybook.css` でインポート:

```css
@import "tailwindcss";
@import "../packages/tokens/web.css";
```

## トラブルシューティング

### `process is not defined`

**原因**: Next.js Image が Node.js の `process` を参照

**解決**:

```typescript
// main.ts viteFinal
define: { 'process.env': {} }
```

### `React is not defined`

**原因**: `.tsx` ファイルで JSX を使用しているが、React が明示的にインポートされていない

**エラー例**:

```
ReferenceError: React is not defined
    at preview.decorators
```

**解決策 1**: React を明示的にインポート

```typescript
// ❌ BAD: React インポートなし
import type { ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return <div>{children}</div>; // React is not defined エラー
}

// ✅ GOOD: React を明示的にインポート
import React, { type ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
```

**解決策 2**: createElement を使用（Biome がインポートを type に変換する場合）

```typescript
// Biome が `import React` を `import type React` に変換してしまう場合
import { createElement, Fragment, type ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(Fragment, null, children);
}
```

**注意**: `preview.tsx` や `.tsx` モックファイルでは React ランタイムが必要。

---

### `__dirname is not defined`

**エラー**:

```
ReferenceError: __dirname is not defined
    at node_modules/next/dist/compiled/@opentelemetry/api/index.js
```

**原因**: `next/cache` 等のサーバーサイド専用モジュールが `__dirname` を使用している

**解決**: `next/cache` をモック化

1. モックファイルを作成:

```typescript
// frontend/.storybook/mocks/next-cache.ts
export const revalidatePath = (_path: string): void => {};
export const revalidateTag = (_tag: string): void => {};
export const unstable_cache = <T extends (...args: unknown[]) => unknown>(
  fn: T
): T => fn;
export const unstable_noStore = (): void => {};
export const cache = <T extends (...args: unknown[]) => unknown>(fn: T): T =>
  fn;
```

2. `main.ts` にエイリアスを追加:

```typescript
'next/cache': join(__dirname, './mocks/next-cache.ts'),
```

---

### `next-intl/routing` が解決できない

**エラー**:

```
Failed to resolve import "next-intl/routing"
```

**原因**: `next-intl/routing` が `next/cache` に依存しており、サーバーサイド専用

**解決**: `next-intl/routing` と関連モジュールをモック化

```typescript
// main.ts エイリアス
'next-intl': join(__dirname, './mocks/next-intl.tsx'),
'next-intl/server': join(__dirname, './mocks/next-intl.tsx'),
'next-intl/routing': join(__dirname, './mocks/next-intl.tsx'),
'next-intl/navigation': join(__dirname, './mocks/next-intl.tsx'),
'next/cache': join(__dirname, './mocks/next-cache.ts'),
```

**モック内容** (`next-intl.tsx` に追加):

```typescript
export const defineRouting = <
  T extends { locales: readonly string[]; defaultLocale: string }
>(
  config: T
) => config;

export const createNavigation = () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement("a", { href }, children),
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => "/",
});
```

---

### アクションのスパイ（fn）

**Storybook 10 では `storybook/test` からインポート**:

```typescript
// ✅ GOOD: Storybook 10 推奨
import { fn } from "storybook/test";

export const Example: Story = {
  args: {
    onClick: fn(),
    onSubmit: fn(),
  },
};

// ❌ BAD: 古いパッケージ（Storybook 8用）
import { fn } from "@storybook/test";
```

**`fn()` のメリット**:

- Actions パネルでイベント呼び出しを確認可能
- Play function でのテスト・アサーションが可能
- `mockReturnValue()`, `mockResolvedValue()` 等のモック機能

**Play function 例**:

```typescript
import { fn, expect, userEvent, within } from "storybook/test";

export const ClickTest: Story = {
  args: {
    onClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button"));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

---

### `Failed to fetch dynamically imported module`

**エラー**:

```
Failed to fetch dynamically imported module: http://localhost:6006/path/to/story.tsx
```

**原因**: Story ファイルまたはその依存関係のインポートに問題がある

**デバッグ手順**:

1. **コンテナログを確認**:

   ```bash
   docker logs storybook --tail 100
   ```

2. **実際のエラーを特定**: ログに詳細なエラーメッセージが表示される

   ```
   Failed to resolve import "XXXXX" from "path/to/file.tsx"
   ```

3. **依存関係を追跡**: コンポーネントの import チェーンを確認

   - Story → コンポーネント → entities/features → hooks → 外部パッケージ

4. **エイリアス/モックを追加**: 必要に応じて `main.ts` にエイリアスを追加

---

### Vite エイリアスの順序問題（CRITICAL）

**エラー**:

```
[vite:load-fallback] Could not load ./.storybook/mocks/next-intl.tsx/routing
ENOTDIR: not a directory
```

**原因**: Vite のオブジェクト形式エイリアスでは解決順序が保証されない。`next-intl` が `next-intl/routing` より先にマッチすると、`./mocks/next-intl.tsx` + `/routing` = `./mocks/next-intl.tsx/routing` を探してしまう。

**解決**: **配列形式**でエイリアスを定義し、**より具体的なパスを先に**記述する。

```typescript
// ❌ BAD: オブジェクト形式（順序が保証されない）
resolve: {
  alias: {
    'next-intl': join(__dirname, './mocks/next-intl.tsx'),
    'next-intl/routing': join(__dirname, './mocks/next-intl.tsx'),  // マッチしない可能性
  },
}

// ✅ GOOD: 配列形式（順序が保証される）
resolve: {
  alias: [
    // より具体的なパスを先に
    { find: 'next-intl/navigation', replacement: join(__dirname, './mocks/next-intl.tsx') },
    { find: 'next-intl/routing', replacement: join(__dirname, './mocks/next-intl.tsx') },
    { find: 'next-intl/server', replacement: join(__dirname, './mocks/next-intl.tsx') },
    // 一般的なパスを後に
    { find: 'next-intl', replacement: join(__dirname, './mocks/next-intl.tsx') },
  ],
}
```

**ルール**:

1. **サブパスを持つモジュール**（`next-intl/routing`, `@workspace/ui` 等）は配列形式で定義
2. **具体的なパス → 一般的なパス**の順に並べる
3. 同様のパターン: `@/shared/lib/i18n` → `@`, `@workspace/ui` → `@workspace`

---

### ワークスペースパッケージが解決できない

**エラー**:

```
Failed to resolve import "@workspace/query"
Failed to resolve import "@workspace/client-supabase/client"
```

**原因**: Storybook の Vite 設定にワークスペースエイリアスがない

**解決**: `main.ts` の `viteFinal` でエイリアスを追加

```typescript
// frontend/.storybook/main.ts
async viteFinal(config) {
  return mergeConfig(config, {
    resolve: {
      alias: {
        // Workspace packages
        '@workspace/ui': join(__dirname, '../packages/ui'),
        '@workspace/native-ui': join(__dirname, '../packages/native-ui'),
        '@workspace/tokens': join(__dirname, '../packages/tokens/src'),
        '@workspace/query': join(__dirname, '../packages/query'),
        '@workspace/client-supabase/client': join(__dirname, './mocks/workspace-client-supabase.ts'),
        // ...
      },
    },
  })
}
```

---

### TanStack Query フックがエラーになる

**エラー**:

```
No QueryClient set, use QueryClientProvider to set one
```

**原因**: TanStack Query のフックが QueryClient なしで呼び出されている

**解決**: `preview.tsx` で QueryClientProvider をグローバルデコレータとして設定

```typescript
// frontend/.storybook/preview.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <Providers>
        <Story />
      </Providers>
    ),
  ],
};
```

---

### アイコンが文字で表示される

**原因**: Google Fonts が読み込まれていないか、Material Symbols を使用している

**解決**: Lucide React に移行。`packages/ui/components/icon/icon.tsx` を確認。

---

## Server Component の扱い

**重要**: Server Component（`async` 関数）は Storybook で直接 Story 化できない。

### 対処方法

1. **子コンポーネントを個別に Story 化**

   - Server Component 内の Client Component を抽出
   - 各 Client Component に Story を作成

2. **例**: HomePage (Server) → ActiveQuestsSection (Client)

   ```typescript
   // ❌ BAD: Server Component を Story 化しようとする
   // HomePage.stories.tsx - async 関数はエラー

   // ✅ GOOD: 子の Client Component を Story 化
   // active-quests-section.stories.tsx
   ```

## ベストプラクティス

### ビルドチェック（MANDATORY）

**重要**: Story 追加・変更後は **ビルドチェックを実行する**。UI でのデバッグは非効率。

```bash
# ビルドチェック (devenv script、PATH 直結)
build-storybook
```

ビルドエラーがあれば、詳細なエラーメッセージがターミナルに表示される。

**キャッシュクリアが必要な場合**:

```bash
# devenv shell 内で
rm -rf "$DEVENV_ROOT"/frontend/node_modules/.cache/storybook "$DEVENV_ROOT"/frontend/node_modules/.vite
stop && devenv up    # 再起動して Storybook を作り直し
```

---

### レスポンシブ確認は Viewport ツールを使用

**MANDATORY**: モバイルビュー用の Story は作成しない。Storybook の Viewport ツールを使用する。

```typescript
// ❌ BAD: モバイル用 Story を作成
export const MobileView: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const TabletView: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

// ✅ GOOD: Storybook ツールバーの Viewport ボタンで切り替え
// → Story は作成しない。ユーザーが自由にビューポートを変更可能
```

**例外**: モバイル専用コンポーネント（bottom-nav 等）は**コンポーネント自体**の Story を作成する。

```typescript
// ✅ GOOD: モバイル専用コンポーネントの Story
// bottom-nav.stories.tsx
export const Default: Story = {}  // コンポーネント自体の Story

// ❌ BAD: 他コンポーネントの「モバイル表示版」Story
// app-shell.stories.tsx
export const MobileView: Story = { ... }  // これは不要
```

---

## チェックリスト

新しい Story を追加する前に確認:

### Storybook 10 準拠（CRITICAL）

- [ ] `fn()` は `storybook/test` からインポート（`import { fn } from "storybook/test"`）
- [ ] `@storybook/test` は使用していない（非推奨）
- [ ] `@storybook/addon-actions` は使用していない（非推奨）
- [ ] イベントハンドラーは `args` で `fn()` を定義（`argTypes: { onClick: { action: "clicked" } }` は使用禁止）
- [ ] Play function のユーティリティは `storybook/test` から統一インポート

### 必須

- [ ] Story の `title` が FSD 構造に準拠している
- [ ] JSX を使用するファイルで `React` をインポートしている
- [ ] Server Component ではなく Client Component を Story 化している
- [ ] MobileView / TabletView 用の Story を作成していない（Viewport ツールを使用）

### 依存関係

- [ ] 必要なワークスペースパッケージのエイリアスが `main.ts` にある
- [ ] 外部依存（Supabase, next-intl 等）のモックがある
- [ ] TanStack Query を使用する場合、`preview.tsx` に QueryClientProvider がある

### UI/スタイル

- [ ] Lucide React アイコンを使用している（Material Symbols ではない）
- [ ] TailwindCSS スタイルが適用されている
- [ ] HMR が動作している（ファイル変更で自動リロード）

### ビルドチェック

- [ ] Story 追加・変更後は `build-storybook` でビルドチェック
- [ ] 設定変更後は `cd frontend && rm -rf node_modules/.cache/storybook node_modules/.vite` でキャッシュクリア後に再起動
- [ ] 開発中のエラー確認は `frontend` のターミナルログでリアルタイム監視
