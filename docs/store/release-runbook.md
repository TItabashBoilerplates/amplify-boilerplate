# リリース手順書（エージェントが最後まで回すための正本）

**このファイルの目的**: 「ビルドした」で止まらず、**ユーザーの端末に届くところまで**を
コマンドだけで完了させる。人が App Store Connect / Play Console を開く必要があるのは
[§4 の一度きりの作業](#4-人でしかできないこと公開-api-が無い)だけにする。

初回提出までの準備は [`submission-checklist.md`](./submission-checklist.md)、
掲載文の設計は [`aso.md`](./aso.md)、審査要件のコード側不変条件は
[`.claude/rules/store-review.md`](../../.claude/rules/store-review.md)。

---

## 0. まず状態を見る（迷ったら必ずこれ）

```bash
store-preflight   # 人が画面で入力するしかない項目（初回・資格情報不要）
store-status      # 今どこまで進んでいるか（毎回・書き込まない）
```


```bash
store-status            # 人が読む形
store-status --json     # エージェント / CI 用
```

**一切書き込まない**ので、いつ実行してもよい。出力の最後に
「次にすべきこと」が 1 行で出るので、そのコマンドを実行すればよい。

```
=== App Store ===
版の状態: PREPARE_FOR_SUBMISSION
ビルド: 42=VALID
審査提出: 進行中なし
→ store-submit-ios で審査へ提出できます
```

**状態を見ずに操作を始めないこと。** ストアは「今の状態」によって
できることが変わり、しかも**やってはいけない操作もエラーにならず通る**ことがある
（審査中の版を編集すると、審査が取り下げられる）。

---

## 1. 全体の流れ

```
                    ┌─ ①ビルド & アップロード ─┐
                    │  mobile-release-ios      │  ← ここまでは以前からあった
                    │  mobile-release-android  │
                    └────────────┬─────────────┘
                                 │  ★ ここで人が画面を開く必要があった
                    ┌────────────┴─────────────┐
        iOS         │                          │      Android
  ②store-testflight │                          │ ②store-release-play --track internal
     （テスターへ）  │                          │      （テスターへ）
        │           │                          │            │
  ③store-submit-ios │                          │ ③store-release-play --from internal
     （審査へ）      │                          │      --track production --rollout 0.1
        │           │                          │            │
  ④審査通過 → 自動公開（既定）                  │ ④--rollout 1 で全公開
```

| # | やること | iOS | Android |
|---|---|---|---|
| 1 | ビルド & アップロード | `mobile-release-ios` | `mobile-release-android` |
| 2 | 掲載情報（初回・変更時） | `mobile-metadata` + `store-push-ios-screenshots` | `store-push-play-listing` |
| 3 | テスターへ配る | `store-testflight --wait` | `store-release-play --track internal --rollout 1` |
| 4 | 本番へ出す | `store-submit-ios` | `store-release-play --from internal --track production --rollout 0.1` |
| 5 | 広げる | （段階的リリースは Apple が自動で 7 日かけて実施） | `store-release-play --track production --rollout 1` |
| 6 | 問題が出たら | `store-submit-ios --cancel` | `store-release-play --track production --halt` |

**すべて `--dry-run` を受け付ける。本番を書き換えるものは必ず先に `--dry-run` を通す。**

---

## 2. iOS の手順

### 2.1 TestFlight へ配る

```bash
store-testflight --dry-run
store-testflight --wait                 # 処理完了を待ってから配布（推奨）
store-testflight --groups "QA,Beta"     # 配布先を明示
store-testflight --build 42             # ビルド番号を指定
```

やること:

1. Apple 側の処理（`PROCESSING` → `VALID`）を待つ ← `--wait`
2. `store.config.js` の `releaseNotes` を「このビルドの新機能」に入れる
3. テスターグループへ割り当てる
4. **外部グループが含まれるなら Beta App Review へ提出する**

| 注意 | 内容 |
|---|---|
| **既定は内部グループのみ** | 外部グループは Beta App Review 経由で不特定多数に届く。明示指定（`--groups`）が無い限り配らない |
| **外部グループは割り当てただけでは届かない** | Beta App Review の通過が必要。画面上は「グループに入っている」ように見えるので気づけない。スクリプトは自動で提出する |
| **`PROCESSING` 中は割り当てできない** | 409 になる。`--wait` を付ける（既定の上限 45 分、`--wait-timeout` で変更可） |

### 2.2 審査へ提出する

```bash
store-submit-ios --dry-run
store-submit-ios                    # 承認されたら自動で公開（既定）
store-submit-ios --release-manually # 承認後、手動で公開する
store-submit-ios --phased           # 承認後は段階的リリース（7 日かけて配る）
store-submit-ios --status           # 状態を見るだけ（書き込まない）
store-submit-ios --cancel           # 審査提出を取り下げる
```

`eas submit` は**バイナリを上げるだけ**で審査には出さない。提出には次の 5 つが要る:

1. **版（appStoreVersion）を作る** — `app.json` の `expo.version` と同じ版
2. **ビルドを紐付ける** — `VALID` のビルドのみ
3. **リリースノート** — `store.config.js` の `releaseNotes`
4. **審査情報** — 連絡先と**審査担当者用のログイン情報**
5. **審査へ提出** — `reviewSubmissions` → `reviewSubmissionItems` → `submitted=true` の 3 段

どれが欠けても「一部のフィールドが不足しています」としか出ないので、
スクリプトが順に埋める。

#### 審査情報は AWS SSM Parameter Store から（値をチャット・ログ・コミットに出さない）

| キー | 用途 |
|---|---|
| `APPLE_REVIEW_CONTACT_FIRST_NAME` / `_LAST_NAME` / `_EMAIL` / `_PHONE` | 審査担当者からの連絡先。**未設定だと落ちる** |
| `APPLE_REVIEW_DEMO_ACCOUNT` / `APPLE_REVIEW_DEMO_PASSWORD` | 審査用アカウント。ログインが要るアプリでは**必須** |
| `APPLE_REVIEW_NOTES` | 審査メモ（任意） |

登録先は SSM の `${MOBILE_SECRETS_SSM_PREFIX}/<KEY>`（既定 `/amplify-boilerplate/mobile`）で、
型は `SecureString`。CI が env で渡している場合は env が優先される
（[`.claude/rules/aws-first.md`](../../.claude/rules/aws-first.md) /
[`env-naming.md`](../../.claude/rules/env-naming.md)）。

```bash
aws ssm put-parameter --type SecureString \
  --name /amplify-boilerplate/mobile/APPLE_REVIEW_DEMO_ACCOUNT --value <値>
```

> **値はチャット / ログ / コミット / PR に出さない**（会話は**キー名のみ**で行う）。

> **審査用アカウントが無いと Guideline 2.1(a) でリジェクトされる。**
> しかも OTP / Magic Link だけのログインでは、審査担当者が受信箱に触れないため
> 資格情報を渡しても入れない。**モバイルはメール + パスワード必須**
> （[`.claude/rules/auth.md`](../../.claude/rules/auth.md)）。

### 2.3 触ってはいけない状態

`store-submit-ios` は状態を見て、危険なら**実行せずに落ちる**。
判断は `scripts/mobile/release-plan.mjs` にあり、単体テストで固定してある。

| 状態 | 判定 | できること |
|---|---|---|
| `PREPARE_FOR_SUBMISSION` / `REJECTED` / `DEVELOPER_REJECTED` / `METADATA_REJECTED` | **編集・提出可** | そのまま提出 |
| `WAITING_FOR_REVIEW` / `IN_REVIEW` / `PENDING_APPLE_RELEASE` | **待つ** | 編集すると**審査が取り下げられる**。取り下げてよいなら `--cancel` |
| `PENDING_DEVELOPER_RELEASE` | **公開へ** | `store-submit-ios` を再実行すると公開する |
| `READY_FOR_SALE` / `READY_FOR_DISTRIBUTION` | **新しい版が要る** | `app.json` の `expo.version` を上げてビルドし直す |
| `WAITING_FOR_EXPORT_COMPLIANCE` | **待つ** | `app.json` の `ios.config.usesNonExemptEncryption` が未設定（§5） |
| 未知の状態 | **待つ** | Apple は状態を増やす。知らない状態は必ず止める |

---

## 3. Android の手順

```bash
store-release-play --status                            # 全トラックの現状（書き込まない）
store-release-play --track internal --rollout 1        # 内部テストへ配る
store-release-play --from internal --track production --rollout 0.1
                                                       # 本番へ昇格して 10% に配る
store-release-play --track production --rollout 0.5    # 割合を上げる
store-release-play --track production --rollout 1      # 全公開
store-release-play --track production --halt           # 進行中のロールアウトを止める
```

### 3.1 `eas submit` の後は「誰にも配られていない」

`eas.json` の submit プロファイルは `releaseStatus: "draft"` なので、
アップロードは成功しても**テスターにも届かない**。ここが「提出したのに反映されない」の
最頻出原因で、`store-release-play --track internal --rollout 1` で配布が始まる。

### 3.2 段階的公開の約束事

| 制約 | 内容 |
|---|---|
| `userFraction` は **0 < f < 1** | 1.0（全公開）は割合ではなく `status: completed`。0 / 1 を割合として渡すとロールアウトが作られない |
| `completed` に `userFraction` は付けられない | 付けると 400 |
| `inAppUpdatePriority` は 0〜5 | **ロールアウト開始後は変更できない** |
| **edit はトランザクション** | 開いて変更して commit するまで何も起きない。1 アプリで同時に開けるのは 1 つで、**誰かが Play Console で変更すると開いている edit は全部無効になる** |

`--halt` で止めても**既にインストールされた端末は戻らない**。
巻き戻しは「新しいビルドを出す」しかないので、本番はまず 10% から始める。

---

## 4. 人でしかできないこと（公開 API が無い）

```bash
store-preflight          # ★ 何を・どこで・どんな値で入力するかを一覧で出す
store-preflight --json   # 機械が読む形
```

**資格情報も通信も要らない**ので、ストアのアカウントを作る前でも実行できる。
以下はその要約で、**実際の作業時は `store-preflight` の出力に従うこと**
（依存関係から「申告が要りそうなデータ種別」まで出る）。

### 4.0 「API が無い」の正誤表（思い込みが多いので必ず確認する）

**自動化できるのに手作業だと思われているもの**が多い。下表の左側は**すべて自動化済み**。

| 項目 | API | 本リポジトリでの手段 |
|---|---|---|
| **年齢レーティング** | ✅ `ageRatingDeclarations` | `mobile-metadata`（`store.config.js` の `apple.advisory`） |
| **Play の Data safety** | ✅ `applications.dataSafety`（CSV を POST） | `store-push-data-safety` |
| **Play のテスター登録** | ✅ `edits.testers`（Google グループ単位） | Play Console か API |
| **輸出コンプライアンス** | ✅ Info.plist | `app.json` の `ios.config.usesNonExemptEncryption` |
| **審査提出・TestFlight・ロールアウト** | ✅ | §2 / §3 |
| ── ここから下は**本当に API が無い** ── | | |
| **App Privacy（Apple のラベル）** | ❌ | 画面で回答（§4.2） |
| **EU DSA トレーダーステータス** | ❌ | 画面で回答（§4.2） |
| **Play のコンテンツレーティング / 対象年齢** | ❌ | 画面で回答（§4.2） |
| **有料 App 契約 / デベロッパー認証** | ❌ | 画面で締結（§4.1） |

> **App Privacy について**: fastlane には
> `upload_app_privacy_details_to_app_store` があるが、**公式 API ではなく**
> Apple ID のパスワードと 2FA セッションを要求する非公式エンドポイントを使う
> （fastlane 自身が「App Store Connect API Key は使えない」と明記している）。
> 本リポジトリは API キーだけで完結させる方針なので採用しない。

### 4.1 一度だけ（アカウント初期設定）

| # | 作業 | 無いとどうなるか |
|---|---|---|
| 1 | Apple Developer Program / Google Play デベロッパー アカウント登録 | 何も始まらない |
| 2 | **有料 App 契約（Paid Applications Agreement）** | サブスク商品が永久に `MISSING_METADATA` |
| 3 | App Store Connect でアプリレコード作成 | `No suitable application records found` |
| 4 | Play Console でアプリ作成 + 1 度は内部テストへ提出 | 掲載情報 API が対象を見つけられない |
| 5 | ASC API キー（Key ID / Issuer ID / .p8）発行 | 全スクリプトが動かない |
| 6 | Play のサービスアカウント作成 + **Play Console の Users & Permissions で権限付与** | 鍵は正しいのに 403。**GCP の IAM では付かない** |

### 4.2 申告フォーム（API が存在しないもの）

**入力する値の詳細は `store-preflight` が出す。** ここは概要のみ。

| 申告 | 場所と要点 |
|---|---|
| **App Privacy（Apple）** | ASC → 対象アプリ → App Privacy。**未入力だと提出できない**。収集するデータ種別・用途・ユーザーとの紐付け・トラッキングの有無を答える。`ios/PrivacyInfo.xcprivacy`（privacy manifest）とは**別物で両方必要** |
| **EU DSA トレーダーステータス** | ASC → Business → Agreements → Compliance。**2025-02-17 以降、新規提出・更新のいずれにも必須**。未申告だと**EU 27 か国で販売停止**。**審査では弾かれない**ので気づけない。EU に出さない場合も「非トレーダー」として申告が要る。権限は **Account Holder / Admin** |
| **Play のコンテンツレーティング（IARC）** | Play Console → ポリシー → アプリのコンテンツ。アンケート形式。未回答だと公開できない |
| **Play の対象年齢・その他の申告** | 同上。広告の有無 / ニュース / 金融 / 健康 の該当有無 |
| ~~Data safety（Play）~~ | **API がある** → `store-push-data-safety`（§4.3） |
| ~~年齢レーティング（Apple）~~ | **API がある** → `store.config.js` の `apple.advisory` + `mobile-metadata` |
| ~~輸出コンプライアンス~~ | **`app.json` で自動化済み**（§5） |

> ⚠️ **年齢レーティングには EAS Metadata が扱えない新項目がある。**
> ASC API には `socialMedia` / `ageAssurance` / `userGeneratedContent` /
> `messagingAndChat` 等が増えているが EAS のスキーマは未対応で、
> **2026 年 9 月以降は「ソーシャル機能の有無」の申告が提出の必須条件**になる。
> 該当するアプリは ASC の画面で追加回答が要る。

### 4.3 Data safety は CSV で自動化する（API あり）

```bash
store-push-data-safety --dry-run
store-push-data-safety
```

**CSV の初回取得だけ画面操作が要る**（以降はそのファイルが正本になる）:

1. Play Console → 対象アプリ → ポリシー → アプリのコンテンツ → データセーフティ
2. 右上の「**CSV にエクスポート**」（未回答ならテンプレートを取得）
3. `frontend/apps/mobile/store-listing/play-data-safety.csv` に置く

| 注意 | 内容 |
|---|---|
| **edits に乗らない** | このエンドポイントだけトランザクション外。**成功した瞬間に反映**され、commit も rollback も無い |
| **申告は実装と一致させる** | Google は APK と SDK の挙動を申告と突き合わせる。食い違うと**アプリ削除・アカウント警告**。SDK を足したら CSV も更新する |
| CSV を Git に置く意味 | 画面で答えると誰がいつ何を変えたか追えない。ファイルなら履歴が残る |

### 4.3 期間が要る要件

| 要件 | 内容 |
|---|---|
| **Play のクローズドテスト（12 人 × 14 日）** | **2023-11-13 以降に作成した個人アカウント**は、本番公開の前に「12 人以上のテスターが 14 日間**継続して**参加するクローズドテスト」が必須。組織アカウントは対象外。最頻出の却下理由は「テスト参加が不十分」＝**インストールだけで使われていない**こと。**テスターの登録自体は `edits.testers` API（Google グループ単位）で自動化できる**が、14 日間の参加そのものは当然できない |
| **Android デベロッパー認証** | 2026-09-30 からブラジル・インドネシア・シンガポール・タイで開始。順次拡大 |
| Apple の審査 | 通常 24〜48 時間。`store-submit-ios --status` で確認する |

### 4.4 その他

- **Play の base plan は DRAFT で作られる** → Play Console で有効化する（offer はスクリプトが activate する）
- **TestFlight の外部テスター募集リンクの公開** → Play/ASC の画面操作

---

## 5. 無人リリースを壊す設定（コード側で潰してある）

| 設定 | 無いとどうなるか | 検査 |
|---|---|---|
| `app.json` の `ios.config.usesNonExemptEncryption` | アップロードのたびに輸出コンプライアンスを質問され、**版が `WAITING_FOR_EXPORT_COMPLIANCE` で止まる**。ビルドも提出も成功して見えるのに配布されない | `release-plan.test.ts` |
| `store.config.js` の `releaseNotes` | App Store は 2 回目以降の版で必須。Play は 500 文字上限（App Store の 1/8）で**commit 時にまとめて落ちる** | `release-plan.test.ts` / `store-metadata.test.ts` |
| `eas.json` の `appVersionSource: "remote"` + `autoIncrement` | ビルド番号が衝突して提出が弾かれる | — |
| メール + パスワードのログイン導線 | 審査担当者が入れず **2.1(a) でリジェクト** | `required-flows.test.ts` |

---

## 6. リリース前に必ず通すこと

```bash
ci-check          # lint / format / type-check
unit-test         # store-metadata / release-plan / required-flows を含む
store-status      # 今の状態と次の一手
```

**All Green でないままリリースしない**（[`.claude/rules/tdd.md`](../../.claude/rules/tdd.md)）。

---

## 7. 困ったときの対応表

| 症状 | 原因 | 対処 |
|---|---|---|
| アップロードしたのに TestFlight に出ない | 処理中、または輸出コンプライアンス待ち | `store-status` で確認。§5 の設定を入れる |
| 「グループに入れたのに外部テスターに届かない」 | Beta App Review 未通過 | `store-testflight` が自動提出する。通過を待つ |
| 提出しようとすると「フィールドが不足」 | 審査情報 / リリースノート / ビルド紐付けのどれか | `store-submit-ios` が順に埋める。それでも落ちるなら App Privacy 未入力（§4.2） |
| Play にアップロードしたのに誰にも届かない | `releaseStatus: "draft"` のまま | `store-release-play --track internal --rollout 1` |
| Play の commit が「edit が無効」で落ちる | 誰かが Play Console で変更した / edit の期限切れ | 再実行する（スクリプトは毎回 edit を開き直す） |
| サブスクが永久に「準備中」 | `store-equalize-ios-prices` 未実行、または有料 App 契約が未締結 | 前者はコマンド、後者は §4.1 |
| 審査中に間違いに気づいた | — | `store-submit-ios --cancel` → 修正 → 再提出 |
| 本番に出した後に不具合 | — | iOS: 段階的リリースなら App Store Connect で一時停止。Android: `--halt` |

---

## 8. 参照

- 手順の実体: [`.claude/skills/mobile-release/`](../../.claude/skills/mobile-release/SKILL.md)
- 掲載画像: [`.claude/skills/store-screenshots/`](../../.claude/skills/store-screenshots/SKILL.md)
- 判断ロジック: `scripts/mobile/release-plan.mjs` / `frontend/apps/mobile/src/shared/config/release-plan.test.ts`
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi) —
  **エンドポイントの形は推測せず、公式の OpenAPI 仕様で確認する**
- [Google Play Developer API: Edits](https://developers.google.com/android-publisher/edits) /
  [edits.tracks](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks)
- [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Staged rollouts](https://support.google.com/googleplay/android-developer/answer/6346149)
