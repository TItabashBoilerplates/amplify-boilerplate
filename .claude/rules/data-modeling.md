---
paths: frontend/packages/backend/amplify/data/**/*.ts
---

# Data Modeling Policy（Amplify Data / AppSync + DynamoDB）

**MANDATORY**: データモデル（`a.schema`）・認可ルール・セカンダリインデックスの変更は、
**本番へのデプロイがデータ損失を伴いうる**。以下の承認ルールと設計規約に従うこと。

> Supabase/Drizzle における「マイグレーション」に相当するのがこのルール。ただし
> **Amplify Data には手書きの migration ファイルが無い**。`a.schema()` の宣言そのものが正本で、
> `ampx` が差分を CloudFormation の変更に落とす。**だから「何が破壊的か」を人間が知っている必要がある。**

---

## 1. 実行権限マトリクス

| 操作 | 対象環境 | Claude 実行 | 理由 |
|---|---|---|---|
| `sandbox` / `sandbox-once`（`ampx sandbox`） | **開発者ごとのクラウド sandbox** | **可** | 自分専用の環境。壊しても `sandbox-delete` で作り直せる |
| `sandbox-delete` | 自分の sandbox | **可** | 同上 |
| `amplify/**` の編集（schema / auth / storage / functions） | — | **可** | 反映は sandbox で確認する |
| **`main` / `develop` への push・マージ**（= Amplify Hosting が `ampx pipeline-deploy` を実行） | **ブランチ環境 / 本番** | **要承認** | **マージがデプロイのトリガー**。承認ゲートはここしかない |
| `ampx pipeline-deploy` のローカル直叩き | ブランチ環境 / 本番 | **要承認** | CI の監査ログを迂回するため緊急時のみ |
| `AMPLIFY_DESTRUCTIVE_UPDATES=true` の設定 | 任意（とくに本番） | **要承認・必ず事前にバックアップ** | **テーブル置き換え = 全データ削除**（§3） |

**Claude は `main` / `develop` に直接 push しない。** 破壊的変更を含む PR は、
**PR 説明に「どのモデルのデータが失われるか」を明記**したうえでユーザーの判断を仰ぐ。

---

## 2. 変更フロー（ローカル）

```bash
# 1. スキーマを編集
vi frontend/packages/backend/amplify/data/resource.ts

# 2. sandbox に反映（watch 中なら保存で自動再デプロイ / 単発なら sandbox-once）
sandbox

# 3. 生成された amplify_outputs.json でフロントの型が解決される
#    ※ Schema 型は resource.ts からの型推論。別途の生成コマンドは不要
#      (.claude/rules/auto-generated.md)

# 4. 型チェック・テストを通す
type-check-frontend
unit-test
```

失敗したら **`resource.ts` を直して再実行**する。`sandbox` が壊れた状態から復帰できないときは
`sandbox-delete` → `sandbox` で作り直す（sandbox のデータは捨ててよい前提で扱う）。

---

## 3. 破壊的変更（テーブル置き換え）— 本番で絶対に事故らせない

**Amplify Data は `@model`（`a.model`）ごとに DynamoDB テーブルを作る。**
モデル名の変更や、プライマリキー / セカンダリインデックスのキー構成の変更など
**テーブルの置き換えが必要になる変更は、そのテーブルの全データを失う。**

公式が明言している:

> When trying to push a schema change with one or more of these updates you will see an error
> message explaining that **you will lose ALL DATA in any table that requires replacement.**

> **Amplify currently doesn't support automatic data migration.** If the data in the original
> tables is required, then you will need to **backup the DynamoDB tables and migrate the data**
> after the destructive deployment of the new tables.

Amplify Hosting では `AMPLIFY_DESTRUCTIVE_UPDATES` 環境変数が
「schema operations that can potentially cause data loss」を許可するスイッチになっている。

### 破壊的になりやすい変更（必ず疑う）

| 変更 | リスク |
|---|---|
| **モデル名のリネーム**（`Todo` → `Task`） | 旧テーブル削除 + 新テーブル作成 = **全データ消失** |
| **プライマリキー（`identifier`）の変更** | テーブル置き換え |
| **セカンダリインデックスのキー / ソートキーの変更** | インデックス再作成（大きいテーブルでは長時間 + 一時的に検索不能） |
| フィールドの削除 | 既存項目の値は残るが GraphQL から見えなくなる（実質的なデータ消失） |
| 型の変更（`string` → `integer` 等） | 既存項目が読めなくなる |
| **必須化**（`.required()` を後付け） | 既存の null 項目が不正になる |

### 手順（本番に破壊的変更を入れるとき）

1. **本当に必要か再検討する。** 多くの場合、**新しいモデル / 新しいフィールドを足して移行する**
   （旧を残したまま二重書き → バックフィル → 旧を削除）ほうが安全で安い。
2. **DynamoDB のバックアップ**（PITR / オンデマンドバックアップ）を取る。
3. **移行スクリプト**を用意する（Amplify は自動移行しない）。
4. **PR 説明に「失われるデータ」と「移行手順」を明記**し、ユーザーの承認を得る。
5. デプロイ後、**データが移行できたことを確認**してから旧リソースを消す。

**「sandbox で動いたから本番も大丈夫」は成立しない**（sandbox は空だから壊れないだけ）。

---

## 4. 認可ルールは `data/resource.ts` にインラインで書く（RLS 相当）

