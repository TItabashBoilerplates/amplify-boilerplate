---
description: "Amplify Data schema policy: authorization rules are mandatory; destructive schema changes destroy data"
alwaysApply: false
globs: ["frontend/packages/backend/amplify/data/**/*.ts"]
---
# Data Modeling (Amplify Data / AppSync + DynamoDB)

正本: `/.claude/rules/data-modeling.md`

## 破壊的変更（最重要）

`a.model` ごとに DynamoDB テーブルができる。**モデル名のリネーム / プライマリキー・
インデックスのキー変更はテーブル置き換え = 全データ消失**。Amplify は自動移行しない。

- 本番へ入れる前に **PITR / バックアップ + 移行スクリプト**を用意し、**ユーザー承認**を得る
- `AMPLIFY_DESTRUCTIVE_UPDATES=true` はユーザー承認なしに設定しない
- 「sandbox で動いたから本番も大丈夫」は成立しない（sandbox は空だから壊れないだけ）

## 認可（RLS 相当）

```ts
Post: a.model({ /* ... */ }).authorization((allow) => [
  allow.owner(),
  allow.authenticated().to(['read']),
])
```

- **`.authorization()` の無いモデルは却下**
- アプリ層の `if` で代替しない
- ワーカー Lambda からの書き込みは `allow.resource(fn)`（owner を緩めない）

## 規約

- 日時は `a.datetime()`（`AWSDateTime` / UTC）。`createdAt` / `updatedAt` は自動付与なので定義しない
- 一覧の並び順が要るフィールドは **`secondaryIndexes` のソートキー**にする（クライアント sort 禁止）
- 秘匿値はモデルに入れない（Amplify secrets）
