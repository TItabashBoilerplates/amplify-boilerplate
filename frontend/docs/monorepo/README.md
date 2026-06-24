# フロントエンドモノレポ移行ガイド

このディレクトリには、フロントエンドを **Turborepo + Bun Workspaces** を使用したモノレポ構成に移行するための完全なドキュメントが含まれています。

---

## 📚 ドキュメント一覧

> **⚠️ 必読:** 新しいアプリを追加する前に、必ず [設計原則](./design-principles.md) を読んでください。

### 1. [設計原則](./design-principles.md) 🎯 **【重要】**

**このボイラープレートを使用する前に必読**

モノレポの正しい設計原則とよくある間違いを解説しています。

**内容:**
- パッケージ配置の判断基準
- FSDとの関係
- よくあるアンチパターン
- 共有化の正しいタイミング

👉 **新しいアプリを追加する前に必ず読んでください**

---

### 2. [新しいアプリの追加方法](./adding-apps.md) 🚀

複数アプリへの拡張手順を解説しています。

**内容:**
- 管理画面の追加方法
- モバイルアプリの追加方法
- 共有コンポーネントの判断基準
- デプロイ設定

👉 **管理画面やモバイルアプリを追加する際に参照してください**

---

### 3. [移行プラン](./migration-plan.md) 📋
**所要時間:** 約4-5時間

段階的な移行手順を6つのPhaseに分けて解説しています。

- **Phase 1:** Turborepo基盤構築（30分）
- **Phase 2:** ディレクトリ再編成（1時間）
- **Phase 3:** shadcn/ui モノレポ対応（1時間）
- **Phase 4:** 型定義の共有化（30分）
- **Phase 5:** インポートパス更新（1時間）
- **Phase 6:** 検証とテスト（30分）

👉 **まずはここから始めてください**

---

### 4. [タスクチェックリスト](./task-checklist.md) ✅

移行作業の進捗を管理するためのチェックリストです。

- すべてのPhaseごとに詳細なタスクを記載
- チェックボックス形式で進捗を管理
- 各タスクの所要時間目安
- ロールバック手順

👉 **移行作業中はこのリストを使って進捗を管理してください**

---

### 5. [アーキテクチャ設計図](./architecture.md) 🏗️

モノレポの全体構造とパッケージ依存関係を解説しています。

**内容:**
- Before/Afterのディレクトリツリー
- パッケージ依存関係グラフ
- 各パッケージの役割と責務
- インポートパスの対応表
- Turborepoタスク依存グラフ

👉 **モノレポの全体像を理解したいときに参照してください**

---

### 6. [設定ファイルガイド](./configuration-guide.md) ⚙️

各種設定ファイルの詳細を解説しています。

**対象ファイル:**
- `turbo.json` - Turborepo設定
- `package.json` - パッケージ定義
- `tsconfig.json` - TypeScript設定
- `components.json` - shadcn/ui設定
- `tailwind.config.ts` - TailwindCSS設定
- `eslint.config.mjs` - ESLint設定

👉 **設定ファイルをカスタマイズする際に参照してください**

---

### 7. [トラブルシューティング](./troubleshooting.md) 🔧

よくある問題と解決方法をまとめています。

**カテゴリ:**
- Turborepoの問題
- Bunワークスペースの問題
- shadcn/uiの問題
- TypeScriptの問題
- ビルドエラー
- パフォーマンスの問題
- 環境変数の問題

👉 **エラーが発生したときに参照してください**

---

## 🚀 クイックスタート

### 移行前の準備

1. **バックアップの作成**
   ```bash
   cd /Users/tknr/Development/shadcn-boilerplate
   git checkout -b backup/before-monorepo
   git checkout -b feature/monorepo-migration
   ```

2. **ドキュメントの確認**
   - [移行プラン](./migration-plan.md)を一読
   - [タスクチェックリスト](./task-checklist.md)を印刷またはブックマーク

3. **所要時間の確保**
   - 約4-5時間の作業時間を確保してください
   - 一度に完了させることを推奨します

