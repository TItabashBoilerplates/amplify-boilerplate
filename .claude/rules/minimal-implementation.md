# Minimal Implementation Policy（最小実装の原則 / Write Less Code）

**CRITICAL / NON-NEGOTIABLE**: **優秀なエンジニアが書くコードは少ない。** 本リポジトリの実装は
**「自分たちが書いて保守するコードの総量を最小化する」**ことを基本理念とする。

書かなかったコードはバグらず、レビューされず、テストも要らず、壊れない。逆に**書いた瞬間から
そのコードは資産ではなく負債**になる（保守・追従・移行のコストが恒久的に発生する）。したがって
実装の良し悪しは「どれだけ作ったか」ではなく **「どれだけ作らずに要件を満たしたか」** で評価する。

ただしこれは **「行数を削る」ことではない**。1 行に詰め込んだトリッキーなコード、型を潰した近道、
テスト・エラーハンドリング・i18n の省略は**削減ではなく品質の毀損**であり、本ポリシー違反である
（§7 の禁止事項）。減らすのは**実装の総量**であって、可読性・保守性ではない。

---

## 1. 実装前の意思決定順序（Reuse → Platform → Managed → OSS → Scratch）

新しい機能に着手したら、コードを書く前に**必ず上から順に**評価する。**上位で解決できるものを
下位（スクラッチ）で実装した実装はレビューで却下**する。

| # | 選択肢 | 確認すること |
|---|--------|-------------|
| **1** | **リポジトリ内に既にあるものを使う** | `frontend/packages/*`（`@workspace/ui` / `native-ui` / `query` / `auth` / `data-client` / `backend-core` / `logger` / `types` / `api-client` …）、アプリ内の `shared/` `entities/`、`backend-py/packages/core`。**まず grep する** |
| **2** | **プラットフォーム / フレームワークの標準機能で済ませる** | Web 標準・言語標準（`Intl` / `URL` / `crypto.randomUUID` / `structuredClone` / `AbortController` / `Temporal` 系検討時は要調査）、React 19・Next.js 16 の標準機能（Server Components / Server Actions / `loading.tsx` / `error.tsx` / `next/image` / `next/font`）、Amplify Data 側の機能（`a.schema` の型・必須制約・`authorization` ルール・セカンダリインデックス・AppSync サブスクリプション） |
| **3** | **マネージドサービスに寄せる**（§4） | AWS（Cognito / Amplify Data(AppSync+DynamoDB) / S3 / Lambda / SES / SNS・Pinpoint / Bedrock / SQS / EventBridge / Step Functions / CloudWatch / Amplify Hosting / SSM）、EAS。**AWS 外は `.claude/rules/aws-first.md` の例外条件を満たすときだけ**（現状は決済の Polar のみ） |
| **4** | **実績のある OSS ライブラリを使う**（§3 の選定基準を満たすもののみ） | 既に本リポジトリが採用済みの領域なら**新規追加せず既存を使う** |
| **5** | **スクラッチで書く** | 上の 1〜4 が**いずれも該当しないと確認できた場合のみ** |

> **重要**: 4 の「ライブラリを足す」は無条件に善ではない。**依存を 1 つ増やすことも、保守対象を
> 1 つ増やすこと**である（バージョン追従・脆弱性対応・破壊的変更の移行が発生する）。
> **既に採用済みの技術で書ける**なら、それが最小実装である。

### スクラッチが正しい場合（＝依存を足すべきでない場合）

以下は**自分で書いたほうが総量が小さい**。安易にライブラリを足さない。

- **数行〜数十行で書ける trivial な処理**（配列操作・文字列整形・単純な型ガード）。標準 API で書ける
- **プロダクト固有のドメインロジック**（差別化要因そのもの。汎用ライブラリは存在しない）
- 依存のコスト（bundle size / native module / peer dep 地獄 / ライセンス）が便益に見合わない
- 候補ライブラリが §3 の選定基準を満たさない

### 逆に、絶対にスクラッチしないもの

**壊れたときの被害が大きく、正しく実装するのが難しい領域は自作しない。**

