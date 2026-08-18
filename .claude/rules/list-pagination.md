# List Pagination Policy（一覧はページング前提で作る）

**MANDATORY / NON-NEGOTIABLE**: **件数が増えうる一覧は、開発者からの指示を待たずに最初からページング付きで実装する。**
さらに **UI パターン（もっと見る / 無限スクロール / ページ番号）は、プラットフォームとそのサービスの
利用文脈に応じてエージェント自身が選定する**。「言われなかったので全件取得にした」は不可。

「今はデータが少ないから」は理由にならない。seed データでは絶対に顕在化せず、**本番でレコードが
増えた時点で初めて壊れる**（レスポンス肥大・スキャン増大・メモリ・初期描画の遅延）。
一覧を作る時点でしか安く入れられない設計なので、後回しは禁止する。

> **Amplify Data（AppSync + DynamoDB）固有の前提**（詳細は §6）:
> **カーソル（`nextToken`）ページングしか存在しない**。公式が明記している:
> 「**There is no API to get a total page count at this time**」「**You cannot query by `page`
> number; you have to query by `nextToken`**」。
> したがって **既定の UI は「もっと見る」/ 無限スクロール**であり、**ページ番号 UI を選ぶには
> 追加の設計判断が要る**（§2.3）。Supabase/PostgreSQL のような `range()` + `count` は使えない。

---

## 0. 適用判定（一覧を書き始める前に必ず実行）

以下を順に確認する。**1 つでも「はい」ならページング必須**。

| # | 判定 |
|---|---|
| 1 | 時間の経過とともに行が増えるか？（投稿・注文・ログ・通知・メッセージ・履歴・監査） |
| 2 | ユーザー / テナント / 組織が増えると行が増えるか？ |
| 3 | 外部データ（インポート・同期・Webhook）で行が入るか？ |
| 4 | 件数の上限が**スキーマまたは仕様でハードに保証されていない**か？ |

**ページングが不要なのは、上限が構造的に保証されている場合のみ**（例: 「1 ユーザーの所属組織は最大 5」
「enum 由来の固定マスタ」）。その場合も **`limit` は必ず付け**、上限が保証される根拠をコード上の
コメントに 1 行残す。

> 既存コードで未ページングの一覧を見つけたら、担当タスクの範囲内なら直す。範囲外なら**報告する**
> （黙って放置しない）。

---

## 1. 原則: 無制限クエリの禁止（全レイヤー共通）

**取得件数の上限が無いクエリを書いてはならない。** フロント / Amplify Functions / backend-py のすべてで、
一覧取得には必ず件数制限を付ける。

```ts
// ❌ 禁止: 暗黙の既定 limit に頼り、全件取得のつもりで書く
const { data } = await getDataClient().models.Item.list()
const page = data.slice(offset, offset + 20)

// ❌ 禁止: nextToken が無くなるまで回して「全件」を作る
let all = [], token
do { const r = await client.models.Item.list({ nextToken: token }); all.push(...r.data); token = r.nextToken } while (token)

// ✅ 1 ページぶんだけ取り、次ページはトークンで辿る
const { data, nextToken, errors } = await getDataClient().models.Item.list({
  limit: PAGE_SIZE,
  nextToken: cursor ?? undefined,
})
if (errors) {
  console.error('Failed to list items:', errors)
  throw new Error(errors[0]?.message ?? 'Query failed')
}
```

- **ページングは常にサーバー（AppSync/DynamoDB）側**で行う。クライアント側 `slice` / `filter` での
  擬似ページングは禁止。
- **`limit` を明示する。** 省略時の既定は **100**（公式）。「省略＝全件」ではないが、
  意図しない件数を暗黙に受け取るのはバグの温床。
- **API の `limit` はサーバー側でクランプする**（既定 20 / 最大 100 など）。クライアントが渡した値を
  そのまま Amplify Data へ流さない。
- **ページサイズはマジックナンバーにしない**。`PAGE_SIZE` として一覧のスライス（または `shared/config`）に
  定数で置き、UI とクエリで同じ値を参照する。
- `errors` は必ずチェックする（Amplify Data は throw しない。`.claude/rules/error-handling.md`）。

---

## 2. UI パターンの選定（エージェントが自分で決める）

### 2.1 まず既定表を見る

指示が無い場合の**既定**。ここから外すときだけ理由を説明する。