**認可はアプリ層の `if` ではなく Amplify Data の `authorization` で表現する。**
これが Supabase の RLS に相当する層であり、**単一の正本**である。

```ts
const schema = a.schema({
  Post: a
    .model({
      title: a.string().required(),
      body: a.string(),
      publishedAt: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(),                                  // 所有者は CRUD
      allow.authenticated().to(['read']),             // ログイン済みは読み取り
      allow.groups(['ADMINS']),                       // 管理者は CRUD
    ]),
})
```

**MANDATORY**:

- 既定の認可モードは **`userPool`**（Cognito）。他モードを使うならモデル / 操作ごとに明示する。
- **認可を書き忘れたモデルを作らない**。`.authorization()` の無いモデルはレビューで却下する。
- **ワーカー Lambda からの書き込みは owner ではなく IAM / ロール**で許可する
  （`allow.resource(fn)`）。owner 認可を「サーバーからも使えるように」緩めない。
- **`allow.publicApiKey()` は原則使わない**。使うなら理由をコメントに書き、期限を管理する。
- 認可条件に使う属性は**インデックスのキーに含める**（絞り込みが `filter` 頼みになると
  空ページが増える。`.claude/rules/list-pagination.md` §6.2）。

---

## 5. 命名・型の規約

| 対象 | 規約 |
|---|---|
| モデル名 | **単数形の PascalCase**（`Post` / `AgentJob`）。テーブル名になるので**後から変えられない前提**で決める |
| フィールド名 | camelCase（`createdAt` / `ownerId`） |
| 日時 | **`a.datetime()`**（`AWSDateTime` = ISO 8601 / UTC）。文字列で持たない（`.claude/rules/datetime.md`） |
| ID | `a.id()`。既定の `id` を使い、独自の連番を作らない |
| enum | `a.enum([...])`。文字列リテラルの散在を避ける |
| 金額 | 整数の最小単位（`a.integer()`）。浮動小数で持たない |
| 秘匿値 | **モデルに入れない**（Amplify secrets / SSM。`.claude/rules/env-naming.md`） |

- `createdAt` / `updatedAt` は Amplify Data が自動付与する。**自分で定義しない。**
- **一覧の並び順が要るフィールドはソートキーにする**（クライアント sort は禁止）。

---

## 6. セカンダリインデックス

```ts
Item: a
  .model({ ownerId: a.id().required(), status: a.enum(['OPEN', 'CLOSED']), createdAt: a.datetime() })
  .secondaryIndexes((index) => [
    index('ownerId').sortKeys(['createdAt']).queryField('listItemsByOwner'),
  ])
  .authorization((allow) => [allow.owner()])
```

- **一覧画面を作る前にインデックスを設計する**（後付けはインデックス再作成を伴う）。
- **インデックスを増やしすぎない**（書き込みコストと容量が増える）。実際に使うクエリの分だけ。
- 追加・変更した場合は、**既存データに対してインデックスが埋まるまで結果が不完全**になりうる点を
  デプロイ手順に書く。

---

## 7. テスト

| 対象 | 要求 |
|---|---|
| モデルを読み書きする `api/` / `model/` の関数 | **単体テスト必須（TDD）**。`errors` の分岐を含む |
| 認可ルール | sandbox に対する E2E か、`amplify/**` のユニットテストで「他人のレコードが読めない」を確認する |
| スキーマ変更 | 型チェック（`type-check-frontend`）で既存の呼び出し箇所が壊れていないことを確認する |

**`errors` を握りつぶさない**（Amplify Data は throw しない。`.claude/rules/error-handling.md`）。

---

## 8. 禁止事項

```ts
// ❌ 認可ルールの無いモデル
Post: a.model({ title: a.string() })

// ❌ 認可をアプリ層の if で代替する
if (post.ownerId === currentUser.userId) { /* ... */ }   // AppSync 側で弾く

// ❌ createdAt / updatedAt を自分で定義する
// ❌ 日時を a.string() で持つ
// ❌ 秘匿値（API キー・トークン）をモデルに入れる
// ❌ 本番で AMPLIFY_DESTRUCTIVE_UPDATES=true をユーザー承認なしに設定する
// ❌ モデル名のリネームを「ただのリファクタ」として PR に混ぜる（全データ消失）
// ❌ 総件数を取るために全件 list する（.claude/rules/list-pagination.md）
```

---

## 9. 強制事項

このポリシーは**交渉の余地なし**。

- **認可ルールの無いモデル**、**本番の破壊的変更をユーザー承認なしに含む PR** はレビューで却下する。
- 破壊的変更の可能性が少しでもあるなら、**推測で進めず必ずユーザーに確認**する。
- 関連: `.claude/rules/list-pagination.md` / `auto-generated.md` / `error-handling.md` /
  `.claude/skills/amplify-gen2/references/data.md`

## 参考

- [Amplify Gen2: Customize your data model](https://docs.amplify.aws/react/build-a-backend/data/data-modeling/)
- [Amplify Gen2: Customize secondary indexes](https://docs.amplify.aws/react/build-a-backend/data/data-modeling/secondary-index/)
- [Amplify Gen2: Customize authorization rules](https://docs.amplify.aws/react/build-a-backend/data/customize-authz/)
- [Amplify Hosting: 環境変数（`AMPLIFY_DESTRUCTIVE_UPDATES`）](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Amplify: 破壊的なスキーマ更新とデータ移行](https://docs.amplify.aws/gen1/react/tools/cli/project/troubleshooting/) — 自動データ移行は行われない
