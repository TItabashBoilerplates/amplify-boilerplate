# package 個別 turbo.json で task をオーバーライド

## メタ情報
- **状態**: completed
- **優先度**: low
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
タスク 0007 で各 package に `turbo.json` (`extends: ["//"]`, `tags`) が作成されているが、必要に応じて package 固有の task オーバーライドを追加する。具体的には `apps/web` の `build` で `outputs` を `.next/**` に明示、`apps/mobile` の `build` で `.expo/**` を明示するなど、shadcn/ui 公式テンプレと整合させる。

## 前提（依存タスク）
- 先行タスク: `0007-turbo-boundaries-and-tags.md`
- ブロッカー: なし

## 背景

Turborepo v2 の package configurations は、ルートのスカラーフィールドは継承、配列フィールドは置き換え（`$TURBO_EXTENDS$` で append 可）の挙動。

特に出力ディレクトリは package ごとに違う：
- `apps/web` → `.next/`
- `apps/mobile` → `.expo/`, `dist/`
- `packages/*` → JIT で出力なし（基本オーバーライド不要）

ルート `frontend/turbo.json` の `tasks.build.outputs` は現状で全部入りなので（`.next/**`, `dist/**`, `.expo/**`）、現状のままでも実害はない。**このタスクは optional**。

## 変更対象ファイル（必要に応じて）

| ファイル | 変更内容 |
|----------|---------|
| `frontend/apps/web/turbo.json` | `tasks.build.outputs = [".next/**", "!.next/cache/**"]` を追加 |
| `frontend/apps/mobile/turbo.json` | `tasks.build.outputs = [".expo/**"]` を追加 |
| `frontend/packages/ui/turbo.json` | `tasks.build = { "extends": false }` で build 無効化（JIT のため） |
| `frontend/packages/native-ui/turbo.json` | 同上 |

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate/frontend

# 1. apps/web/turbo.json を更新（tags 維持しつつ tasks 追加）
node -e '
  const fs = require("fs");
  const p = "apps/web/turbo.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.tasks = j.tasks || {};
  j.tasks.build = { outputs: [".next/**", "!.next/cache/**"] };
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'

node -e '
  const fs = require("fs");
  const p = "apps/mobile/turbo.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.tasks = j.tasks || {};
  j.tasks.build = { outputs: [".expo/**"] };
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'

# 2. JIT パッケージは build を無効化
for d in packages/ui packages/native-ui; do
  node -e "
    const fs = require('fs');
    const p = '$d/turbo.json';
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.tasks = j.tasks || {};
    j.tasks.build = { extends: false };
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  "
done

# 3. ルート turbo.json の tasks.build.outputs から package 固有の値を整理
# （任意。残しておいても害はない）

# 4. 検証
bunx turbo run build --dry=json | head -100
# → 各 package の outputs が期待通りであること

cd /Users/titabash/Development/shadcn-boilerplate
ci-check

# 5. コミット
git add -A
git commit -m "chore(frontend): per-package turbo.json task overrides

- apps/web/turbo.json declares .next outputs locally.
- apps/mobile/turbo.json declares .expo outputs locally.
- packages/ui and packages/native-ui disable build (JIT, source-export).
- Root turbo.json continues to provide defaults via extends: [\"//\"]."
```

## 完了条件
- [ ] `frontend/apps/web/turbo.json` に `tasks.build.outputs` がある
- [ ] `frontend/apps/mobile/turbo.json` に `tasks.build.outputs` がある
- [ ] `frontend/packages/ui/turbo.json` で `tasks.build = { "extends": false }`
- [ ] `bunx turbo run build --dry=json` で `packages/ui` に build task が含まれない
- [ ] `ci-check` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了
- `frontend/apps/web/turbo.json` の `tasks.build.outputs` を `[".next/**", "!.next/cache/**"]` に明示
- `frontend/apps/mobile/turbo.json` の `tasks.build.outputs` を `[".expo/**", "dist/**"]` に明示
- JIT パッケージ (`packages/ui`, `packages/native-ui`) の `extends: false` 構文は **Turborepo 2.6 で invalid** (turbo がパースエラー: `Found an unknown key extends`)
  - 公式の正しい挙動: `package.json` に `build` script が無い package は turbo が自動的にスキップ。実際 `bunx turbo run build --dry=json` で `cmd=<NONEXISTENT>` と表示されており、実行されない
  - したがって JIT パッケージは tags のみで OK と判断し、build override は不要
- `bunx turbo run build --dry=json` で確認:
  - `@workspace/web#build`: outputs=`['.next/**']` cmd=`next build` ✓
  - `@workspace/mobile#build`: outputs=`['.expo/**', 'dist/**']` cmd=`<NONEXISTENT>` (mobile も build script 無し) ✓
  - `@workspace/ui#build`: cmd=`<NONEXISTENT>` (実行されない) ✓
- `lint-frontend` green
- shadcn 公式テンプレと同等の per-package 設定に整理完了