| 領域 | 使うもの | 自作禁止の理由 |
|---|---|---|
| 暗号・ハッシュ・トークン検証 | プラットフォーム / 標準ライブラリ（`SubtleCrypto` 等） | 自作暗号は必ず壊れる |
| 認証・セッション・OAuth フロー | **Amplify Auth / Cognito**（`aws-amplify/auth`） | セッション管理・パスワード保管・トークン更新を自前実装しない（`.claude/rules/auth.md`） |
| 認可（レコード単位） | **Amplify Data の `authorization`**（`allow.owner()` / `allow.groups()`） | アプリ層の `if` で代替しない（RLS に相当する層） |
| 決済・課金・サブスク | Stripe / RevenueCat / Adapty | 金銭事故・各ストアの規約 |
| 日時・タイムゾーン・通貨・単複数形 | `Intl` / 既存規約（`.claude/rules/datetime.md`） | DST・ロケールの罠 |
| メール配信・到達性 | **Amazon SES** | SPF/DKIM/DMARC・バウンス処理 |
| プッシュ通知 | **Pinpoint / AWS End User Messaging** | 各 PF のトークン管理 |
| シークレット管理 | **Amplify secrets（SSM Parameter Store）** | 平文流出 |

---

## 2. 共通化の判断（過剰な共通化も「無駄な実装」である）

**共通化はコードを減らすための手段であって、目的ではない。** 抽象化レイヤーを増やして総行数が
増えたなら、それは失敗である。

### 2.1 判断基準

| 状況 | 判断 |
|---|---|
| 1 回目 | そのまま書く |
| 2 回目 | **コピーを許容してよい**（重複の形が見えるまで抽象化しない） |
| 3 回目 | **共通化する**（Rule of Three） |
| **不整合が事故になるもの**（スタイル定数・クエリキー・`PAGE_SIZE`・単価表・バリデーション規則・API 契約） | **2 回目で即共通化**。`textareaClass` を 6 ファイルへコピペして全部が iOS でオートズームした実績がある（`.claude/rules/clean-code.md`） |

> **誤った抽象化は重複より高くつく**（Sandi Metz: *"duplication is far cheaper than the wrong
> abstraction"*）。共通化の形が読めないうちは、**重複を残したまま待つ**のが正解。
> 逆に、既に 3 箇所以上に散っているものを放置するのは本ポリシー違反。

### 2.2 共通化の配置（FSD / monorepo を壊さない）

| 使う範囲 | 置き場所 |
|---|---|
| 複数アプリ（web / mobile / lp …）で共通 | `frontend/packages/*`（`@workspace/*`） |
| 複数サービス（backend-py の app 横断） | `backend-py/packages/core` |
| Amplify Functions 横断 | `frontend/packages/backend-core`（`@workspace/backend-core`） |
| 1 アプリ内で横断 | そのアプリの `shared/` レイヤー |
| 複数 feature が扱う業務エンティティ | `entities/<name>/` |
| 1 feature 内だけ | その feature の `model/` または `lib/` |

**共通化のためにアーキテクチャを壊すのは禁止**（削減の名を借りた保守性の破壊）:

- ❌ 下位レイヤーから上位レイヤーを import する（FSD の依存方向違反）
- ❌ feature 間の直接 import（必要なら `entities/` へ引き下げるか、公式の `@x` パターンを使う）
- ❌ 公開 API（`index.ts`）を経由しない深い import
- ❌ 「共通だから」と `shared/` に業務ロジックを詰め込んで神モジュール化する
- ❌ packages を跨いだ循環依存

**共通化できない = 配置が間違っているサイン**。無理やり共通化する前に、正しいレイヤーへ
切り出せないかを検討する（`.claude/skills/fsd/` / `feature-sliced-design` Skill）。

### 2.3 共通化の成否は「総行数」で検証する

抽象化を入れたら、**呼び出し側の削減行数 > 抽象化レイヤーの追加行数** になっているか確認する。
なっていなければ、その抽象化は不要である。

---

## 3. ライブラリ選定基準（MANDATORY）

**依存を追加する前に、以下をすべて確認する。** 1 つでも満たさないものは採用しない
（どうしても必要ならユーザーに判断をあおぐ）。

### 3.1 必須条件

