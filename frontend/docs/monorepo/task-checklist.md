# フロントエンドモノレポ移行タスクチェックリスト

このチェックリストを使用して、移行作業の進捗を管理してください。

**所要時間合計:** 約4-5時間

---

## Phase 1: Turborepo基盤構築（30分）

### 準備作業
- [ ] 現在のブランチをバックアップ（`git checkout -b backup/before-monorepo`）
- [ ] 作業ブランチを作成（`git checkout -b feature/monorepo-migration`）
- [ ] `frontend/`ディレクトリに移動

### Turborepoインストール
- [ ] `pnpm add -D turbo @turbo/gen`を実行
- [ ] `turbo --version`でインストール確認

### 設定ファイル作成
- [ ] `frontend/turbo.json`を作成
- [ ] `turbo.json`に基本設定を記述（build, dev, lint, type-checkタスク）

### ルートpackage.json更新
- [ ] 既存の`package.json`をバックアップ（`cp package.json package.json.backup`）
- [ ] `workspaces`フィールドを追加（`["apps/*", "packages/*", "tooling/*"]`）
- [ ] `scripts`をTurborepo対応に更新（`"dev": "turbo dev"`など）
- [ ] `devDependencies`にturboを追加
- [ ] `packageManager`を`"bun@1.2.0"`に設定

### 検証
- [ ] `pnpm install`を実行
- [ ] エラーがないことを確認
- [ ] `pnpm dlx turbo --version`でバージョン表示を確認

**✅ Phase 1完了:** すべてのチェック項目が完了したら次へ

---

## Phase 2: ディレクトリ再編成（1時間）

### ディレクトリ構造作成
- [ ] `mkdir -p apps/web`
- [ ] `mkdir -p packages/{ui,types,utils,api-client}`
- [ ] `mkdir -p tooling/{eslint,typescript,tailwind}`
- [ ] `mkdir -p scripts`

### 既存ファイルのバックアップ
- [ ] `cp pnpm-lock.yaml pnpm-lock.yaml.backup`
- [ ] Gitでコミット（`git add . && git commit -m "Backup before restructure"`）

### ファイル移動（apps/webへ）
- [ ] `mv app/ apps/web/`
- [ ] `mv src/ apps/web/`
- [ ] `mv public/ apps/web/`
- [ ] `mv next.config.ts apps/web/`
- [ ] `mv next-env.d.ts apps/web/`
- [ ] `mv tsconfig.json apps/web/`
- [ ] `mv postcss.config.mjs apps/web/`
- [ ] `mv eslint.config.mjs apps/web/`
- [ ] `mv .prettierrc.yaml apps/web/`
- [ ] `mv components.json apps/web/`（存在する場合）

### apps/web/package.json作成
- [ ] `apps/web/package.json`を作成
- [ ] `name`を`"@workspace/web"`に設定
- [ ] 既存の`dependencies`をコピー
- [ ] 既存の`devDependencies`をコピー
- [ ] スクリプトを調整（`dev`, `build`, `lint`など）

### 検証
- [ ] `cd apps/web && pnpm install`
- [ ] `pnpm run dev`で開発サーバー起動
- [ ] `http://localhost:3000`にアクセスして画面表示を確認
- [ ] Ctrl+Cでサーバー停止

**✅ Phase 2完了:** すべてのチェック項目が完了したら次へ

---

## Phase 3: shadcn/ui モノレポ対応（1時間）

### packages/ui初期化
- [ ] `cd packages/ui && bun init -y`
- [ ] `packages/ui/package.json`を編集
  - [ ] `name`を`"@workspace/ui"`に設定
  - [ ] `main`と`types`を`"./components/index.ts"`に設定
  - [ ] `exports`フィールドを追加
  - [ ] `dependencies`を追加（`@radix-ui/react-slot`, `clsx`など）
  - [ ] `peerDependencies`に`react`を追加

### ディレクトリ構造作成
- [ ] `mkdir -p packages/ui/components/ui`
- [ ] `mkdir -p packages/ui/components/magicui`
- [ ] `mkdir -p packages/ui/styles`

### 既存コンポーネント移行
- [ ] `apps/web/src/shared/ui/`からshadcn/uiコンポーネントをコピー
- [ ] `cp apps/web/src/shared/ui/*.tsx packages/ui/components/ui/`
- [ ] `packages/ui/components/index.ts`を作成
- [ ] 各コンポーネントをエクスポート（`export { Button } from './ui/button'`）

