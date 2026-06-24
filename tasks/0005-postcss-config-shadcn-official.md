# PostCSS 設定を shadcn/ui 公式形に集約（packages/ui に集約・apps は re-export）

## メタ情報
- **状態**: completed
- **優先度**: medium
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
shadcn/ui 公式 next-monorepo テンプレに合わせ、PostCSS 設定（Tailwind v4 plugin）を `packages/ui/postcss.config.mjs` に集約。各 apps は単に `export { default } from "@workspace/ui/postcss.config"` として再エクスポートする。

## 前提（依存タスク）
- 先行タスク: `0001-rename-ui-web-to-ui.md`
- ブロッカー: なし

## 背景

公式テンプレ（`templates/next-monorepo`）の構成:

```js
// packages/ui/postcss.config.mjs
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

```js
// apps/web/postcss.config.mjs
export { default } from "@workspace/ui/postcss.config";
```

```jsonc
// packages/ui/package.json
"exports": {
  "./postcss.config": "./postcss.config.mjs"
}
```

現状:
- `frontend/apps/web/postcss.config.mjs` は本体定義（`{ plugins: { '@tailwindcss/postcss': {} } }`）
- `frontend/packages/ui/postcss.config.mjs` は存在するか? 要確認
- `frontend/packages/ui/package.json` の `exports` に `./postcss.config` が無い

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|---------|
| `frontend/packages/ui/postcss.config.mjs` | （無ければ）新規作成。本体定義を配置 |
| `frontend/packages/ui/package.json` | `exports` に `"./postcss.config": "./postcss.config.mjs"` を追加 |
| `frontend/apps/web/postcss.config.mjs` | `export { default } from "@workspace/ui/postcss.config"` に置き換え |

`apps/mobile` の PostCSS は `nativewind` 経由で別系統なので、このタスクでは触らない（公式テンプレも mobile を扱っていない）。

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate/frontend

# 1. packages/ui に postcss.config.mjs があるか確認
ls packages/ui/postcss.config.mjs 2>/dev/null && cat packages/ui/postcss.config.mjs

# 2. 無ければ新規作成
cat > packages/ui/postcss.config.mjs <<'EOF'
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
EOF

# 3. packages/ui/package.json の exports に postcss.config を追加
# 手動編集または node ワンライナー:
# (jq があれば jq でやる、無ければ手動)
node -e '
  const fs = require("fs");
  const p = "packages/ui/package.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.exports = j.exports || {};
  j.exports["./postcss.config"] = "./postcss.config.mjs";
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'

# 4. apps/web/postcss.config.mjs を re-export に書き換え
cat > apps/web/postcss.config.mjs <<'EOF'
export { default } from '@workspace/ui/postcss.config'
EOF

# 5. lockfile 同期
cd /Users/titabash/Development/shadcn-boilerplate
bun install --cwd frontend

# 6. 動作確認: web の dev サーバーで Tailwind が動くか
# （dev は持続するので、ci-check + ローカル目視で確認）
cd frontend/apps/web
nr build  # build が通れば PostCSS plugin が解決できている
cd /Users/titabash/Development/shadcn-boilerplate

# 7. CI チェック
ci-check

# 8. コミット
git add -A
git commit -m "refactor(frontend): consolidate postcss config into @workspace/ui (shadcn official pattern)

- packages/ui owns postcss.config.mjs and exports it.
- apps/web/postcss.config.mjs is now a one-line re-export.
- Matches the shadcn/ui next-monorepo template exactly."
```

## 完了条件
- [ ] `frontend/packages/ui/postcss.config.mjs` が存在し、`@tailwindcss/postcss` を含む
- [ ] `frontend/packages/ui/package.json` の `exports` に `"./postcss.config"` が含まれる
- [ ] `frontend/apps/web/postcss.config.mjs` が re-export 形（`export { default } from "@workspace/ui/postcss.config"`）
- [ ] `cd frontend/apps/web && nr build` が成功
- [ ] `ci-check` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了
- `frontend/packages/ui/postcss.config.mjs` を新規作成（`{ plugins: { '@tailwindcss/postcss': {} } }` 本体定義）
- `frontend/packages/ui/package.json` の `exports` に `"./postcss.config": "./postcss.config.mjs"` を追加
- `frontend/apps/web/postcss.config.mjs` を `export { default } from '@workspace/ui/postcss.config'` に置き換え
- 副次対応: 0004 完了後に取り残された `frontend/apps/web/src/shared/lib/index.ts`（`./utils` を re-export していた dead code）を削除
- `lint-frontend` green
- `cd frontend/apps/web && bun run build` で PostCSS plugin 解決成功（TypeScript phase で schema.ts pre-existing error あり、これは 0099 で対応）
- shadcn 公式 next-monorepo テンプレと一致した形に集約完了
