# ストア審査要件ポリシー（コード側の不変条件）

**CRITICAL / NON-NEGOTIABLE**: App Store / Google Play の審査要件のうち、**コードで守るもの**を
定める。

ここに挙げた配線には共通の性質がある: **壊してもアプリは普通に動く**。
ビルドも型チェックも lint も Storybook も通る。気づけるのは審査でリジェクトされたとき、
あるいはストアにアップロードできなくなったときだけである。だから静的検査で CI に止めさせる。

対象は `frontend/apps/mobile/`。コンソール側の申告手続き（Data safety・年齢レーティング・
輸出コンプライアンス等）は本ルールの対象外で、`docs/store/submission-checklist.md` が正本。

> **⚠️ 未移植のツール**: 本ルールが参照する `store-preflight` / `store-status` /
> `store-push-*` / `mobile-release-*`（`scripts/mobile/`）、`store.config.js` /
> `play.config.js` / `iap.config.js`、`docs/store/` はこのリポジトリにまだ無い。
> モバイルをストア配布する段階で移植する（`docs/_research/2026-08-18-shadcn-boilerplate-parity-gap.md` §6）。
> **ポリシー自体（何を守るか）は今から有効**で、コード側の不変条件は下記のとおり守ること。

> **boilerplate での適用範囲**: このリポジトリには bundle id も package name も、
> 収集するデータの定義も**まだ無い**。したがって §1〜§4 のうち「そのアプリが何を
> 収集し、何を第三者へ送るか」に依存する項目は、**派生プロジェクトで実装する時点から**
> 効き始める。boilerplate 本体でそれらが未設定であることを不備として報告しないこと
> （派生プロジェクトで初めて確定する値に依存するため）。
> **`store.config.js` / `play.config.js` / `iap.config.js` の整合だけは boilerplate でも
> 検査対象**で、`src/shared/config/store-metadata.test.ts` が常時走っている。

---

## 1. 第三者 AI へ personal data を送る前に、開示して明示的な同意を取る

App Store Review Guideline **5.1.2(i)**:

> You must clearly disclose where personal data will be shared with third parties,
> **including with third-party AI**, and obtain explicit permission before doing so.

写真・音声・位置・健康情報・連絡先など**個人に紐づくデータを外部のモデル**
（OpenAI / Google / Anthropic / fal など）へ送る機能を足したら、次の 3 つを同時に満たす。

| 要求 | 実装 |
|---|---|
| **提供者名と目的を具体的に**（「AI を使います」では不足） | 開示文にプロバイダ名（例: Google / Gemini）と用途を明記する |
| **データが端末を出る前に同意**（アップロードより手前） | 同意が確定するまで、送信元の画面（カメラ等）を描画しない |
| **拒否でき、拒否しても使い続けられる** | 拒否の導線を置き、AI を通らない機能は使える旨を書く |

**あとから取り消せること**も要件（"a clear way to decline" は初回一度きりでは満たされない）。
設定画面から同意を取り消せるようにする。

同意は**端末ローカル**に持つ。アカウントやファミリーで共有すると、**同意していない
別の人の端末から送信されてしまう**。読み取りに失敗したら**未同意として扱う**
（同意を取りこぼして再表示されるのは無害だが、逆は無断送信になる）。

> **新しく AI に何かを送るときは、この開示の対象を必ず見直す。** 送るデータの種類や
> 送り先が増えたら開示文を更新する。**文面と実態がずれるのが一番まずい**。

あわせて、**LLM に診断・判定をさせない**設計を検討すること（医療・法律・金融など）。
モデルには「見えているものの構造化」までをさせ、判定は決定論的なロジックで導出すると、
再現性・説明責任・テスト可能性が保てる。AI が下書きした内容には**免責を表示**する。

---

## 2. privacy manifest を実態と一致させる（iOS）

