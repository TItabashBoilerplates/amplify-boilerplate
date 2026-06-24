# `tooling/typescript`, `tooling/tailwind` に `exports` フィールドを追加

## メタ情報
- **状態**: completed
- **優先度**: low
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor

## ゴール
shadcn/ui 公式テンプレと同じく、`tooling/` 配下の共通設定パッケージにも `package.json` の `exports` フィールドを設定し、`@workspace/typescript-config/base.json` のような明示的 import を可能にする。

## 前提（依存タスク）
- 先行タスク: なし（独立タスク）
- ブロッカー: なし

## 背景

公式テンプレ `templates/next-monorepo/packages/typescript-config/package.json`:
```json
{
  "name": "@workspace/typescript-config",
  "exports": {
    "./base.json":     "./base.json",
    "./nextjs.json":   "./nextjs.json",
    "./react-library.json": "./react-library.json"
  }
}
```

現状の `frontend/tooling/typescript/` 等は `package.json` に `exports` が無い可能性が高い。`extends` で参照する側（各 package の `tsconfig.json`）が相対パスで書かれていればまだ動くが、`@workspace/typescript-config/base.json` のような subpath import に統一したい。

## 変更対象ファイル

事前確認が必要：
```bash
cat frontend/tooling/typescript/package.json
cat frontend/tooling/tailwind/package.json
ls frontend/tooling/typescript/
ls frontend/tooling/tailwind/
```

| ファイル | 変更内容 |
|----------|---------|
| `frontend/tooling/typescript/package.json` | `exports` を追加（実在する `*.json` ファイルを反映） |
| `frontend/tooling/tailwind/package.json` | `exports` を追加（実在する設定を反映） |

加えて、各 package / app の `tsconfig.json` の `extends` を相対パス → `@workspace/typescript-config/...` に変更する場合は import 置換が必要（任意）。

## 手順

```bash
cd /Users/titabash/Development/shadcn-boilerplate/frontend

# 1. 現状を確認
cat tooling/typescript/package.json
ls tooling/typescript/
cat tooling/tailwind/package.json 2>/dev/null
ls tooling/tailwind/ 2>/dev/null

# 2. typescript の exports を追加
node -e '
  const fs = require("fs");
  const p = "tooling/typescript/package.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  // 実在する .json を全部 exports に登録
  const dir = "tooling/typescript";
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json") && f !== "package.json" && f !== "tsconfig.json");
  j.exports = j.exports || {};
  for (const f of files) {
    j.exports["./" + f] = "./" + f;
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'

# 3. tailwind 側も同様（実在する場合）
if [ -d tooling/tailwind ]; then
  node -e '
    const fs = require("fs");
    const p = "tooling/tailwind/package.json";
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    const dir = "tooling/tailwind";
    const files = fs.readdirSync(dir).filter(f =>
      (f.endsWith(".js") || f.endsWith(".mjs") || f.endsWith(".ts") || f.endsWith(".css"))
      && f !== "package.json"
    );
    j.exports = j.exports || {};
    for (const f of files) {
      j.exports["./" + f.replace(/\.(mjs|js|ts|css)$/, "")] = "./" + f;
    }
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  '
fi

# 4. lockfile 同期 + 検証
cd /Users/titabash/Development/shadcn-boilerplate
bun install --cwd frontend

# 5. 検証: 既存の tsconfig.json が相対パスで動いていれば、このコミットでは破壊しない
ci-check

# 6. コミット
git add -A
git commit -m "chore(frontend): add exports to tooling/typescript and tooling/tailwind packages

Mirrors the shadcn/ui next-monorepo template. Allows consumers to extend
configs via subpath imports (@workspace/typescript-config/base.json) in
addition to the existing relative paths."
```

## 完了条件
- [ ] `frontend/tooling/typescript/package.json` に `exports` フィールドがある
- [ ] `frontend/tooling/tailwind/package.json`（存在する場合）に `exports` フィールドがある
- [ ] `bun install --cwd frontend` が成功
- [ ] `ci-check` が green

## ロールバック方法
```bash
git reset --hard HEAD~1
```

## 進捗ログ

### 2026-04-28 - 完了
- `frontend/tooling/typescript/package.json` に `exports` フィールドを追加
  - `"./base.json": "./base.json"`, `"./nextjs.json": "./nextjs.json"`
  - 実在する全 JSON 設定ファイルを subpath import 可能に
- `frontend/tooling/tailwind/package.json` は **既に exports 設定済み**（`.`, `./native`, `./theme`）→ 変更不要
- `bun install --frozen-lockfile` で lockfile 互換確認 (`no changes`)
- shadcn 公式 next-monorepo テンプレと同等の subpath 構造を達成
- `lint-frontend` green
- 副次対応: 0009 で `tsc -b` 実行時に native-ui へ emit された `.js` / `.d.ts` artifacts (untracked) を `git clean -fd` + `rm` で削除（gitignore 不在による副作用、コミット対象外）