---

## 📊 移行のメリット

### 1. UIコンポーネントの共有化

shadcn/ui公式モノレポサポートにより、コンポーネントを`packages/ui`で一元管理できます。

```
Before: apps/web/src/shared/ui/button.tsx
After:  packages/ui/components/ui/button.tsx
```

### 2. 型定義の一元管理

Supabase型定義を`packages/types`で管理し、全アプリで共有できます。

```typescript
import type { Database } from '@workspace/types'
```

### 3. ビルドキャッシュによる高速化

Turborepoのキャッシュにより、2回目以降のビルドが**99%高速化**します。

```
初回ビルド: 30秒
2回目以降: 0.2秒（150倍高速）
```

### 4. 将来の拡張性

モバイルアプリやドキュメントサイトを簡単に追加できます。

```
apps/
├── web/         # Next.js
├── mobile/      # React Native（追加可能）
└── docs/        # ドキュメント（追加可能）
```

---

## 🎯 推奨される読み方

### ボイラープレートを使い始める方（最優先）

1. **[設計原則](./design-principles.md)** - **【必読】** 正しい設計を理解
2. [移行プラン](./migration-plan.md) - 全体の流れを把握
3. [タスクチェックリスト](./task-checklist.md) - 作業を開始

### 新しいアプリを追加したい方

1. **[設計原則](./design-principles.md)** - **【必読】** よくある間違いを避ける
2. [新しいアプリの追加方法](./adding-apps.md) - 追加手順を確認
3. [アーキテクチャ設計図](./architecture.md) - 全体構造を理解

### 設定をカスタマイズしたい方

1. [設定ファイルガイド](./configuration-guide.md) - 各設定の詳細を確認
2. [アーキテクチャ設計図](./architecture.md) - 依存関係を確認

### エラーが発生した方

1. [トラブルシューティング](./troubleshooting.md) - エラーメッセージで検索
2. [設定ファイルガイド](./configuration-guide.md) - 設定を確認

---

## 📈 移行後のワークフロー

### 開発

```bash
cd frontend
bun run dev
```

### ビルド

```bash
bun run build
```

### shadcn/uiコンポーネント追加

```bash
bun run ui:add button
```

正しく`packages/ui/components/ui/button.tsx`に追加されます。

### 型生成

```bash
bun run generate:types
```

Supabase型が`packages/types/src/database.ts`に生成されます。

---

## 🔄 ロールバック

万が一問題が発生した場合のロールバック手順は、[移行プラン](./migration-plan.md#ロールバック手順)を参照してください。

---

## 📞 サポート

### 質問・問題報告

- **GitHub Issues**: プロジェクトのIssuesで報告
- **チーム内**: Slack/Discord等で質問

### 公式ドキュメント

- [Turborepo公式](https://turborepo.com/docs)
- [shadcn/ui Monorepo](https://ui.shadcn.com/docs/monorepo)
- [Bun Workspaces](https://bun.sh/docs/install/workspaces)

---

## 📝 ドキュメントの更新

このドキュメントは随時更新されます。新しい問題や改善提案があれば、以下の方法でお知らせください：

1. **Issue作成**: バグや問題の報告
2. **Pull Request**: ドキュメントの修正・追加
3. **ディスカッション**: 提案や質問

---

## ✨ 次のステップ

モノレポ移行が完了したら、以下の拡張を検討してください：

1. **モバイルアプリの追加**
   ```bash
   cd apps
   bunx create-expo-app mobile
   ```

2. **Storybookの導入**
   ```bash
   cd packages/ui
   bunx storybook@latest init
   ```

3. **E2Eテストの追加**
   ```bash
   cd apps/web
   bunx playwright init
   ```

4. **CI/CDの最適化**
   - Turborepo Remote Cache（Vercel）の設定
   - GitHub Actionsでの並列ビルド

---

**それでは、良いモノレポライフを！ 🎉**

質問があれば、いつでもお気軽にお知らせください。