`ios/PrivacyInfo.xcprivacy` は **prebuild の生成物**（`ios/` は gitignore）。
何も書かなければ Expo の既定値（収集データ型なし・`NSPrivacyTracking = false`）が
そのまま出荷される。**トラッキングする SDK（広告・アトリビューション）を入れているのに
「トラッキングしない」と宣言した状態**になり、これは虚偽申告にあたる。

`app.json` の `ios.privacyManifests` で宣言し、App Store Connect の App Privacy ラベルと揃える。
Expo はパッケージ側の宣言と**マージ**するので、`NSPrivacyAccessedAPITypes` は上書きされない。

- **位置情報を広告・分析に使わないなら、宣言でもそう書く**。アプリ内の開示文で
  「広告には使いません」と約束しているなら、宣言が食い違った時点で約束破りになる
- **`NSPrivacyTrackingDomains` を自前で数え上げない**。ここに列挙したドメインは ATT 拒否時に
  iOS がブロックするため、取りこぼすと広告が壊れる。SDK 側が自身の manifest で宣言する

---

## 3. target API level と権限宣言を落とさない（Android）

| 項目 | 要件 |
|---|---|
| `targetSdkVersion` | **36 以上**（Play は 2026-08-31 以降、新規アプリに 36 必須）。**Expo の既定は 35** なので `expo-build-properties` で明示する。書かなくても**ビルドは通り、Play へのアップロードだけが弾かれる** |
| `com.google.android.gms.permission.AD_ID` | Android 13+ で広告 SDK を使うなら必須。SDK のマージ任せにせず明示し、Play Console の広告 ID 申告と一致させる |
| `android.permission.POST_NOTIFICATIONS` | Android 13+ のプッシュ通知に必須 |

---

## 3.5. アカウント側の要件（コードでは満たせないが、知らないと出せない）

**コードが完璧でも、これらが未了だと提出できない / 公開が止まる。**
いずれも公開 API が無いので、**エージェントは「人がやる必要がある」と報告する**こと。
黙って進めても、エラーではなく「反映されない」形で失敗する。

**まず `store-preflight` を実行する。** 何を・どこで・どんな値で入力するかを、
このリポジトリの設定から具体値つきで出す（資格情報も通信も不要）。

**「API が無い」と思い込まないこと。** 下表の上半分は**自動化できる**（実際に
「手作業だ」と誤認されがちなものばかり）。**API があるものを人にやらせない。**

| 要件 | API | 手段 |
|---|---|---|
| **年齢レーティング** | ✅ `ageRatingDeclarations` | `store.config.js` の `apple.advisory` → `mobile-metadata`。**2026-01-31 以降、未回答だとアップデートを提出できない**ので必ず書く |
| **Data safety（Play）** | ✅ `applications.dataSafety`（CSV を POST） | `store-push-data-safety`。**edits に乗らず即時反映**（取り消せない） |
| **Play のテスター登録** | ✅ `edits.testers`（Google グループ単位） | API か Play Console |
| **輸出コンプライアンス** | ✅ Info.plist | `app.json` の `ios.config.usesNonExemptEncryption` |
| ── ここから下は**本当に API が無い**（人がやる） ── | | |
| **App Privacy（Apple のプライバシーラベル）** | ❌ | ASC の画面。未入力だと提出できない。§2 の privacy manifest とは**別物**で両方要る。fastlane の upload 機能は**非公式 API + Apple ID パスワード**を使うので採用しない |
| **EU DSA トレーダーステータス** | ❌ | **2025-02-17 以降、新規提出にも更新にも必須**。未申告だと**EU 27 か国で販売停止**。**審査時には弾かれない**ので気づきにくい。EU に配信しない場合も「非トレーダー」として申告が要る |
| **Play のコンテンツレーティング / 対象年齢** | ❌ | Play Console の「アプリのコンテンツ」 |
| **Play のクローズドテスト（12 人 × 14 日）** | ⚠️ 一部 | **2023-11-13 以降に作成した個人アカウント**のみ対象（組織は対象外）。テスター登録は API 可だが、**14 日間の継続参加**は当然不可。却下理由の最多は「テスト参加が不十分」＝**インストールされただけで使われていない**こと |
| **Android デベロッパー認証** | ❌ | 2026-09-30 からブラジル・インドネシア・シンガポール・タイで開始し順次拡大 |
| **有料 App 契約** | ❌ | 未締結だとサブスク商品が永久に `MISSING_METADATA` |