| # | 条件 | 確認方法 |
|---|---|---|
| 1 | **メンテされている** — archived / deprecated でない。直近の活動がある | GitHub の最終コミット・リリース、`pnpm info <pkg>`。**OpenSSF Scorecard の `Maintained` は「直近 90 日に週 1 コミット以上」で満点**（archived は最低点）。目安としてこれを使う |
| 2 | **実利用の実績がある** — 週次ダウンロード数・依存元の数 | npm registry / [deps.dev](https://deps.dev)（依存グラフ・被依存） |
| 3 | **未修正の既知脆弱性が無い** | `pnpm audit`、[OSV](https://osv.dev)、deps.dev（Scorecard の `Vulnerabilities` は OSV を参照） |
| 4 | **ライセンスが商用利用に耐える** — MIT / Apache-2.0 / BSD / ISC | LICENSE ファイル・deps.dev。**AGPL / SSPL / BUSL / 独自 source-available は必ずユーザー確認** |
| 5 | **型が付いている** — TS 本体同梱 or 公式 `@types`、Python は `py.typed` | パッケージの中身 |
| 6 | **ドキュメントとリリースノートがある** — 破壊的変更の移行手順が示される | 公式サイト / CHANGELOG / migration guide |
| 7 | **依存が浅い** — transitive dependency が過大でない | `pnpm why <pkg>` / `uv tree` / deps.dev |

### 3.2 GitHub star の扱い（重要）

star は**補助シグナルであり、単独の判断根拠にしてはならない**。star は購入可能で、
CMU / NC State / Socket の研究（ICSE 2026）は **約 600 万件の fake star 疑い**を報告している。

- ✅ star が少ない（数百未満）→ **採用を見送る理由になる**（ユーザー要望どおり）
- ❌ star が多い → **採用の根拠にはならない**。必ず §3.1 の 1〜7 で裏を取る

### 3.3 採用を見送るサイン

- 最終コミット・最終リリースが 1 年以上前で、issue / PR が未応答のまま積み上がっている
- README 以外のドキュメントが無い / テストが無い / CI が無い
- 個人の実験リポジトリ（`v0.x` のまま破壊的変更を繰り返し、移行手順も無い）
- 公式（フレームワーク側）が別のものを推奨している、または標準機能に取り込まれている
- 同じ役割のものを本リポジトリが既に採用している（**重複依存はコード削減ではなく増加**）

### 3.4 既に技術選定が済んでいる領域には別ライブラリを持ち込まない

| 領域 | 本リポジトリの採用 |
|---|---|
| UI（Web） | shadcn/ui + Radix + TailwindCSS 4（`@workspace/ui`） |
| UI（Mobile） | gluestack-ui + NativeWind（`@workspace/native-ui`） |
| サーバーステート | TanStack Query（`@workspace/query`） |
| グローバルステート | Zustand |
| i18n | next-intl |
| データモデル / 認可 | Amplify Data（`a.schema` / `authorization`） |
| データクライアント | `@workspace/data-client`（`generateClient<Schema>()`） |
| API クライアント生成 | Hey API（`@workspace/api-client`） |
| ログ | `@workspace/logger` |
| 認証 | Amplify Auth（Cognito） |

ここへ別ライブラリ（別の UI キット・別のデータ取得ライブラリ・別の ORM 等）を追加する提案は、
**それ自体が実装量の増加**である。必要と考える場合は実装前にユーザーへ確認する。

### 3.5 調査は必ずファクトで（research-first と接続）

選定は記憶ではなく**一次情報**で行う（`.claude/rules/research.md`）。

```bash
pnpm info <pkg>         # registry メタデータ（バージョン・依存・リポジトリ）
pnpm outdated           # 更新可能な依存の一覧
pnpm why <pkg>          # なぜその依存が入っているか
pnpm audit              # 既知脆弱性
uv tree                 # Python 側の依存ツリー
```

- **Context7 MCP** で最新の公式ドキュメント／API を確認する
- OpenSSF Scorecard: `https://scorecard.dev/viewer/?uri=github.com/<owner>/<repo>`
- 依存・脆弱性・ライセンス・Scorecard の横断確認: `https://deps.dev`
- 技術選定の調査は `spec` サブエージェントを使い、結果を `docs/_research/` に残す

---

## 4. マネージドサービス優先（作らずに買う）

**「作れる」ことは「作るべき」ことを意味しない。** インフラ的関心事は原則マネージドに寄せる。

| やりたいこと | 使うもの | 自前実装しないもの |
|---|---|---|
| 認証・ユーザー管理 | Amplify Auth（Cognito） | セッションストア・パスワードハッシュ・OAuth ダンス・メール確認フロー |
| データ取得 / 権限 | Amplify Data（AppSync + DynamoDB）+ `authorization` | CRUD 専用の API 層（`.claude/rules/backend-architecture.md`） |
| ファイル | Amplify Storage（S3・非公開 + `getUrl()`） | 独自アップロード API・独自署名 |
| リアルタイム | Amplify Data のサブスクリプション（AppSync） | WebSocket サーバの自前運用 |
| メール | Amazon SES | SMTP 運用・到達性チューニングの自作 |
| 決済 / サブスク | Polar（Web） / RevenueCat・Adapty（モバイル） | 課金状態の自前管理 |
| プッシュ通知 | Pinpoint / AWS End User Messaging | デバイストークン管理 |
| 生成 AI | Amazon Bedrock（LangChain 経由） | 推論基盤・GPU 運用 |
| 監視 / エラー | CloudWatch / X-Ray | 独自エラー収集基盤 |
| シークレット | Amplify secrets（SSM Parameter Store） | 独自暗号化 env |
| デプロイ / 配信 | Amplify Hosting（`amplify.yml`）/ EAS | 独自 CI デプロイスクリプトの再発明 |

バックエンド処理そのものも同じ判断順（**Amplify Data → Node `defineFunction`（TS）→ backend-py**）に従う
（`.claude/rules/backend-architecture.md`）。`backend-py` は LLM / エージェント / 長時間処理 /
Python 固有ライブラリのいずれかに該当する場合のみ。

---

## 5. 公式ベストプラクティスに乗る（逸脱はコストを自前で払うこと）

**フレームワーク / サービスが用意した「推奨の道」から外れるほど、自前コードは増える。**
実装前に**公式が何を推奨しているか**を確認し、原則それに従う。

### 5.1 情報源の優先順位

1. **公式ドキュメント**（該当バージョンのもの）
2. 公式ブログ / リリースノート / RFC / migration guide
3. 公式リポジトリのコード・型定義・examples
4. メンテナの一次発言（issue / discussion）
5. 第三者記事・ブログ（**単独の根拠にしない**。必ず 1〜4 で裏を取る）

### 5.2 やること

- **該当 Skill を最初に起動する**（`.claude/rules/skills-first.md`）。Skill は公式ベストプラクティスの取り込み口
- 公式の **CLI / codemod / スキャフォールド**を使う（`shadcn` の追加、`ampx generate outputs` / `ampx generate graphql-client-code`、公式アップグレード codemod 等）。**手書きで再現しない**
- 公式の推奨構成（Next.js App Router の規約、React 19 の Server Components、Amplify Data の `authorization` ルール、Amplify Gen2 の `define*` 構成、FSD のレイヤー）に沿う
- 公式が非推奨にした API・パターンを使わない（バージョンごとに確認する）
- **やむを得ず逸脱する場合は、理由と一次情報の根拠をコード comment か PR 説明に残す**

---

## 6. 実装前・PR 前チェックリスト

| # | 確認 |
|---|---|
| 1 | 同等の実装がリポジトリ内に無いか **実際に検索した**か（`packages/` / `shared/` / `entities/`） |
| 2 | フレームワーク標準・プラットフォーム機能・DB 機能で消せる部分は無いか |
| 3 | マネージドサービスに寄せられないか（§4） |
| 4 | 追加した依存は §3.1 の 1〜7 を満たすか。**何で確認したか言えるか** |
| 5 | 既存採用ライブラリと役割が重複していないか（§3.4） |
| 6 | 「無くても成立する」コードを書いていないか（将来用の分岐・未使用オプション・過剰な設定項目・使われない抽象レイヤー = YAGNI） |
| 7 | 抽象化を入れたなら、**総行数は減った**か（§2.3） |
| 8 | FSD の依存方向・公開 API・monorepo の境界を壊していないか |
| 9 | ライセンスを確認したか（AGPL / SSPL / BUSL 等はユーザー確認） |
| 10 | 公式の推奨手順を確認したうえで実装したか。逸脱するなら理由を残したか |

---

## 7. 禁止パターン

### 7.1 再発明（既にあるものを自作する）

```ts
// ❌ 自前のデータ取得キャッシュ／リトライ機構 → TanStack Query (@workspace/query) がある
// ❌ 自前の fetch ラッパで型を手書き        → Hey API 生成クライアント (@workspace/api-client) がある
// ❌ 自前の Button / Dialog / Select        → @workspace/ui (shadcn/Radix) がある
// ❌ 自前の日付フォーマッタ                 → Intl + .claude/rules/datetime.md
// ❌ 自前のロガー                           → @workspace/logger
// ❌ CRUD だけの API エンドポイント          → Amplify Data + authorization（backend-architecture）
// ❌ 認証・セッションの自前実装              → Amplify Auth（Cognito）
```

### 7.2 早すぎる抽象化・過剰実装（YAGNI）

```ts
// ❌ 1 箇所でしか使わないのに「将来のため」に汎用化する
export function createGenericResourceManager<T, K extends keyof T>(...) { /* 200 行 */ }

// ❌ 呼び出し側が誰も渡さないオプションを生やす
export function formatPrice(v: number, opts?: { currency?: string; locale?: string; compact?: boolean;
  roundingMode?: 'up' | 'down' | 'half'; showSymbol?: boolean }) {}

// ❌ 実装が 1 つしか無いのに interface + factory + DI コンテナを用意する
// ❌ 使う予定のない設定項目・feature flag・拡張ポイントを先に作る
```

### 7.3 依存の追加ミス

```bash
# ❌ star 数だけを見て採用する / 逆に「有名だから」で §3.1 の確認を飛ばす
# ❌ archived・deprecated・最終リリースが古く issue 未応答のパッケージを採用する
# ❌ 既に採用済みの領域へ役割が重複するライブラリを足す（UI キット 2 つ、状態管理 2 つ）
# ❌ ライセンス未確認のまま追加する（AGPL / SSPL / BUSL を無確認で入れる）
# ❌ 数行で書ける処理のために依存を 1 つ増やす
```

### 7.4 「コード削減」を口実にした品質の毀損（本ポリシー違反）

```ts
// ❌ 短く書くために FSD のレイヤー・公開 API を無視して深い import する
// ❌ 型を any / as で潰して行数を減らす
// ❌ catch を省略・空にする（error-handling.md 違反）
// ❌ テストを書かない（tdd.md 違反）
// ❌ 文言をハードコードする（i18n.md 違反）
// ❌ ページングを省く（list-pagination.md 違反）
// ❌ 可読性を犠牲にしたワンライナー化
```

**「少ないコード」とは「自分たちが書いて保守するコードが少ない」ことであり、
品質ゲートを飛ばすことではない。**

---

## 8. 既存ポリシーとの関係

| 関連ルール | 効き方 |
|---|---|
| `.claude/rules/skills-first.md` | 実装前に Skill を起動 → 公式ベストプラクティスを取り込む（§5） |
| `.claude/rules/research.md` | ライブラリ選定・公式手順の確認は一次情報で（§3.5 / §5.1） |
| `.claude/rules/clean-code.md` | 重複・未使用・後方互換コードを残さない（§2 と表裏） |
| `.claude/rules/aws-first.md` / `backend-architecture.md` | AWS 既定サービス優先 / Amplify Data → TS Function → backend-py の判断順（§1 / §4） |
| `.claude/rules/frontend.md` / `.claude/skills/fsd/` | 共通化の配置と依存方向（§2.2） |
| `.claude/skills/monorepo/` | `packages/` への切り出し境界（§2.2） |
| `.claude/rules/error-handling.md` / `tdd.md` / `i18n.md` / `list-pagination.md` | 削ってはいけない品質ゲート（§7.4） |

---

## 9. 強制事項

このポリシーは**交渉の余地なし**。

- **上位の選択肢（既存資産 → 標準機能 → マネージド → 実績ある OSS）で解決できるものを
  スクラッチ実装した PR はレビューで却下**する。
- **§3.1 の確認を経ていない依存追加は却下**する。star 数のみを根拠にした選定も却下する。
- **共通化のために FSD / monorepo の境界を壊した実装は却下**する。保守性は削減の対象ではない。
- 判断が割れるもの（採用済み技術の置き換え、非 OSI ライセンスの採用、公式推奨からの逸脱、
  スクラッチ実装が数百行規模になる設計）は**推測で進めず、必ずユーザーに確認**する。

## 参考

- [Sandi Metz: The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) — *"duplication is far cheaper than the wrong abstraction"*
- [OpenSSF Scorecard: Checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md) — `Maintained`（archived は最低点 / 直近 90 日に週 1 コミットで満点）・`Vulnerabilities`（OSV 参照）・`License`
- [OpenSSF Scorecard Viewer](https://scorecard.dev/) / [deps.dev (Google Open Source Insights)](https://deps.dev) / [OSV](https://osv.dev)
- [Six Million (Suspected) Fake Stars in GitHub (CMU / NC State / Socket, ICSE 2026)](https://arxiv.org/abs/2412.13459) — star は購入可能で単独の信頼シグナルにならない
- [Feature-Sliced Design](https://feature-sliced.design/) — 公開 API・依存方向・`@x` パターン
- `.claude/skills/fsd/` / `.claude/skills/monorepo/` / `.claude/rules/clean-code.md`