| 画面の性格 | 既定パターン |
|---|---|
| Mobile（Expo / RN）のリスト全般 | **無限スクロール**（`onEndReached`）＋ 明示的な再試行 UI |
| Web の探索的なカードグリッド / ギャラリー / フィード | **「もっと見る」ボタン** |
| Web の管理画面 / データテーブル / 検索結果 | **「もっと見る」＋ URL にカーソルを載せる**（§2.3。ページ番号が要るなら §2.4） |
| チャット / タイムライン / 通知（時系列で端が最新） | **カーソルページング**＋方向付きの追加読み込み |
| SEO・共有・被リンクが要る公開一覧（記事一覧・商品一覧） | **§2.4 を読む**（DynamoDB 単体では成立しない） |
| 上限が構造的に保証された少数リスト | ページング UI 不要（`limit` は付ける） |

**迷ったら「もっと見る」を選ぶ。** 失敗コストが最も小さく（フッターに到達でき、キーボードで進められ、
後から IntersectionObserver を足せば無限スクロールに移行できる）、逆方向の移行も容易。
**そして `nextToken` の性質にそのまま乗る**（余計な設計が要らない）。

**無限スクロールを選ぶ場合の必須条件**（1 つでも満たせないなら「もっと見る」にする）:

1. その画面に**フッター（またはリスト後方の到達必須要素）が無い**こと
2. **「もっと見る」ボタンを DOM 上に残し**、IntersectionObserver での自動発火はその上乗せにすること
   （＝キーボード操作でも必ず次ページへ進める）
3. **スクロール位置の復元**（詳細へ遷移 → 戻る）が担保されていること
4. 読み込み中・末尾到達・失敗のいずれも視覚的に判別できること

### 2.2 判断軸

| 軸 | 「もっと見る」が有利 | 無限スクロールが有利 |
|---|---|---|
| ユーザーの目的 | 探す・比較する | 眺める・消費する |
| フッター（法務リンク等）がある | ✅ | ❌ 到達できない |
| キーボード / スクリーンリーダー | ✅ | △ 追加実装が必須 |
| 入力デバイスがタッチ主体 | ✅ | ✅ |
| 詳細へ遷移して戻る動線が多い | ✅（カーソルを URL に載せられる） | ❌ 位置復元が難しい |

### 2.3 URL に載せるのは「ページ番号」ではなく「カーソル」

Web で共有・戻る・リロードに耐えさせたい場合、状態は URL に置く（`useState` だけに持たない）。
ただし DynamoDB では**ページ番号を載せられない**ので、**`?cursor=<nextToken>` を載せる**。

- `nextToken` は**不透明な文字列**。中身を解釈・生成しない。
- 「前へ」は `nextToken` だけでは戻れない。**必要なら訪問済みトークンをスタックで保持**し、
  「前へ」はスタックを 1 つ pop する（URL に載せるのは現在のトークンのみ）。
- **`nextToken` は長い**。URL 長を気にする画面ではクエリではなく履歴 state に持つ判断もあり得るが、
  その場合「共有・リロードで先頭に戻る」ことを UI で許容できるか確認する。

### 2.4 ページ番号 UI / 総件数 / SEO が要件のとき（設計判断が必要）

**DynamoDB 単体では実現できない。** 「N ページ目へ飛ぶ」「全 N 件」「各ページが実 URL を持つ」は
`nextToken` では成立しない。必要な場合の選択肢は次のとおりで、**いずれも追加インフラを伴うので
実装前にユーザーへ確認する**（`.claude/rules/aws-first.md` の AWS 既定から選ぶ）。

| 要件 | AWS 既定の解 |
|---|---|
| 検索 + ページ番号 + 総件数（ファセット含む） | **OpenSearch Service / Serverless** に投影して検索側でページング |
| 強整合な OFFSET / 複雑な JOIN が本質的に必要 | **Aurora / RDS**（Amplify Data SQL） |
| 件数が構造的に小さく、総数表示だけ欲しい | 集計値を**カウンタ項目としてモデルに持つ**（一覧取得で数えない） |
| SEO 対象の公開一覧 | 静的生成（`generateStaticParams`）でページを実 URL として出す |

**「とりあえず全件取って数える」は禁止**（テーブル全体のスキャンになり、料金と遅延が線形に増える）。

### 2.5 選定理由を残す

