---
name: dev-check
description: 実装完了後の開発チェック。CI チェック（lint, format, type-check）、ビルド、テストを順次実行し、全てオールグリーンになるまでエラー分析・修正を繰り返す。コード実装・修正が完了した時に使用する。
effort: max
---

# 開発チェックスキル

実装完了後に品質チェックを一括実行し、全てオールグリーンになるまでエラー修正を繰り返す。

## ワークフロー

```
Phase 1: CI Check (ci-check)
  ├─ Pass → Phase 2 へ
  └─ Fail → lint + format (自動修正) → 型エラーは手動修正 → 再実行 (最大5回)

Phase 2: Build (build-frontend)
  ├─ Pass → Phase 3 へ
  └─ Fail → エラー分析 → 修正 → 再実行 (最大5回)

Phase 3: Test (test-frontend + test-backend-py)
  ├─ Pass → 完了レポート
  └─ Fail → 実装を修正（テストは変更しない）→ 再実行 (最大5回)
```

## Phase 1: CI Check

1. `ci-check` を実行
2. 失敗した場合:
   - **lint/format エラー**: まず `lint` と `format` を実行（自動修正）
   - **型エラー**: エラー出力を読み、ソースファイルを特定して手動修正
   - 修正後、再度 `ci-check` を実行
3. パスするまで繰り返す（最大5回）

## Phase 2: Build

1. `build-frontend` を実行
2. 失敗した場合:
   - ビルドエラー出力を分析
   - ソースコードを修正
   - 修正後、再度 `build-frontend` を実行
3. パスするまで繰り返す（最大5回）

## Phase 3: Test

1. 変更したレイヤーに応じてテストを実行:
   - Frontend を変更した場合: `test-frontend`
   - Backend Python を変更した場合: `test-backend-py`
   - 両方変更した場合: 両方実行
2. 失敗した場合:
   - テスト出力を分析し、失敗原因を特定
   - **実装コードを修正する（テストファイルは絶対に変更しない）**
   - 修正後、再度テストを実行
3. パスするまで繰り返す（最大5回）

## 修正ルール

- **devenv コマンド必須**: 品質チェックは必ず devenv の scripts（`lint` / `format` / `type-check` / `unit-test` / `ci-check` 等）で実行（`make` や直接コマンドは禁止。`.claude/rules/commands.md` 参照）
- **TDD ポリシー厳守**: テスト失敗時は実装を修正、テストは変更しない
- **クリーンコード**: 修正時に未使用コード・重複コードを残さない
- **自動生成ファイル編集禁止**: `frontend/amplify_outputs.json` や `@workspace/backend` の `Schema` 型（`amplify/data/resource.ts` から生成）は手動編集しない。スキーマ変更は `amplify/` を編集して `sandbox` で再生成する

## ループ制御

- 各フェーズで最大 **5回** リトライ
- 5回で解決しない場合、エラー内容をユーザーに報告して判断を仰ぐ

## 完了レポート

全フェーズ完了後、以下の形式でサマリーを表示:

```
## Dev Check Results

| Check          | Status |
|----------------|--------|
| CI Check       | Pass   |
| Build          | Pass   |
| Test (Frontend)| Pass   |
| Test (Backend) | Pass   |

All checks passed.
```
