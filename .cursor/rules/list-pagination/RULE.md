---
description: "Lists must be paginated from the start; with Amplify Data the only terminator is nextToken"
alwaysApply: false
globs: ["frontend/**/*.ts", "frontend/**/*.tsx"]
---
# List Pagination

**MANDATORY**: 件数が増えうる一覧は、**指示を待たずに最初からページング付きで実装**する。
UI パターンもエージェント自身が選定する。

正本: `/.claude/rules/list-pagination.md`

## Amplify Data の前提

**カーソル（`nextToken`）ページングしか無い。** 公式:「There is no API to get a total page
count」「You cannot query by `page` number」。したがって既定の UI は
**「もっと見る」/ 無限スクロール**。ページ番号・総件数・SEO が要件なら OpenSearch / Aurora /
静的生成が要る（**インフラが増えるのでユーザーに確認**）。

## 最重要: 終端判定は `nextToken` だけ

DynamoDB は `limit` 件を**読み取ってからフィルタを適用する**ため、
**フィルタ付きクエリは `limit` 未満（0 件のことすらある）を返しつつ `nextToken` を返す**。

```ts
// ❌ 空ページで打ち切る → 「データがあるのに 0 件」
if (page.items.length === 0) return undefined
// ✅
getNextPageParam: (lastPage) => lastPage.nextToken ?? undefined
```

## 規約

- `limit` を必ず明示（省略時の既定は 100）。API の `limit` はサーバー側でクランプ
- **全件ループ（`nextToken` が尽きるまで回す）は禁止**
- 並び順は `secondaryIndexes` のソートキーで決める（クライアント sort 禁止）
- `errors` を必ずチェック（Amplify Data は throw しない）
- 5 状態（初回 / 追加 / 空 / エラー / 末尾）を用意し、すべて i18n
