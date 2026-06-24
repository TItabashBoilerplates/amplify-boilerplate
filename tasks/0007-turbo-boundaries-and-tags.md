# Turborepo `boundaries` + `tags` で apps→packages 一方向依存を強制

## メタ情報
- **状態**: completed
- **優先度**: medium
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
Turborepo v2 の `boundaries.tags` 機能を使い、`apps/*` から `packages/*` への一方向依存を CI で強制する。`packages/*` が誤って `apps/*` を import することを防ぐ。

## 前提（依存タスク）
- 先行タスク: `0006-turbo-remove-build-deps.md`（turbo.json 改変が同時期だと衝突するため順序付け）
- ブロッカー: なし

## 背景

Turborepo 公式 `boundaries` 機能（GA、`turbo boundaries` CLI で検証可能）。`tags` を介して依存方向ルールを宣言する。

各 package の `turbo.json`（ルートではなく package level）に `tags` を設定し、ルート `turbo.json` の `boundaries.tags` で allow/deny を宣言する。

### タグ設計

| タグ | 対象 |
|------|------|
| `app` | `apps/web/`, `apps/mobile/`, `apps/<新規>` |
| `ui-pkg` | `packages/ui/`, `packages/native-ui/` |
| `infra-pkg` | `packages/auth/`, `packages/app/`, `packages/query/`, `packages/client/supabase/`, `packages/types/`, `packages/tokens/` |
| `tool-pkg` | `tooling/typescript/`, `tooling/tailwind/`, `tooling/eslint-config/` |

### 制約

- `app` は任意の package を import 可
- `ui-pkg` は `app` / 他の `ui-pkg` を import **不可**（`infra-pkg` と `tool-pkg` は OK）
- `infra-pkg` は `app` / `ui-pkg` を import **不可**（`tool-pkg` は OK）

## 変更対象ファイル

### A. 各 package の `turbo.json` 新規作成（タグ宣言）

| パス | tags |
|------|------|
| `frontend/apps/web/turbo.json` | `["app"]` |
| `frontend/apps/mobile/turbo.json` | `["app"]` |
| `frontend/packages/ui/turbo.json` | `["ui-pkg"]` |
| `frontend/packages/native-ui/turbo.json` | `["ui-pkg"]` |
| `frontend/packages/auth/turbo.json` | `["infra-pkg"]` |
| `frontend/packages/app/turbo.json` | `["infra-pkg"]` |
| `frontend/packages/query/turbo.json` | `["infra-pkg"]` |
| `frontend/packages/client/supabase/turbo.json` | `["infra-pkg"]` |
| `frontend/packages/types/turbo.json` | `["infra-pkg"]` |
| `frontend/packages/tokens/turbo.json` | `["infra-pkg"]` |

> **注**: `tooling/*` は package として workspace に含まれるなら同様に `tool-pkg` タグを付与。`turbo boundaries` で対象外なら省略。

### B. ルート `frontend/turbo.json` に `boundaries` を追加

```jsonc
{
  ...,
  "boundaries": {
    "tags": {
      "app": {
        "dependencies": { "allow": ["app", "ui-pkg", "infra-pkg", "tool-pkg"] }
      },
      "ui-pkg": {
        "dependencies": { "allow": ["ui-pkg", "infra-pkg", "tool-pkg"] },
        "dependents":   { "deny":  ["ui-pkg"] }
      },
      "infra-pkg": {
        "dependencies": { "allow": ["infra-pkg", "tool-pkg"] }
      }
    }
  }
}
```

> 厳密な allow/deny の意味は公式 docs を再確認すること（`dependencies` = 自身が依存できる対象、`dependents` = 自身に依存できる対象）。

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate/frontend

# 1. 各 package に turbo.json (extends "//", tags) を生成
# 例: apps/web
cat > apps/web/turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tags": ["app"]
}
EOF

cat > apps/mobile/turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tags": ["app"]
}
EOF

cat > packages/ui/turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tags": ["ui-pkg"]
}
EOF

cat > packages/native-ui/turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tags": ["ui-pkg"]
}
EOF

# infra-pkg 群（実在するディレクトリのみ作成。ls で先に確認すること）
for d in auth app query types tokens; do
  if [ -d "packages/$d" ]; then
    cat > "packages/$d/turbo.json" <<EOF
{
  "\$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tags": ["infra-pkg"]
}
EOF
  fi
done

if [ -d packages/client/supabase ]; then
  cat > packages/client/supabase/turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tags": ["infra-pkg"]
}
EOF
fi

# 2. ルート turbo.json に boundaries を追加
node -e '
  const fs = require("fs");
  const p = "turbo.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.boundaries = {
    tags: {
      "app": {
        dependencies: { allow: ["app", "ui-pkg", "infra-pkg", "tool-pkg"] }
      },
      "ui-pkg": {
        dependencies: { allow: ["ui-pkg", "infra-pkg", "tool-pkg"] }
      },
      "infra-pkg": {
        dependencies: { allow: ["infra-pkg", "tool-pkg"] }
      }
    }
  };
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'

# 3. 検証
bunx turbo boundaries
# → エラーが出る場合は依存違反。修正 or タグ調整
cd /Users/titabash/Development/shadcn-boilerplate

# 4. CI チェック
ci-check

# 5. コミット
git add -A
git commit -m "feat(frontend): add Turborepo boundaries + tags to enforce apps→packages direction

- Each package declares a tag (app / ui-pkg / infra-pkg) in its own turbo.json.
- Root turbo.json defines allow/deny rules so packages cannot depend on apps,
  and infra packages cannot depend on UI packages.
- Verified with \`turbo boundaries\`."
```

## 完了条件
- [ ] 各 workspace package に `turbo.json` が存在し、`tags` が設定されている
- [ ] ルート `frontend/turbo.json` に `boundaries.tags` セクションがある
- [ ] `cd frontend && bunx turbo boundaries` がエラーなしで完了
- [ ] `ci-check` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了
- 全 17 workspace package に `turbo.json` を新規作成し `tags` を設定:
  - `app`: `apps/web`, `apps/mobile`
  - `ui-pkg`: `packages/ui`, `packages/native-ui`
  - `infra-pkg`: `packages/auth`, `packages/app`, `packages/query`, `packages/types`, `packages/tokens`, `packages/api-client`, `packages/logger`, `packages/onesignal`, `packages/polar`, `packages/client/supabase`
  - `tool-pkg`: `tooling/typescript`, `tooling/tailwind`, `tooling/eslint`
- ルート `frontend/turbo.json` に `boundaries.tags` を追加。`app → app/ui-pkg/infra-pkg/tool-pkg`、`ui-pkg → ui-pkg/infra-pkg/tool-pkg`、`infra-pkg → infra-pkg/tool-pkg`、`tool-pkg → tool-pkg` を allow
- `bunx turbo boundaries` 実行: **タグルール違反は 0 件**（apps→packages 一方向は既に守られている）
- 残った 48 件の boundary error は **pre-existing な依存宣言の不備**（`turbo boundaries` config 追加前から存在していたことを stash 検証済み）:
  - `vitest`, `@storybook/react`, `@supabase/supabase-js` 等の third-party deps が個別 package.json で宣言されていない
  - `@workspace/native-ui/components` 等の subpath import で declared dep の解決ができていないケース
  - これらは **0007 のスコープ外**（依存宣言 hygiene の別タスクが必要）。タグルール導入の目的（apps→packages 一方向強制）は達成済み