一覧を実装したら、**PR 説明またはユーザーへの報告に 1 行**で「どのパターンを選び、なぜか」を書く。
判断が割れる要件（SEO の必要有無、ページ番号の要否など、後から変えると URL 設計ごと壊れるもの）は、
**実装前にユーザーへ確認**する。

---

## 3. 実装 — Web（「もっと見る」/ 無限スクロール）

TanStack Query v5 の `useInfiniteQuery` を使う（`@workspace/query` から import）。
v5 は **`initialPageParam` が必須**で、`getNextPageParam` が `undefined` を返すと `hasNextPage === false`。
**`nextToken` がそのまま pageParam になる**ので、カーソルを自作しない。

```ts
// entities/item/api/useItemsInfinite.ts
'use client'
import { useInfiniteQuery } from '@workspace/query'
import { getDataClient } from '@workspace/data-client'
import { itemKeys } from '../model/keys'

export const PAGE_SIZE = 20

export function useItemsInfinite() {
  return useInfiniteQuery({
    queryKey: itemKeys.list('infinite'),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, nextToken, errors } = await getDataClient().models.Item.list({
        limit: PAGE_SIZE,
        nextToken: pageParam ?? undefined,
      })
      if (errors) {
        console.error('Failed to load items page:', errors)
        throw new Error(errors[0]?.message ?? 'Query failed')
      }
      return { items: data, nextToken: nextToken ?? null }
    },
    // ⚠️ items.length で末尾判定しない。nextToken が唯一の正解（§6.1）
    getNextPageParam: (lastPage) => lastPage.nextToken ?? undefined,
  })
}
```

- **`fetchNextPage` は多重発火させない**: `hasNextPage && !isFetchingNextPage` を必ずガードする。
- 無限スクロールにするときも、**トリガーは「もっと見る」ボタンの可視化**にする:

```tsx
// ボタンは常に DOM に置き、IntersectionObserver は「自動で押す」役にすぎない
<Button ref={sentinelRef} onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
  {t('loadMore')}
</Button>
```

- 追加読み込み後は **`aria-live="polite"` で「{n} 件追加しました」を通知**するか、追加分の先頭へ
  フォーカスを移す（スクリーンリーダー利用者が増加に気づけるようにする）。
- 読み込み失敗時はリストを消さず、**末尾に再試行ボタン**を出す（自動リトライの無限ループにしない）。
- 長大なフィードでメモリが問題になる場合は `maxPages` でキャッシュ保持ページ数を制限する。

### 3.1 初期データを Server Component で取る場合

`loading.tsx` + `<Suspense>` でストリーミングする（`.claude/rules/page-navigation.md`）。
サーバー側の取得は **`runWithAmplifyServerContext` 経由のサーバークライアント**を使い、
1 ページぶんだけ取って `nextToken` を Client Component に渡す。

---

## 4. 実装 — Mobile（Expo / React Native）

- リストは必ず**仮想化されたリスト**（`FlatList` / `SectionList`。導入済みなら `FlashList`）を使う。
  `ScrollView` に `.map()` で全件流すのは禁止。
- 追加読み込みは `onEndReached` + `onEndReachedThreshold`。**`keyExtractor` 必須**。

```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  onEndReachedThreshold={0.5}
  onEndReached={() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }}
  ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
  ListEmptyComponent={<EmptyState />}
  refreshing={isRefetching}
  onRefresh={refetch}
/>
```

- **Pull-to-refresh を付ける**（モバイルでは最新化の標準操作）。
- 失敗時はフッターに再試行 UI を出す（`ListFooterComponent`）。無言で止めない。

---

## 5. リアルタイムと併用するとき

Amplify Data の `observeQuery` は**モデル全体の同期**を前提にしており、**大きなコレクションの
ページングとは併用しない**。件数が増えうる一覧では:

- 一覧本体は `list({ limit, nextToken })` + `useInfiniteQuery`
- 更新の反映は `onCreate` / `onUpdate` / `onDelete` サブスクリプションを購読し、
  **該当するクエリキーだけを更新 / invalidate** する（`.claude/rules/render-optimization.md`）

詳細は `.claude/skills/amplify-gen2/references/realtime.md`。

---

## 6. データ層の規約（Amplify Data / DynamoDB）

### 6.1 終端判定は `nextToken` だけ（最重要）

