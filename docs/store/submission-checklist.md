# ストア提出チェックリスト

初回提出までに必要な作業を、**自動化できるもの / 人手でしかできないもの**に分けて並べる。
コマンドはすべて devenv shell 上（`.claude/rules/commands.md`）。

> **必ず `--dry-run` を先に通す。** 掲載情報と課金商品を書き換えるコマンドは、
> 実行すると本番のストアに反映される。

---

## 0. 人手でしかできないこと（公開 API が無い）

ここが済んでいないと、以降のコマンドは**エラーにならず「反映されない」形**で失敗する。

| # | 作業 | 無いとどうなるか |
|---|---|---|
| 1 | Apple Developer Program / Google Play デベロッパー アカウントの登録 | 何も始まらない |
| 2 | **有料 App 契約（Paid Applications Agreement）の締結** | サブスク商品が永久に `MISSING_METADATA` のまま。ローカライズも価格も揃っているのに解消しないので原因が分かりにくい |
| 3 | App Store Connect でアプリレコードを作成（bundle id を登録） | `No suitable application records found` でアップロードが落ちる |
| 4 | Play Console でアプリを作成し、**1 度は内部テストへ提出** | 掲載情報 API が対象アプリを見つけられない |
| 5 | App Store Connect API キー（Key ID / Issuer ID / .p8）の発行 | ストア反映スクリプトが動かない |
| 6 | Play の**サービスアカウント**を作り、Play Console の Users & Permissions で権限を付与 | 鍵は正しいのに 403。**GCP の IAM ロールでは付かない** |
| 7 | **App Privacy ラベル（Apple）** | **API が無い**。ASC の画面で入力しないと提出できない |
| 8 | **EU DSA トレーダーステータスの申告（Apple）** | 2025-02-17 以降、**新規提出にも更新にも必須**。**審査では弾かれず**、未申告だと **EU 27 か国で販売停止**になる。EU に出さない場合も「非トレーダー」として申告が要る |
| 9 | **Play のコンテンツレーティング / 対象年齢** | **API が無い**。Play Console の「アプリのコンテンツ」で回答する |
| 10 | **Play のクローズドテスト（12 人 × 14 日間の継続参加）** | **2023-11-13 以降に作成した個人アカウント**のみ対象。本番公開の前提条件。却下理由の最多は「テスト参加が不十分」＝**インストールされただけで使われていない**こと。組織アカウントは対象外 |

```bash
store-preflight   # ★ 上記を「何を・どこで・どんな値で」入力するか具体値つきで出す
                  #    資格情報も通信も要らないので、アカウントを作る前に実行できる
```

> **以下は API があるので手作業にしないこと**（よく誤解される）:
> - **年齢レーティング** → `store.config.js` の `apple.advisory` + `mobile-metadata`。
>   **2026-01-31 以降、未回答だとアップデートを提出できない**
> - **Data safety（Play）** → `store-push-data-safety`（CSV を公式 API へ POST）
> - **Play のテスター登録** → `edits.testers`（Google グループ単位）
> - **輸出コンプライアンス** → `app.json` の `ios.config.usesNonExemptEncryption`。
>   消すと版が `WAITING_FOR_EXPORT_COMPLIANCE` で止まるので `release-plan.test.ts` が検査

5 と 6 の資格情報は **AWS SSM Parameter Store に `SecureString` で登録**する
（`.claude/rules/aws-first.md` / `env-naming.md`。値はチャットにもログにも出さない）。
キー名は `APPLE_API_KEY` / `APPLE_API_ISSUER` / `APPLE_API_KEY_P8` /
`PLAY_SERVICE_ACCOUNT_JSON`。パスは `${MOBILE_SECRETS_SSM_PREFIX}/<KEY>`
（既定 `/amplify-boilerplate/mobile`。`scripts/mobile/config.env` で変更できる）。
CI では env で渡してもよい（env が SSM より優先される）。

---

## 1. アプリの identity を決める（1 度だけ・後から変えられない）

```jsonc
// frontend/apps/mobile/app.json
{
  "expo": {
    "name": "...",
    "version": "1.0.0",
    "ios":     { "bundleIdentifier": "com.example.app", "supportsTablet": true },
    "android": { "package": "com.example.app" }
  }
}
```

- **bundle id / package name はリネームできない**（別アプリ扱いになる）
- `supportsTablet: true` のままにするなら、**iPad のスクリーンショットが必須**になる。
  タブレット向けのレイアウトを作らないなら `false` にする
- Play へ出すなら **`targetSdkVersion` 36 以上**が必要（Expo の既定は 35。
  `expo-build-properties` で明示する。`.claude/rules/store-review.md` §3）

---

## 2. 掲載情報を書く

| 対象 | ファイル | 反映 |
|---|---|---|
| App Store の文言 | `frontend/apps/mobile/store.config.js` | `mobile-metadata` |
| Play の文言・画像 | `frontend/apps/mobile/play.config.js` | `store-push-play-listing` |

書き方の判断基準は [`aso.md`](./aso.md)。上限と語の重複は単体テストが検査する:

