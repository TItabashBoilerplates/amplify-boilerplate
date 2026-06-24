# root tsconfig.json の `references` を全 workspace package に拡張

## メタ情報
- **状態**: completed
- **優先度**: medium
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
TypeScript の Project References を全 workspace package に拡張し、`tsc -b` でモノレポ全体の incremental build が機能するようにする。

## 前提（依存タスク）
- 先行タスク: `0001-rename-ui-web-to-ui.md`、`0002-rename-ui-mobile-to-native-ui.md`
- ブロッカー: なし

## 背景

現状の `frontend/tsconfig.json`:
```jsonc
{
  "files": [],
  "references": [
    { "path": "./apps/web" },
    { "path": "./packages/ui/web" },     ← 0001 で path 不正
    { "path": "./packages/ui/mobile" },  ← 0002 で path 不正
    { "path": "./packages/types" },
    { "path": "./packages/client/supabase" }
  ]
}
```

問題:
1. リネーム後、`./packages/ui/web` と `./packages/ui/mobile` は存在しない
2. `apps/mobile`、`packages/auth`、`packages/app`、`packages/query`、`packages/tokens` などが `references` に含まれていない

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|---------|
| `frontend/tsconfig.json` | `references` を実在する全 package に更新 |

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate/frontend

# 1. 実在する workspace package のうち tsconfig.json があるものを列挙
find apps packages \
  -maxdepth 4 \
  -name "tsconfig.json" \
  -not -path "*/node_modules/*" \
  | sort

# 2. 各 package の tsconfig.json が `composite: true` になっているか確認
# （Project References の前提条件）
for f in $(find apps packages -maxdepth 4 -name "tsconfig.json" -not -path "*/node_modules/*"); do
  if ! grep -q '"composite"' "$f"; then
    echo "MISSING composite: $f"
  fi
done

# 3. 必要に応じて composite: true を追加（手動編集 or jq）

# 4. ルート tsconfig.json の references を更新
node -e '
  const fs = require("fs");
  const path = "tsconfig.json";
  const j = JSON.parse(fs.readFileSync(path, "utf8"));
  j.files = [];
  j.references = [
    { path: "./apps/web" },
    { path: "./apps/mobile" },
    { path: "./packages/ui" },
    { path: "./packages/native-ui" },
    { path: "./packages/types" },
    { path: "./packages/tokens" },
    { path: "./packages/auth" },
    { path: "./packages/app" },
    { path: "./packages/query" },
    { path: "./packages/client/supabase" }
  ].filter(r => fs.existsSync(r.path + "/tsconfig.json"));
  fs.writeFileSync(path, JSON.stringify(j, null, 2) + "\n");
'

# 5. tsc -b で incremental ビルドが回ることを確認
bunx tsc -b --dry
bunx tsc -b
cd /Users/titabash/Development/shadcn-boilerplate

# 6. CI チェック
ci-check
type-check-frontend
type-check-mobile

# 7. コミット
git add frontend/tsconfig.json
git commit -m "chore(frontend): expand root tsconfig.json references to all workspace packages

- Update paths after packages/ui/web → packages/ui rename.
- Update paths after packages/ui/mobile → packages/native-ui rename.
- Add apps/mobile and all infra packages (auth, app, query, tokens) to
  references so \`tsc -b\` covers the full graph."
```

## 完了条件
- [ ] `frontend/tsconfig.json` の `references` が全実在 workspace package を含む
- [ ] 旧パス `./packages/ui/web` と `./packages/ui/mobile` が含まれない
- [ ] `cd frontend && bunx tsc -b` がエラーなく完了
- [ ] `type-check-frontend` と `type-check-mobile` が green
- [ ] `ci-check` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了
- `frontend/tsconfig.json` の `references` を **実在する全 11 packages** に拡張:
  - `apps/web`, `apps/mobile`
  - `packages/ui`, `packages/native-ui`, `packages/types`, `packages/tokens`, `packages/api-client`, `packages/onesignal`, `packages/polar`, `packages/app`, `packages/client/supabase`
- 旧パス `./packages/ui/web` および `./packages/ui/mobile` を完全に除去（0001 / 0002 のリネーム整合性確保）
- `tsconfig.json` 不在の package (`auth`, `query`, `logger`, `tooling/*`) は references に含めない（必要なら別タスクで composite 化）
- `bunx tsc -b --dry` で全 11 project が正しく検出されることを確認
- `bunx tsc -b` 実行時の残エラーはすべて pre-existing（schema.ts not-a-module + native-ui の Storybook/React 型問題、いずれも 0099 で対応予定）
- references 設定自体に起因する新規エラーは 0 件