**`data.length < limit` を「末尾に到達した」と解釈してはならない。**
DynamoDB は `limit` 件を**読み取ってからフィルタを適用する**ため、
**フィルタ付きクエリは `limit` 未満（0 件のことすらある）を返しつつ `nextToken` を返す**。

```ts
// ❌ 空ページで打ち切る → 「データがあるのに 0 件」になる
if (page.items.length === 0) return undefined

// ✅ nextToken が null になるまでが終端
getNextPageParam: (lastPage) => lastPage.nextToken ?? undefined
```

UI 側も同様に、**「0 件が返った ＝ 空状態」ではない**。`nextToken` が残っているなら
「さらに読み込む」を出し続ける（あるいは自動で次ページを取りにいく）。

### 6.2 フィルタに頼らず、インデックスで絞る

`filter` は読み取り後の絞り込みなので、選択率が低いほど無駄な読み取りと空ページが増える。
**絞り込み条件が固定なら `secondaryIndexes` を定義してクエリで絞る。**

```ts
// amplify/data/resource.ts
Item: a
  .model({
    ownerId: a.id().required(),
    status: a.enum(['OPEN', 'CLOSED']),
    createdAt: a.datetime(),
    title: a.string().required(),
  })
  .secondaryIndexes((index) => [
    index('ownerId').sortKeys(['createdAt']).queryField('listItemsByOwner'),
  ])
  .authorization((allow) => [allow.owner()])
```

```ts
// 並び順はソートキーで決まる（クライアント側 sort は禁止）
const { data, nextToken, errors } = await getDataClient().models.Item.listItemsByOwner(
  { ownerId },
  { sortDirection: 'DESC', limit: PAGE_SIZE, nextToken: cursor ?? undefined },
)
```

- **取得後にクライアントで並べ替えない**。ページ間で順序が崩れる。
- 並び順を変えたいなら**ソートキーを含むインデックスを追加**する。
- `secondaryIndexes` の追加・変更は再デプロイを伴う（`.claude/rules/data-modeling.md`）。

### 6.3 総件数を取らない

**`count` に相当する API は無い**（公式: "There is no API to get a total page count at this time"）。
総数が UI 要件なら §2.4 の選択肢を検討し、**一覧取得で数えない**。

### 6.4 バックエンド API のレスポンス契約

Amplify Functions / backend-py が一覧を返すときは、**次ページの取り方をレスポンス自身が示す**こと。

```jsonc
{ "items": [/* ... */], "nextToken": "…" }      // 末尾なら null
```

- `limit` は**サーバー側でクランプ**（既定値・最大値を定数化）。
- `nextToken` は**不透明な文字列**として扱い、クライアントで組み立てさせない。
- **総件数を返すフィールドを軽々に生やさない**（数えるコストが呼び出しごとにかかる）。

### 6.5 認可

owner / groups の認可ルールは AppSync 側で適用される。**認可で落ちた項目のぶんだけページが薄くなる**
ので、§6.1 と同じ理由で `nextToken` を基準にする。認可条件に使う属性は
インデックスのキーに含める（`.claude/rules/data-modeling.md`）。

---

## 7. 必須の UI 状態

一覧には以下 5 状態をすべて用意する（どれか 1 つでも欠けたら未完成）。

| 状態 | 要件 |
|---|---|
| **初回ローディング** | 共有 `Skeleton` で実寸に近い骨格を出す（`.claude/rules/page-navigation.md`） |
| **追加ローディング** | 既存リストを消さず、末尾にインジケータ |
| **空** | 「該当なし」＋次のアクション（絞り込み解除・新規作成）。**`nextToken` が残っているうちは「空」と断定しない**（§6.1） |
| **エラー** | ログ出力＋再試行導線。フォールバックで空配列を返して成功に見せるのは禁止（`.claude/rules/error-handling.md`） |
| **末尾到達** | 「すべて表示しました」等の終端表示（無限スクロールでは特に必須） |

すべてのテキストは **next-intl**（`en.json` / `ja.json` 両方）。

---

## 8. 既存ポリシーとの関係

