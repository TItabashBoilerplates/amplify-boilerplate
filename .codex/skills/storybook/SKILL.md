---
name: storybook
description: Storybook Docker 環境でのコンポーネント開発ガイダンス。Story ファイルの作成、FSD 構成に合わせたサイドバー構造、Next.js モック、Lucide React アイコン、HMR 設定についての質問に使用。UIコンポーネントのカタログ管理の実装支援を提供。
---

# Storybook スキル

このプロジェクトは **Storybook 10 + Vite** を Docker 上で実行し、packages と apps の UI コンポーネントを一元管理しています。

## 構成

| 項目           | 場所                                |
| -------------- | ----------------------------------- |
| Storybook 設定 | `frontend/.storybook/`              |
| Docker 設定    | `docker-compose.frontend.yaml`      |
| Dockerfile     | `frontend/docker/Dockerfile`        |
| CSS            | `frontend/.storybook/storybook.css` |

## 起動方法

**MANDATORY**: Storybook は **devenv の軽量セット** に含まれており、`devenv up` で自動起動する。Makefile / docker-compose は **deprecated**（削除済み）。

```bash
# 軽量セット (Supabase + backend + storybook) を起動
devenv up

# または Storybook 単独 (devenv 外 / 必要時のみ)
nr storybook                     # devenv shell 内、`bun run storybook` と同等
```

ブラウザで `http://localhost:6006` にアクセス。devenv up の TUI 内で再起動・ログ閲覧が可能。

## Story ファイルの配置

### 対象ディレクトリ

```typescript
// frontend/.storybook/main.ts
stories: [
  // Packages
  "../packages/ui/web/**/*.stories.@(ts|tsx)",
  "../packages/ui/mobile/**/*.stories.@(ts|tsx)",
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
| packages/ui/web    | `packages/ui/web/{Component}`           | `packages/ui/web/Button`             |
| packages/ui/mobile | `packages/ui/mobile/{Component}`        | `packages/ui/mobile/Button`          |
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

## Next.js モック

### 設定済みモック

| モジュール        | モックファイル                        |
| ----------------- | ------------------------------------- |
| `next/navigation` | `.storybook/mocks/next-navigation.ts` |
| `next/link`       | `.storybook/mocks/next-link.tsx`      |
| `next/image`      | `.storybook/mocks/next-image.tsx`     |

## アイコン

**MANDATORY**: Lucide React を使用する。Material Symbols は使用しない。

```typescript
// ✅ Good: Lucide React
import { Trophy, Flag, TrendingUp } from "lucide-react";

// ❌ Bad: Material Symbols / Google Fonts
<span className="material-symbols-outlined">sports</span>;
```

アイコンマッピングは `packages/ui/web/components/icon/icon.tsx` で管理。

## Docker 設定

### docker-compose.frontend.yaml

```yaml
services:
  storybook:
    container_name: storybook
    build:
      context: ./frontend/docker
      dockerfile: Dockerfile
    ports:
      - 6006:6006
    volumes:
      - ./frontend:/app
      - storybook-node-modules:/app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true # HMR 有効化
      - WATCHPACK_POLLING=true # HMR 有効化
    tty: true
    working_dir: /app

volumes:
  storybook-node-modules:
```

## ベストプラクティス

### ビルドチェック（MANDATORY）

**重要**: Story 追加・変更後は **ビルドチェックを実行する**。UI でのデバッグは非効率。

```bash
# ビルドチェック (devenv script、PATH 直結。Docker / Makefile は使わない)
build-storybook
```

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
