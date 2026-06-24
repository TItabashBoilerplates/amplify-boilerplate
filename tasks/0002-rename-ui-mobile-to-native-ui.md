# `@workspace/ui/mobile` → `@workspace/native-ui` リネーム + ディレクトリ移動

## メタ情報
- **状態**: completed
- **優先度**: high
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
npm 規格外（スコープ内に2スラッシュ）の `@workspace/ui/mobile` を **`@workspace/native-ui`** にリネームし、ディレクトリも `frontend/packages/ui/mobile/` → `frontend/packages/native-ui/` に移動する。リネームと import 置換を同一コミットで完結させる。

## 前提（依存タスク）
- 先行タスク: `0001-rename-ui-web-to-ui.md`
- ブロッカー: なし

## 変更対象ファイル

### A. ディレクトリ移動

```
frontend/packages/ui/mobile/  →  frontend/packages/native-ui/
```

これにより `frontend/packages/ui/mobile/` が消え、`frontend/packages/ui/` は完全に Web shadcn/ui 専用になる。

### B. パッケージ設定更新

| ファイル | 変更内容 |
|----------|---------|
| `frontend/packages/native-ui/package.json` | `"name": "@workspace/ui/mobile"` → `"name": "@workspace/native-ui"` |
| `frontend/packages/native-ui/tsconfig.json` | `paths.@workspace/ui/mobile/*` → `@workspace/native-ui/*` |
| `frontend/apps/mobile/package.json` | `dependencies` に `"@workspace/ui/mobile": "workspace:*"` があれば `"@workspace/native-ui": "workspace:*"` に置換 |
| `frontend/apps/mobile/tsconfig.json` | `paths` の `@workspace/ui/mobile` 関連 2 行を新パスに更新 |

### C. import 置換

```bash
# 検出
cd /Users/titabash/Development/shadcn-boilerplate/frontend
grep -rn "@workspace/ui/mobile" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.mjs" --include="*.js" \
  apps packages tooling 2>/dev/null | grep -v node_modules
```

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate/frontend

# 1. 事前スキャン
grep -rn "@workspace/ui/mobile" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.mjs" --include="*.js" \
  apps packages tooling 2>/dev/null | grep -v node_modules > /tmp/ui-mobile-refs-before.txt
cat /tmp/ui-mobile-refs-before.txt | wc -l

# 2. ディレクトリ移動
git mv packages/ui/mobile packages/native-ui

# 3. パッケージ name 更新
sed -i '' 's|"@workspace/ui/mobile"|"@workspace/native-ui"|g' packages/native-ui/package.json

# 4. native-ui/tsconfig.json paths 更新
#    "@workspace/ui/mobile/*": ["./*"]  →  "@workspace/native-ui/*": ["./*"]
sed -i '' 's|"@workspace/ui/mobile/\*"|"@workspace/native-ui/*"|g' packages/native-ui/tsconfig.json

# 5. apps/mobile/tsconfig.json paths 更新
#    "@workspace/ui/mobile":   ["../../packages/ui/mobile/components"]
#    "@workspace/ui/mobile/*": ["../../packages/ui/mobile/*"]
#    →
#    "@workspace/native-ui":   ["../../packages/native-ui/components"]
#    "@workspace/native-ui/*": ["../../packages/native-ui/*"]
sed -i '' \
  -e 's|"@workspace/ui/mobile"|"@workspace/native-ui"|g' \
  -e 's|"@workspace/ui/mobile/\*"|"@workspace/native-ui/*"|g' \
  -e 's|"\.\./\.\./packages/ui/mobile/components"|"../../packages/native-ui/components"|g' \
  -e 's|"\.\./\.\./packages/ui/mobile/\*"|"../../packages/native-ui/*"|g' \
  apps/mobile/tsconfig.json

# 6. 全 import 置換
find apps packages tooling \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.mjs" -o -name "*.js" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i '' 's|@workspace/ui/mobile|@workspace/native-ui|g' {} +

# 7. lockfile 同期
cd /Users/titabash/Development/shadcn-boilerplate
bun install --cwd frontend

