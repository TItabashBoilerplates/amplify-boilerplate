# turbo.json の `lint` / `type-check` から不要な `^build` 依存を除去

## メタ情報
- **状態**: completed
- **優先度**: medium
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
shadcn/ui 公式 next-monorepo テンプレと同じく、JIT（ソース直 export）パッケージ構成では `lint` と `type-check` が依存パッケージの `build` を待つ必要がない。`frontend/turbo.json` の `tasks.lint.dependsOn` と `tasks.type-check.dependsOn` から `^build` を取り除き、依存関係を最小化する。

## 前提（依存タスク）
- 先行タスク: `0001-rename-ui-web-to-ui.md`
- ブロッカー: なし

## 背景

公式テンプレ（`templates/next-monorepo/turbo.json`）:

```jsonc
{
  "tasks": {
    "lint":      { "dependsOn": ["^lint"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    ...
  }
}
```

JIT 構成では `packages/ui` に `build` スクリプトが存在せず、`dist/` 出力もない。`type-check` / `lint` が `^build` を待つと毎回キャッシュミスし、無駄なビルドを起こす（あるいは build スクリプト無しで no-op 終了するだけで時間を消費）。

現状の `frontend/turbo.json`:
```jsonc
"lint":       { "dependsOn": ["^build"], ... }
"type-check": { "dependsOn": ["^build", "generate"], ... }
```

`type-check` の `generate` 依存（型生成タスク）は意味があるので保持。

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|---------|
| `frontend/turbo.json` | `tasks.lint.dependsOn` から `"^build"` を削除（空配列または `"^lint"` に置換）。`tasks.type-check.dependsOn` から `"^build"` を削除し `["generate", "^type-check"]` に |

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate

# 1. 現状確認
cat frontend/turbo.json | grep -A 3 -E '"(lint|type-check)":'

# 2. 編集（手動 or node スクリプト）
node -e '
  const fs = require("fs");
  const p = "frontend/turbo.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.tasks.lint = j.tasks.lint || {};
  j.tasks.lint.dependsOn = ["^lint"];
  j.tasks.lint.inputs = j.tasks.lint.inputs || ["$TURBO_DEFAULT$", "eslint.config.*"];
  j.tasks["type-check"] = j.tasks["type-check"] || {};
  j.tasks["type-check"].dependsOn = ["^type-check", "generate"];
  j.tasks["type-check"].outputs = [];
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'

# 3. 検証: turbo dry-run でグラフ確認
cd frontend
bunx turbo run type-check --dry=json | head -50
bunx turbo run lint --dry=json | head -50
# → 各 package で ^build を待たないグラフになっていること
cd /Users/titabash/Development/shadcn-boilerplate

# 4. CI チェック
ci-check

# 5. コミット
git add frontend/turbo.json
git commit -m "perf(frontend): drop ^build dependency from lint/type-check tasks

JIT (source-export) packages have no build step. Following the shadcn
next-monorepo template, lint depends only on ^lint and type-check on
^type-check + generate. Faster iteration, no spurious cache misses."
```

## 完了条件
- [ ] `frontend/turbo.json` の `tasks.lint.dependsOn` に `"^build"` が含まれない
- [ ] `frontend/turbo.json` の `tasks.type-check.dependsOn` に `"^build"` が含まれない（`generate` と `"^type-check"` は残す）
- [ ] `cd frontend && bunx turbo run type-check --dry=json` のタスクグラフに `build` が含まれない
- [ ] `ci-check` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了
- `frontend/turbo.json` の `tasks.lint.dependsOn` を `["^build"]` → `["^lint"]` に変更
- `frontend/turbo.json` の `tasks.type-check.dependsOn` を `["^build", "generate"]` → `["^type-check", "generate"]` に変更
- `bunx turbo run type-check --dry=json` でグラフ確認: `^build` 依存ゼロ、`^type-check` + `generate` のみで構成されている
- 例: `@workspace/web#type-check` の deps は `[auth, client-supabase, eslint-config, types, ui, web#generate]` で `build` 一切なし
- shadcn 公式 next-monorepo テンプレと同等の最小依存に揃えた