> ⚠️ **年齢レーティングには EAS Metadata が扱えない新項目がある。**
> ASC API 側には `socialMedia` / `ageAssurance` / `userGeneratedContent` /
> `messagingAndChat` 等が増えているが EAS のスキーマは未対応で、
> **2026 年 9 月以降は「ソーシャル機能の有無」の申告が提出の必須条件**になる。
> 該当するなら ASC の画面で追加回答が要る（`store-preflight` が案内する）。

手順は `docs/store/release-runbook.md` §4。

---

## 4. 審査で必ず見られる導線（実装したら消さない）

| 導線 | 要件 |
|---|---|
| **メール + パスワードでのログイン** | モバイルでは**必須**。OTP / Magic Link のみのログインは、審査担当者が受信箱に触れられないため **2.1(a)（demo account / login credentials の提供）でリジェクト**される。OAuth / パスキー / OTP の併用は可。詳細は `.claude/rules/auth.md` |
| **パスワード再設定 / メールアドレス再設定** | 「パスワードを忘れた方」は**ログイン画面**に、パスワード変更とメールアドレス変更は**設定画面**に置く（`.claude/rules/auth.md`）。審査用アカウントの資格情報が失効したときの復旧手段でもある |
| **アプリ内のアカウント削除** | アカウント作成ができるアプリでは**必須**（App Store 5.1.1(v)）。「サポートへ連絡」では不可 |
| **ペイウォール** | 自動更新サブスクでは、価格・期間・**自動更新される旨**・**購入の復元**・**EULA と プライバシーポリシーへのリンク**が同一画面に要る（Apple 3.1.2） |
| **バックグラウンド位置情報の prominent disclosure** | OS の権限ダイアログ**より前**に、何のために継続取得するかを自前の画面で説明する（Play の位置情報ポリシー） |
| **AI が生成した内容の免責** | §1 参照 |
| **審査用アカウント** | ログインが要るなら、審査メモに有効な資格情報を書く（毎回失効させない） |

---

## 5. ストア掲載情報と実装を一致させる

`store.config.js` / `play.config.js` の説明文が実装と食い違うと **Apple 2.3.1
（不正確なメタデータ）** の指摘対象。

- **プランの内容や上限値を変えたら、掲載情報も同じコミットで直す**
- **スクリーンショットに価格を書かない**（2.3.7）。料金は説明文に書く
- 両ストアの説明文は別ファイルだが、**事実（無料枠の値・機能の有無・価格）は必ず一致**させる

---

## 6. `app.json` を触ったら生成物を実測する

**「書いた」と「効いている」は別。** 設定が別の plugin に無言で上書きされることがある
（`expo-splash-screen` の `dark` 設定が `UIUserInterfaceStyle` を `Automatic` に巻き戻す、
config plugin の適用順で entitlement が sandbox に落ちる、など実例がある）。
警告は出ても**失敗しない**ので、生成物を見るまで気づけない。

```bash
npx expo prebuild --platform ios --no-install
plutil -extract NSPrivacyTracking raw ios/<App>/PrivacyInfo.xcprivacy
plutil -extract UIUserInterfaceStyle raw ios/<App>/Info.plist
plutil -extract aps-environment raw ios/<App>/<App>.entitlements   # 本番は production

npx expo prebuild --platform android --no-install
grep targetSdkVersion android/gradle.properties                    # → 36 以上
grep -E 'AD_ID|POST_NOTIFICATIONS' android/app/src/main/AndroidManifest.xml
```