# 8. 残骸チェック
grep -rn "@workspace/ui/mobile" frontend --include="*.ts" --include="*.tsx" --include="*.json" --include="*.mjs" --include="*.js" 2>/dev/null | grep -v node_modules
# → 0件
grep -rn "packages/ui/mobile" frontend --include="*.ts" --include="*.tsx" --include="*.json" --include="*.mjs" --include="*.js" 2>/dev/null | grep -v node_modules
# → 0件

# 9. CI チェック
ci-check
type-check-mobile

# 10. コミット
cd /Users/titabash/Development/shadcn-boilerplate
git add -A
git commit -m "refactor(frontend): rename @workspace/ui/mobile to @workspace/native-ui and move to packages/native-ui

- npm scope can only contain a single slash; @workspace/ui/mobile was non-conformant.
- Move the gluestack-ui package out of packages/ui to keep packages/ui shadcn-only.
- Update all imports, tsconfig paths, and apps/mobile dependencies."
```

## 完了条件
- [ ] `frontend/packages/ui/mobile/` が存在しない
- [ ] `frontend/packages/native-ui/` が存在し、中身は元の mobile 一式
- [ ] `frontend/packages/ui/` は shadcn/ui 専用（`mobile/` ディレクトリが残っていない）
- [ ] `grep -r "@workspace/ui/mobile" frontend --exclude-dir=node_modules` が 0 件
- [ ] `grep -r "packages/ui/mobile" frontend --exclude-dir=node_modules` が 0 件
- [ ] `ci-check` が green
- [ ] `type-check-mobile` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 開始
タスクを `in_progress` に変更し、リネーム作業を開始。

### 2026-04-28 - 事前スキャン
- `@workspace/ui/mobile` への参照: 16 件
- `packages/ui/mobile` パスへの参照: 3 件（うち 1 件は `tooling/tailwind/native.ts`）

### 2026-04-28 - ディレクトリ移動
`git mv frontend/packages/ui/mobile frontend/packages/native-ui` 実行。
`frontend/packages/ui/` は shadcn/ui 専用となった。

### 2026-04-28 - 設定ファイル更新
- `frontend/packages/native-ui/package.json` の `name` を `@workspace/native-ui` に変更
- `frontend/packages/native-ui/tsconfig.json` の paths を `@workspace/native-ui/*` に更新
- `frontend/apps/mobile/tsconfig.json` の paths を `@workspace/native-ui` 系に更新（参照先も `../../packages/native-ui/...` に）
- `frontend/apps/mobile/package.json` に `@workspace/native-ui: workspace:*` 依存を追加（HEAD では未記載だったが、apps/web の慣習に合わせて明示）
- `frontend/tooling/tailwind/native.ts` の content path を `../../packages/native-ui/**/*.{js,jsx,ts,tsx}` に更新
- `frontend/biome.json` の override パスを `packages/native-ui/components/gluestack-ui-provider/index.web.tsx` に更新

### 2026-04-28 - 全 import 一括置換
`find ... -exec sed` で apps/packages/tooling 配下の `*.ts/*.tsx/*.json/*.mjs/*.js` から `@workspace/ui/mobile` → `@workspace/native-ui` へ置換。

### 2026-04-28 - 残骸チェック
- `grep -rn "@workspace/ui/mobile" frontend ...` → 0 件
- `grep -rn "packages/ui/mobile" frontend ...` → 0 件

### 2026-04-28 - lockfile 同期
`bun install` 実行。新 workspace `@workspace/native-ui` を解決し、4 packages installed / 1 removed。

### 2026-04-28 - 検証
- `lint-frontend`: green（biome の override パス更新により pre-existing `noDangerouslySetInnerHtml` 例外を維持）
- `type-check-mobile`: green
- `type-check-frontend`: red（102 件、すべて pre-existing。`@workspace/native-ui` 内部の gluestack/storybook/reanimated 関連エラーで HEAD `packages/ui/mobile` 時点から存在）
- `ci-check`: red（`type-check-frontend` の pre-existing と `backend-py`/`functions` 側の pre-existing format/lint 違反による）

### 2026-04-28 - 完了
リネーム自体は成功。残る red は task 0099 系の pre-existing スコープ外として後続タスクで処理。