### apps/webから@workspace/ui参照
- [ ] `apps/web/package.json`の`dependencies`に`"@workspace/ui": "workspace:*"`を追加
- [ ] `cd apps/web && pnpm install`

### shadcn/ui モノレポモード有効化
- [ ] `cd apps/web`
- [ ] `pnpm dlx shadcn@canary init --monorepo`を実行
- [ ] プロンプトに回答：
  - [ ] TypeScript: Yes
  - [ ] Style: New York
  - [ ] Base color: Slate
  - [ ] Global CSS: `src/app/styles/globals.css`
  - [ ] CSS variables: Yes
  - [ ] Tailwind prefix: No
  - [ ] Tailwind config: `.`
  - [ ] Components alias: `@workspace/ui/components`
  - [ ] Utils alias: `@/lib/utils`

### 検証
- [ ] `pnpm dlx shadcn@canary add button`を実行
- [ ] `packages/ui/components/ui/button.tsx`に追加されることを確認
- [ ] コンポーネントが重複していないか確認

**✅ Phase 3完了:** すべてのチェック項目が完了したら次へ

---

## Phase 4: 型定義の共有化（30分）

### packages/types初期化
- [ ] `cd packages/types && bun init -y`
- [ ] `packages/types/package.json`を編集
  - [ ] `name`を`"@workspace/types"`に設定
  - [ ] `main`と`types`を`"./src/index.ts"`に設定
  - [ ] `exports`フィールドを追加（`.`, `./database`, `./api`）
  - [ ] `dependencies`に`@supabase/supabase-js`を追加

### ディレクトリ作成
- [ ] `mkdir -p packages/types/src/api`

### 型生成スクリプト作成
- [ ] `scripts/generate-types.ts`を作成
- [ ] スクリプトに実行権限を付与（`chmod +x scripts/generate-types.ts`）
- [ ] shebang追加（`#!/usr/bin/env bun`）

### 型生成実行
- [ ] `cd frontend && pnpm run scripts/generate-types.ts`
- [ ] `packages/types/src/database.ts`が生成されることを確認

### index.tsの作成
- [ ] `packages/types/src/index.ts`を作成
- [ ] `export type { Database } from './database'`を追加
- [ ] 共通型定義を追加（`User`, `ApiResponse`など）

### apps/webから型をインポート
- [ ] `apps/web/package.json`の`dependencies`に`"@workspace/types": "workspace:*"`を追加
- [ ] `cd apps/web && pnpm install`

### 検証
- [ ] `apps/web/src/`内で`import type { Database } from '@workspace/types'`をテスト
- [ ] 型補完が効くことを確認

**✅ Phase 4完了:** すべてのチェック項目が完了したら次へ

---

## Phase 5: インポートパス更新（1時間）

### インポートパスの一括置換

#### UIコンポーネント
- [ ] VS Codeで`apps/web/src`を開く
- [ ] `Cmd+Shift+F`（検索・置換）
- [ ] 正規表現モードを有効化
- [ ] 検索: `from ['"]@/shared/ui/(.+)['"]`
- [ ] 置換: `from '@workspace/ui/components/$1'`
- [ ] 「すべて置換」を実行
- [ ] 置換結果を確認

#### 型定義
- [ ] 検索: `from ['"]@/types/supabase['"]`
- [ ] 置換: `from '@workspace/types'`
- [ ] 「すべて置換」を実行

#### ユーティリティ（将来的に共有化する場合）
- [ ] 検索: `from ['"]@/lib/utils['"]`
- [ ] 置換: `from '@workspace/utils'` または `@/lib/utils`のまま

### 手動確認が必要な箇所
- [ ] FSD layers（`entities/`, `features/`, `widgets/`, `views/`）は変更不要
- [ ] `apps/web/src/shared/`（アプリ固有のコード）は残す
- [ ] `apps/web/src/app/`（Next.js App Router）は変更不要

### tsconfig.jsonのパス設定確認
- [ ] `apps/web/tsconfig.json`の`paths`を確認
- [ ] `@workspace/*`が解決できることを確認
- [ ] 必要に応じて`baseUrl`を調整