```bash
test-frontend    # store-metadata.test.ts を含む
```

`store.config.js` は `STORE_WEB_BASE_URL`（法務ページを置く本番 Web オリジン）が
未設定だと**意図的に落ちる**。雛形のまま push してプレースホルダを登録しないため。

---

## 3. 画像を用意する

```bash
# 実機描画（macOS + Xcode が要る。Linux では --platform android のみ）
screenshots-mobile
# Storybook から（ネイティブビルド不要。多ロケール × 多サイズの量産向き）
devenv shell -P store-listing -- screenshots-storybook

# Play のフィーチャーグラフィック（1024x500。公開に必須）
devenv shell -P store-listing -- build-play-feature-graphic
```

| 画像 | App Store | Google Play |
|---|---|---|
| スクリーンショット | iPhone 6.9"（1320x2868）**必須**。`supportsTablet` なら iPad 13" も必須 | 2〜8 枚。**長辺 ≤ 短辺 × 2** |
| アイコン | app.json の icon から生成 | 512x512（`store-push-play-listing` が自動縮小） |
| フィーチャーグラフィック | — | **1024x500 必須** |

出力先は `store-listing/`（gitignore 済み）。フィーチャーグラフィックは設計素材なので
`assets/store/` に置いて**コミットする**。

設計・合成・落とし穴は `.claude/skills/store-screenshots/`。

---

## 4. 課金商品を作る（サブスクを売る場合）

`frontend/apps/mobile/iap.config.js` に商品を定義してから、**この順序で**実行する。

```bash
store-create-ios-subscriptions --dry-run && store-create-ios-subscriptions
store-equalize-ios-prices     --dry-run && store-equalize-ios-prices   # ← 省略不可
store-create-play-subscriptions --dry-run && store-create-play-subscriptions
store-create-play-offers        --dry-run && store-create-play-offers
```

| 注意 | 内容 |
|---|---|
| **`store-equalize-ios-prices` を飛ばさない** | 商品作成は基準地域の価格しか作らない。全地域で販売する設定なので、残りの地域が「販売するのに価格が無い」状態になり **`MISSING_METADATA` が解消しない** |
| **Play の base plan / offer は DRAFT で作られる** | activate するまで購入できない。offer はスクリプトが activate するが、**base plan は Play Console で有効化する** |
| **productId は変更できない** | 作り直すと購入履歴が切れる。アプリ側の権限判定コードと同じ文字列を使う |

---

## 5. ビルドしてアップロードする

```bash
sync-eas-env production        # env の EXPO_PUBLIC_* を EAS へ（これが無いと起動直後に落ちる）
mobile-release-ios             # build → App Store Connect へアップロード
mobile-release-android         # build → Play へアップロード（draft）
```

⚠️ **ここまでではリリースは完了していない。** iOS は処理待ちで誰にも届いておらず、
Android は `draft` なのでテスターにも配られていない。

詳細と既知の失敗は `.claude/skills/mobile-release/`。

---

## 5.5. 配布して公開する（アップロードの後）

```bash
store-status                   # ★ まずこれ。状態と「次の一手」を出す（書き込まない）

# iOS
store-testflight --wait        # 処理待ち → グループ配布 → 外部なら Beta App Review
store-submit-ios --dry-run && store-submit-ios      # 審査へ提出

# Android
store-release-play --track internal --rollout 1                      # テスターへ
store-release-play --from internal --track production --rollout 0.1  # 本番へ 10%
store-release-play --track production --rollout 1                    # 全公開
```

審査情報（連絡先・**審査用アカウント**）は SSM の `APPLE_REVIEW_*`。
未設定だと `store-submit-ios` が落ちる（ログインが要るアプリで審査用アカウントが
無いと **2.1(a) でリジェクト**されるため）。

手順・状態遷移表・トラブル対応は [`release-runbook.md`](./release-runbook.md) が正本。

---

## 6. 提出前の最終確認

| # | 確認 |
|---|---|
| 1 | `ci-check` と `unit-test` が All Green（`.claude/rules/tdd.md`） |
| 2 | `.claude/rules/store-review.md` の §1〜§4 が満たされている（AI 同意 / privacy manifest / target API / アカウント削除・ペイウォールの必須要素） |
| 3 | 掲載文の事実（無料枠・価格・機能）が**実装と両ストアで一致**している |
| 4 | スクリーンショットに**価格を書いていない**（2.3.7） |
| 5 | ログインが要るなら、**メール + パスワードで入れる審査用アカウント**を審査メモに記載した（OTP / Magic Link のみのログインは、審査担当者が受信箱に触れられず **2.1(a) でリジェクト**される。`.claude/rules/auth.md`） |
| 5b | その審査用アカウントで**主要導線がすべて通る**（有料機能があるならエンタイトルメント付与済み）。毎回作り直して失効させない |
| 6 | 各コマンドを `--dry-run` で流し、差分が意図どおりだった |
| 7 | `app.json` を触ったなら `expo prebuild` の**生成物を実測**した（`store-review.md` §6） |
