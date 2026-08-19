# ASO（ストア掲載文の設計）

掲載文をどう書くかの**判断基準**。文言そのものは
`frontend/apps/mobile/store.config.js`（App Store）と `play.config.js`（Play）が正本で、
上限と語の重複は `src/shared/config/store-metadata.test.ts` が検証する。

---

## 1. 両ストアで検索の仕組みが違う（ここを取り違えると全部無駄になる）

| | App Store | Google Play |
|---|---|---|
| **検索インデックスの対象** | **title / subtitle / keywords の 3 つだけ** | **title / 短い説明 / 詳細な説明**（説明文が対象） |
| description | **ランキングに影響しない** | **影響する** |
| keywords フィールド | あり（100 文字） | **無い** |

つまり:

- **App Store の description にキーワードを詰め込むのは無駄**。読み手の意思決定
  （コンバージョン）に使う。
- **Play の詳細な説明はキーワードを含める必要がある**。ただし羅列すると
  スパム扱いになるので、**自然な文章のまま**含める。

同じ文章を両方に使い回すと、必ずどちらかの規約に引きずられる。だから
`store.config.js` と `play.config.js` は意図的に別ファイルにしてある。
**ただし事実（無料枠の値・機能の有無・価格）は必ず一致させること**（Apple 2.3.1）。

---

## 2. App Store: 語を重複させない

Apple は**同一ロケール内で** title + subtitle + keywords の語を**組み合わせて**
検索クエリを作る。したがって:

- title に「写真」があるなら、keywords に「写真」を入れるのは**純粋な無駄**。
  keywords には「共有」だけ入れれば「写真 共有」に当たる。
- 同じ語を 2 か所に書いた時点で、**100 文字の枠を自分で削っている**。

この重複は**エラーにならない**（検索の機会を黙って捨てるだけ）ので、
`store-metadata.test.ts` が静的に検出している。

### フィールドの重み

1. **title**（最重） — ブランド + 最上位キーワード
2. **subtitle** — title と重複させず、差別化と第二階層のキーワード
3. **keywords** — カンマ区切り・**スペースなし**で合計 100 文字

> `promoText`（170 文字）は**検索対象外**だが、**審査を通さず差し替えられる**唯一の枠。
> キャンペーンや不具合のお知らせに使う。

---

## 3. ロケールをまたいで語は結合されない

日本のストアフロントでは ja（主）と en-US（副）の両方が索引されるが、
**ロケールをまたいで語は組み合わされない**。したがって
**各ロケール単独で検索が成立するよう独立して組み立てる**（翻訳ではなく再設計）。

---

## 4. 上限（超えると push が落ちる）

| フィールド | App Store | Google Play |
|---|---|---|
| title | 30 | 30 |
| subtitle / 短い説明 | 30 | 80 |
| keywords | 100（カンマ込み・スペース不可） | — |
| promoText | 170 | — |
| description | 4000 | 4000 |

Play は**上限違反が commit 時に落ちる**ので原因が遠い。送る前に
`store-push-play-listing --dry-run` と単体テストの両方で弾く構成にしてある。

---

## 5. 課金の定型文は**ストアごとに違う**

自動更新サブスクを売る場合、説明文に自動更新の条件と解約導線を書く必要がある。
**書き先のストアの導線を案内すること**（Play の説明文に「App Store アカウントに
請求されます」と書いてあると、それ自体が不正確なメタデータになる）。

- App Store: 購入は Apple ID に請求される旨・期間終了 24 時間前までに自動更新を
  オフにしない限り更新される旨・設定からの管理
- Google Play: Google Play アカウントに請求される旨・[定期購入] からの管理

あわせて **EULA とプライバシーポリシーの URL** が必要（Apple 3.1.2）。
`store.config.js` の `termsOfUseUrl` / `privacyPolicyUrl` は全ロケール必須として
テストで検査している。

---

## 6. スクリーンショットに価格を書かない

**2.3.7**: メタデータ（アプリ名・サブタイトル・**スクリーンショット**・プレビュー）に
価格を含めてはならない。「無料」「◯円」を掲載画像に焼き込むと指摘対象になる。
料金は**説明文**に書く。

画像側の設計は `.claude/skills/store-screenshots/`。

---

## 参考

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect: App information](https://developer.apple.com/help/app-store-connect/reference/app-information/)
- [Google Play: ストアの掲載情報](https://support.google.com/googleplay/android-developer/answer/9859152)