| 関連ルール | 効き方 |
|---|---|
| `.claude/rules/page-navigation.md` | 一覧の初期データは `loading.tsx` + `<Suspense>` でストリーミング |
| `.claude/rules/render-optimization.md` | ページ状態・クエリはスライス内に閉じる。invalidate はそのリストのキーにピンポイント |
| `.claude/rules/error-handling.md` | `errors` の握りつぶし禁止。空配列フォールバック禁止 |
| `.claude/rules/clean-code.md` | ページャ UI・`PAGE_SIZE`・カーソル受け渡しを画面ごとにコピペしない |
| `.claude/rules/data-modeling.md` | `secondaryIndexes` の設計・変更手順 |
| `.claude/rules/i18n.md` | 「もっと見る」・空・末尾・エラーの全文言を i18n |
| `.claude/rules/tdd.md` / `ui-testing.md` | `getNextPageParam`・クランプ・カーソル受け渡しは**単体テスト必須**。UI は Storybook で 5 状態を網羅 |

---

## 9. チェックリスト（一覧を追加・変更したら必ず）

| # | 確認 |
|---|---|
| 1 | §0 の適用判定を行い、ページングの要否を判断したか |
| 2 | クエリに `limit` を明示し、全件ループが無いか |
| 3 | ページングが Amplify Data 側で行われているか（クライアント `slice` でないか） |
| 4 | UI パターンを §2 の既定表に沿って選び、理由を 1 行残したか |
| 5 | **終端判定が `nextToken` になっているか**（`length < limit` で打ち切っていないか。§6.1） |
| 6 | 無限スクロールなら「もっと見る」ボタンが DOM に残り、フッターを潰していないか |
| 7 | 並び順をクライアントで sort していないか（ソートキー付きインデックスを使っているか） |
| 8 | `filter` 頼みになっていないか（固定条件は `secondaryIndexes` にしたか） |
| 9 | 総件数・ページ番号を要求していないか（要るなら §2.4 をユーザーに確認したか） |
| 10 | `errors` を必ずチェックしているか |
| 11 | 5 つの UI 状態（初回・追加・空・エラー・末尾）が揃っているか |
| 12 | `PAGE_SIZE` とページング UI が共有化されているか |
| 13 | 文言が i18n 化されているか（en / ja 両方） |
| 14 | ページングのロジックに単体テスト、UI に Storybook があるか |

---

## 10. 禁止パターン

```ts
// ❌ nextToken が尽きるまで回して全件を作る（テーブル全走査 = 料金と遅延が線形に増える）
// ❌ クライアント側で擬似ページング
const visible = allRows.slice((page - 1) * 20, page * 20)

// ❌ ページ状態を useState だけで持つ（共有・戻る・リロードで壊れる）
// ❌ data.length < limit を末尾と判定する（フィルタ付きクエリで確実に壊れる）
// ❌ 取得後にクライアントで sort してページングする（ページ間で重複・欠落する）
// ❌ 総件数のために一覧を全部数える
// ❌ 大きな一覧を observeQuery で丸ごと同期する
// ❌ クライアントの limit をそのまま Amplify Data へ流す
// ❌ 無限スクロールでフッターに到達不能にする / キーボードで次ページへ進めない
// ❌ errors を無視して data ?? [] を返し「0 件」として表示する
```

---

## 11. 強制事項

このポリシーは**交渉の余地なし**。

- 件数が増えうる一覧を**未ページングで実装した PR はレビューで却下**する。
- **`nextToken` 以外で終端を判定した実装も却下**する（本番でだけ壊れる不具合の典型）。
- 「ユーザーから指示が無かった」は理由にならない。**パターン選定はエージェントの責務**。
- 後戻りが高くつく分岐（ページ番号 / 総件数 / SEO 要件、OpenSearch・Aurora の導入）は、
  推測で進めず**ユーザーに確認**する。

## 参考

- [Amplify Gen2: Read application data（pagination）](https://docs.amplify.aws/react/build-a-backend/data/query-data/) — `limit`（既定 100）/ `nextToken` / 「総ページ数の API は無い」「page 番号で問い合わせできない」
- [Amplify Gen2: Customize secondary indexes](https://docs.amplify.aws/react/build-a-backend/data/data-modeling/secondary-index/) — `secondaryIndexes` / `sortKeys` / `queryField`
- [AWS: DynamoDB Query/Scan の Limit とフィルタ](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html) — フィルタは読み取り後に適用される
- [NN/g: Infinite Scrolling: When to Use It, When to Avoid It](https://www.nngroup.com/articles/infinite-scrolling-tips/)
- [TanStack Query v5: Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- `.claude/skills/amplify-gen2/references/data.md` / `references/realtime.md` / `.claude/skills/tanstack-query/`