### 検証
- [ ] `cd apps/web && pnpm run type-check`
- [ ] 型エラーがないことを確認
- [ ] `pnpm run lint`
- [ ] Lintエラーがないことを確認
- [ ] `pnpm run build`
- [ ] ビルドが成功することを確認

**✅ Phase 5完了:** すべてのチェック項目が完了したら次へ

---

## Phase 6: 検証とテスト（30分）

### クリーンビルド
- [ ] `cd frontend`
- [ ] `pnpm run clean`
- [ ] `rm -rf node_modules`
- [ ] `rm pnpm-lock.yamlb`
- [ ] `pnpm install`
- [ ] `pnpm run build`
- [ ] ビルドエラーがないことを確認

### 開発サーバー起動
- [ ] `pnpm run dev`
- [ ] `http://localhost:3000`にアクセス

### 機能確認
- [ ] ページが正常に表示される
- [ ] ナビゲーションが動作する
- [ ] UIコンポーネント（Button、Cardなど）が正しく表示される
- [ ] 多言語切り替えが動作する（next-intl）
- [ ] Supabaseとの通信が正常
- [ ] 型エラーがブラウザのコンソールに出ていない

### Turborepoキャッシュ確認
- [ ] `pnpm run build`を再実行
- [ ] キャッシュヒットのメッセージが表示される
- [ ] ビルド時間が短縮されている

### shadcn/ui コンポーネント追加テスト
- [ ] `cd apps/web`
- [ ] `pnpm dlx shadcn@canary add dialog`
- [ ] `packages/ui/components/ui/dialog.tsx`に追加される
- [ ] `apps/web`側で`import { Dialog } from '@workspace/ui/components/dialog'`が動作する

### ドキュメント確認
- [ ] `frontend/docs/monorepo/migration-plan.md`を読む
- [ ] `frontend/docs/monorepo/architecture.md`を読む
- [ ] `frontend/docs/monorepo/troubleshooting.md`を読む

**✅ Phase 6完了:** すべてのチェック項目が完了したら移行完了！

---

## 最終確認

### コミット準備
- [ ] `git status`で変更内容を確認
- [ ] 不要なファイルを`.gitignore`に追加
  - [ ] `node_modules/`
  - [ ] `.turbo/`
  - [ ] `*.log`
  - [ ] `pnpm-lock.yamlb`（既に存在）
- [ ] `git add .`
- [ ] `git commit -m "feat: migrate frontend to monorepo with Turborepo"`

### プルリクエスト作成
- [ ] `git push origin feature/monorepo-migration`
- [ ] GitHubでプルリクエストを作成
- [ ] PR説明に以下を含める：
  - [ ] 移行の目的
  - [ ] 変更内容のサマリー
  - [ ] テスト結果
  - [ ] スクリーンショット（可能であれば）

### チームへの共有
- [ ] 移行完了をチームに通知
- [ ] ドキュメントの場所を共有
- [ ] 新しいコマンドを説明（`pnpm run dev`, `pnpm run ui:add`など）

---

## ロールバック（問題発生時）

### 緊急ロールバック手順
- [ ] `cd frontend`
- [ ] `git stash`（現在の変更を一時保存）
- [ ] `git checkout main`（メインブランチに戻る）
- [ ] 動作確認

### バックアップから復元
- [ ] `cp package.json.backup package.json`
- [ ] `cp pnpm-lock.yaml.backup pnpm-lock.yamlb`
- [ ] `rm -rf apps/ packages/ tooling/ scripts/`
- [ ] `rm turbo.json`
- [ ] `pnpm install`

---

## 次のステップ（移行完了後）

### 追加機能の検討
- [ ] モバイルアプリ追加（`apps/mobile`）
- [ ] Storybook導入（`packages/ui`内）
- [ ] E2Eテスト追加（Playwright）
- [ ] CI/CDパイプラインの最適化（Turborepoキャッシュ活用）

### パフォーマンス最適化
- [ ] Turborepo Remote Cache設定（Vercel）
- [ ] ビルド並列化の確認
- [ ] 依存関係の最適化

### ドキュメント整備
- [ ] コンポーネントカタログ作成
- [ ] 型定義のドキュメント作成
- [ ] 開発ガイドライン更新

---

**🎉 おめでとうございます！モノレポ移行が完了しました！**
