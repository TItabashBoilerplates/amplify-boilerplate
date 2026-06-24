# `frontend/package.json` の workspaces から `packages/ui/*` を削除

## メタ情報
- **状態**: completed
- **優先度**: medium
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
ディレクトリフラット化後（`packages/ui/web/` と `packages/ui/mobile/` が消え、`packages/ui/` が直接 shadcn/ui パッケージになった後）、不要になった `packages/ui/*` グロブと `packages/client/*` グロブを `frontend/package.json` の `workspaces` から削除し、shadcn/ui 公式テンプレと同じ最小構成にする。

## 前提（依存タスク）
- 先行タスク: `0001-rename-ui-web-to-ui.md`、`0002-rename-ui-mobile-to-native-ui.md`
- ブロッカー: なし

## 背景

現在の `frontend/package.json`:
```json
"workspaces": [
  "apps/*",
  "packages/*",
  "packages/ui/*",      ← 0001/0002 完了後は不要
  "packages/client/*",  ← 既に packages/* に包含されており冗長
  "tooling/*"
]
```

`packages/*` が glob として `packages/ui/`、`packages/native-ui/`、`packages/client/supabase/` を含めるため、二段グロブは不要（公式テンプレも `packages/*` のみ）。

ただし `packages/client/supabase/` は `packages/*` ではマッチしない（中間に `client/` ディレクトリが挟まる）。よって：
- 案A: `packages/client/*` を残す（現在 OK な構成）
- 案B: `packages/client/supabase/` を `packages/client-supabase/` にフラット化 → 別タスク扱い

このタスクでは **案A** を採用：`packages/ui/*` だけ削除する（`packages/client/*` は配置構造が変わるため別タスク or 据え置き）。

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|---------|
| `frontend/package.json` | `workspaces` 配列から `"packages/ui/*"` を削除 |

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate

# 1. 削除前の確認
cat frontend/package.json | grep -A 10 workspaces

# 2. workspaces から packages/ui/* を削除（手動で開いて編集が安全）
# 期待結果:
# "workspaces": [
#   "apps/*",
#   "packages/*",
#   "packages/client/*",
#   "tooling/*"
# ]

# 3. lockfile 同期
bun install --cwd frontend

# 4. workspace 解決の検証
cd frontend
bun pm ls -A 2>&1 | grep -E "@workspace/(ui|native-ui)" | head -20
# → @workspace/ui と @workspace/native-ui の両方が解決できていること

# 5. 全体 CI
cd /Users/titabash/Development/shadcn-boilerplate
ci-check

# 6. コミット
git add frontend/package.json frontend/bun.lock
git commit -m "chore(frontend): remove redundant packages/ui/* glob from workspaces

After flattening packages/ui/web → packages/ui and moving mobile to
packages/native-ui, the nested packages/ui/* glob no longer matches
anything that packages/* doesn't already include."
```

## 完了条件
- [ ] `frontend/package.json` の `workspaces` に `"packages/ui/*"` が含まれない
- [ ] `bun install --cwd frontend` が成功
- [ ] `bun pm ls -A` で `@workspace/ui` と `@workspace/native-ui` が両方解決できる
- [ ] `ci-check` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了
- `frontend/package.json` の `workspaces` 配列から `"packages/ui/*"` を削除
- `bun install` 実行 → lockfile に変更なし（既に整合済み）
- `bun pm ls` で `@workspace/ui` と `@workspace/native-ui` が両方解決できることを確認
- type-check の native-ui エラーは pre-existing（task 0099 で対応予定、本タスクとは無関係）
- lint-frontend / format-frontend は green