**config plugin の適用順は「後に書いたほうが勝つ」**（`withEntitlementsPlist` 等の mod は
登録順に連鎖する）。ある plugin が値を固定してしまう場合は、**plugin 配列の末尾**に
自前の plugin を置いて上書きし直す。順序を崩さないこと。

---

## 7. 自動検知（CI で止める）

`frontend/apps/mobile/src/shared/config/store-metadata.test.ts` が、**boilerplate でも
常時検査できるもの**を見ている。**削除・スキップしない。**

`frontend/apps/mobile/src/shared/config/release-plan.test.ts` は、**リリースを人の操作
なしで完了させる前提**を守っている。とくに `app.json` の
`ios.config.usesNonExemptEncryption` が無いと、アップロードのたびに輸出コンプライアンスを
聞かれて**版が `WAITING_FOR_EXPORT_COMPLIANCE` で止まる**（ビルドも提出も成功して見えるのに
配布されない）。あわせて、審査中の版に書き込まないための状態判断も固定している。

| 検査 | 内容 |
|---|---|
| App Store の文字数上限 | title / subtitle / promoText / description / keywords(100) |
| ASO の語の重複 | title・subtitle と keywords で同じ語を使っていないか（重複は純粋な無駄） |
| 法務 URL | 全ロケールに privacyPolicyUrl / termsOfUseUrl があるか |
| 雛形ガード | `STORE_WEB_BASE_URL` 未設定で push できないこと |
| Play の文字数上限 | title(30) / shortDescription(80) / fullDescription(4000) |
| 課金商品の整合 | productId の重複、両ストアぶんの定義、ロケールの対、benefits ≤ 4、トライアルの enum |

`frontend/apps/{web,mobile}/src/features/auth/model/required-flows.test.ts` は
**認証の必須導線**を同じ考え方で守っている（`.claude/rules/auth.md`）:

| 検査 | 落ちたときに防いでいる事故 |
|---|---|
| ログイン画面がパスワード認証（`signIn({ username, password })`）を使っている | OTP のみ → **2.1(a) でリジェクト** |
| ログイン画面に「パスワードを忘れた方」がある | 忘れた人が復帰できない |
| 設定画面にメール変更 / パスワード変更 / アカウント削除がある | 5.1.1(v) 違反・ユーザーがアカウントを失う |
| `updatePassword({ oldPassword, newPassword })` で検証している（`signIn` で代用していない） | 新セッション発行の副作用 |
| backend が `AttributesRequireVerificationBeforeUpdate: ['email']` を設定している | メール変更でユーザーが締め出される |
| サーバー側が `runWithAmplifyServerContext` + `aws-amplify/auth/server` を使っている | クライアント由来の値でページを保護してしまう |
| Mobile クライアントがトークンストレージを設定している | 起動のたびにログインになる |
| en / ja のキー集合が一致している | 片方だけ翻訳を足す事故 |

**派生プロジェクトでは、§1〜§4 のうち自分が実装したものに対する検査を追加すること**
（AI 同意ゲートの存在、privacy manifest の宣言、target API 36、**メール + パスワードのログイン導線**、
**パスワード再設定・メールアドレス再設定の導線**、アカウント削除導線）。
実装した機能に対応する検査が無いと、**消しても誰も気づかない**。

---

## 8. 強制事項

このポリシーは**交渉の余地なし**。AI 同意のゲートを外す、privacy manifest の宣言を実態と
ずらす、target API を下げる、アカウント削除やペイウォールの必須要素を削る、
検知テストを無効化する変更は**レビューで却下**する。

## 参考

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple: Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Google Play: Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- `docs/store/submission-checklist.md` / `store-screenshots` / `mobile-release` skill（いずれも未移植。上記の注記を参照）
