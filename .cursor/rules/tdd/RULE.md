---
description: "Test-Driven Development workflow requirements"
alwaysApply: true
globs: []
---
# Test-Driven Development

**MANDATORY**: すべての実装はTDDで進める。

## TDDワークフロー

1. **テストを先に書く** (Red)
2. **テスト実行 → 失敗確認**
3. **テストをコミット**
4. **実装を書く** (Green)
5. **リファクタリング** (必要に応じて)

## コマンド

devenv の **scripts** (PATH 直結) を使用する。Makefile は **deprecated**（削除済み）。

| 操作 | コマンド |
|------|---------|
| Frontend | `test-frontend` (Vitest) |
| Backend | `test-backend-py` (pytest) |
| All | `test` |
| DB (pgTAP) | `test-db` |
| E2E | `e2e` / `e2e-web` / `e2e-mobile` |

正典: `/.claude/rules/commands.md`

## 禁止事項

- テストなしでの実装
- テストを通すためのテスト修正
- 失敗確認ステップのスキップ

## TDD例外（テスト不要）

- ドキュメント (README, CLAUDE.md 等)
- 設定ファイル (config.toml, .env 等)
- 静的アセット (画像, フォント 等)
- 自動生成型定義
- **UI コンポーネント**（Storybook で品質担保）

## UI コンポーネントのテスト方針

**UI コンポーネントは単体テスト不要。代わりに Storybook を必須。**

### 単体テスト不要（Storybook 対象）

| 対象 | 場所 |
|------|------|
| shadcn/ui | `packages/ui/web/components/` |
| MagicUI | `packages/ui/web/magicui/` |
| gluestack-ui | `packages/ui/mobile/components/` |
| Shared UI | `apps/web/src/shared/ui/` |
| Entity UI | `apps/web/src/entities/*/ui/` |
| Feature UI | `apps/web/src/features/*/ui/` |
| Widget UI | `apps/web/src/widgets/*/ui/` |
| View UI | `apps/web/src/views/*/ui/` |

### 単体テスト必須（TDD 対象）

| 対象 | 場所 |
|------|------|
| ビジネスロジック | `*/model/` |
| API / データ取得 | `*/api/` |
| ユーティリティ | `*/lib/` |
| カスタムフック（ロジック） | `*/model/use*.ts` |

→ 詳細は `.cursor/rules/ui-testing/` を参照

## All Green Policy (MANDATORY)

**作業終了時は必ず全テスト通過を確認**

1. `test` script を実行
2. 失敗テストがあれば実装を修正
3. All Greenまで繰り返す

### 失敗テストへの対応

| 状況 | 対応 |
|------|------|
| 実装バグ | 実装を修正 |
| テスト環境問題 | 環境を修正し再実行 |
| 既存テストの破壊 | リグレッションを修正 |
| フレーキーテスト | 根本原因を特定し安定化 |

### 禁止

- 失敗テストを放置して終了
- `skip` / `xfail` で回避
- 失敗テストの削除
- 「後で直す」として先送り

