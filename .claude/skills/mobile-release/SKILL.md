---
name: mobile-release
description: Expo / EAS のモバイルリリースを**ユーザーに届くところまで**回すための手順。ビルドとアップロード（クラウド / --local 両対応）に加え、**アップロード後**の TestFlight 配布・App Store の審査提出・Google Play のトラック昇格と段階的公開まで扱う。「アプリをリリースして」「TestFlight に上げて」「Play に出して」「審査に出して」「ストアに公開して」「段階的に配って」「ロールアウトを止めて」「審査を取り下げて」「リリースの状況を見て」「ビルドして提出して」「EAS でビルド」「mobile-release-ios」「アップロードしたのに配布されない / TestFlight に出ない」「起動直後にクラッシュする（EXPO_PUBLIC_* が焼き込まれていない）」といった指示・症状が出たら必ず最初に起動する。資格情報の扱い、eas.json への一時注入と復元、EAS への env push、審査中の版を壊さないための状態判断、既知のビルド失敗の回避策を提供する。
---

# モバイルリリース（EAS）

**リリースを指示されたら、手で `eas build` / `eas submit` を叩く前に必ず下記 script を使うこと。**
資格情報の復元・eas.json の注入と復元・env の push・既知バグの回避が全部入っている。

```bash
mobile-release-ios                 # expo.dev（EAS クラウド）でビルド → アップロード
mobile-release-ios --local         # ローカルビルド（macOS + Xcode。ビルド枠を消費しない）
mobile-release-android             # expo.dev でビルド → Play へアップロード
mobile-release-android --local     # ローカルビルド（要 devenv shell -P android）

mobile-release-ios --dry-run       # 何を実行するかだけ表示（ビルドも提出もしない）
mobile-metadata                    # store.config.js を App Store Connect へ同期するだけ
sync-eas-env production            # EXPO_PUBLIC_* を EAS へ同期するだけ
```

> ⚠️ **これらは「アップロードまで」で、リリースは完了しない。**
> TestFlight への配布・App Store の審査提出・Play のロールアウトは
> **§6 のコマンド**で行う。状態が分からなくなったら、まず書き込まない `store-status`。

実体は `scripts/mobile/release-ios.sh` / `release-android.sh` / `sync-eas-env.sh`（共通部は `lib.sh`）。

---

## ⚠️ 資格情報は AWS SSM Parameter Store（最初に理解すること）

**Apple / Google / Expo の資格情報は AWS SSM Parameter Store にある。** ファイルにも
`config.env` にもコードにも置かない（`.claude/rules/aws-first.md`: シークレットは SSM）。
**`eas login` も不要**（`EXPO_TOKEN` で認証する）。

各 script は起動時に **`mobile_load_secrets`（`lib.sh`）** を呼び、次の順で env に載せる:

```
mobile-release-ios
  └─ mobile_load_secrets
       1. 既に env にある値をそのまま使う   ← CI が GitHub Secrets から渡す場合はここで完結
       2. 無いものだけ aws ssm get-parameter --with-decryption で取得
          （${MOBILE_SECRETS_SSM_PREFIX}/<KEY>。既定 /amplify-boilerplate/mobile）
```

つまり **呼び出す側は何も準備しなくてよい**し、逆に「手で `eas build` を叩く」と
資格情報が無くて必ず失敗する。

登録は SecureString で行う:

```bash
aws ssm put-parameter --type SecureString \
  --name /amplify-boilerplate/mobile/EXPO_TOKEN --value <値>
```

> **`ampx sandbox secret set` とは別物**。あれは **Amplify backend（Lambda）が読む**
> シークレットで、こちらは**手元 / CI のリリース script が読む**シークレット。
> 混ぜない（backend が要らない値を Lambda に渡さない）。

### 守ること

- **値をチャット / ログ / コミット / PR に出さない**（会話はキー名だけ）。
  script も**キー名とファイルパスしか出力しない**。
- `.p8` / サービスアカウント JSON は **実行中だけ** `credentials/` に展開し、
  **`trap` で必ず消す**（`.gitignore` 済み・`chmod 600`）。
- **`AWS` / `AMPLIFY_` / `_` / `GITHUB_` 始まりのキー名を作らない**
  （`.claude/rules/env-naming.md`）。ここで使うキーはいずれも該当しない。
- **Amplify backend の接続情報（Cognito / AppSync / S3）をここに持ち込まない**。
  正本は `amplify_outputs.json` で、env に複製すると二重管理になる。

**非機密の設定だけが `scripts/mobile/config.env`**（アプリのパス / `APPLE_ASC_APP_ID` /
プロファイル名）。ここにシークレットを書いたらレビューで却下。

---

## 0. クラウド（expo.dev）とローカルのどちらを使うか

| | クラウド（既定） | ローカル（`--local`） |
|---|---|---|
| コマンド | `mobile-release-ios` | `mobile-release-ios --local` |
| 実体 | `eas build`（expo.dev のビルダー） | `eas build --local`（同じ設定で手元の Xcode / Gradle を回す） |
| EAS のビルド枠 | **消費する** | **消費しない** |
| 所要 | ~20-30 分（キュー待ち含む） | ~20-40 分（マシン依存） |
| 必要な環境 | 無し（Linux でも可） | iOS = macOS + Xcode / Android = JDK 17 + Android SDK |
| 成果物 | クラウドから .ipa / .aab をダウンロード | `--output` に直接生成 |

**成果物は同等**（同じ設定・同じ credentials を使う）。枠を節約したいときや、キューが
詰まっているときにローカルへ切り替える。判断がつかないときは既定（クラウド）でよい。

> ローカルビルドの公式な制約: プラットフォームを 1 つに絞る必要がある（`all` 不可）、
> キャッシュ無し、EAS の **secret 型** 環境変数は使えない、Windows 非対応。

---

## 1. 一度だけ必要な手作業（公開 API では自動化できない）

| プラットフォーム | やること |
|---|---|
| iOS | Apple Developer で Bundle ID を登録 → **App Store Connect にアプリレコードを作成** → 採番された **ASC App ID** を `scripts/mobile/config.env` の `APPLE_ASC_APP_ID` に記入 |
| Android | Play Console にアプリを作成 → サービスアカウントに権限を付与 |

`APPLE_ASC_APP_ID` が未設定だと `No suitable application records found` で落ちる。
これは App Store の URL（`apps.apple.com/app/id<数字>`）に出る**公開値**なので、
SSM ではなく非機密の `config.env` に置く。

### 設定ファイル

```bash
cp scripts/mobile/config.example.env scripts/mobile/config.env   # gitignore 済み
```

### 必要なシークレット（SSM。**値をチャット / ログ / コミットに出さない**）

| キー | 用途 |
|---|---|
| `EXPO_TOKEN` | EAS の認証（`eas login` は不要） |
| `APPLE_API_KEY` | App Store Connect API の **Key ID** |
| `APPLE_API_ISSUER` | 同 **Issuer ID** |
| `APPLE_API_KEY_P8` | 同 **秘密鍵(.p8)**。base64 でも PEM そのままでも可 |
| `APPLE_TEAM_ID` | Apple Developer の Team ID（ASC API キーからは自動検出できない） |
| `PLAY_SERVICE_ACCOUNT_JSON` | Play のサービスアカウント鍵。base64 でも生 JSON でも可 |
| `EXPO_PUBLIC_*` | アプリに焼き込む公開値（§3） |

登録先は `${MOBILE_SECRETS_SSM_PREFIX}/<KEY>`（既定 `/amplify-boilerplate/mobile`）。
CI では env で渡してもよい（**env が SSM より優先される**）。

---

## 2. script が行うこと（＝手でやる場合の正しい順序）

1. **シークレットを注入**（env にあるものを優先し、無いものを SSM から取得）
2. **資格情報を実行中だけ復元** — `.p8` / サービスアカウント JSON を
   `frontend/apps/mobile/credentials/`（gitignore 済み・`chmod 700`）へ。**trap で必ず消す**
3. **eas.json へ ASC 資格情報を注入**（iOS のみ。§4）
4. **`EXPO_PUBLIC_*` を EAS の Environment Variables へ push**（§3）
5. **ビルド**（クラウド or ローカル）
6. **提出** — iOS は `eas submit`（`--submit-via altool` で Apple 公式 CLI）、Android は `eas submit`
7. **メタデータ同期** — `store.config.js` があれば `eas metadata:push`

---

## 3. `EXPO_PUBLIC_*` の EAS への push は必須

`eas.json` の各ビルドプロファイルは `"environment": "production"` で **EAS 側の**
Environment Variables を参照する。手元の env はビルドマシンに届かないので、橋渡ししないと
`EXPO_PUBLIC_*` がバンドルに入らず、**ビルドしたアプリがその値を使う画面でクラッシュする**。

> ⚠️ **Amplify backend の接続情報はここで運ばない。** Cognito / AppSync / S3 の値は
> `amplify_outputs.json` が正本で、`EXPO_PUBLIC_` を付けて env に複製してはならない
> （`.claude/rules/env-naming.md` §4）。ここで運ぶのは、それ以外の公開設定値
> （外部 API の公開 URL・機能フラグ等）だけである。

- 対象は env にある **`EXPO_PUBLIC_*` 全部**。この prefix は「バンドルに出てよい公開値」を
  意味するので、prefix 自体が安全性の判定条件になっている。
  **`EXPO_PUBLIC_` の付かないサーバ側 secret を EAS へ送ってはならない**
  （バンドルから読み出せるため）。
- **EAS は空文字の変数を拒否する**（`Variable value can not be empty`）。script は空値を
  push しないが、**落としたキーは必ず表示する**（黙って減らさない）。
- ENV → EAS environment の対応:

| `ENV` | EAS environment | eas.json profile |
|---|---|---|
| `production` | `production` | `production` |
| `staging` | `preview` | `preview` |
| `dev` | `development` | `development` |

---

## 4. eas.json は「コミット対象なのに実行中だけ汚す」— 復元を必ず守る

`eas submit` に ASC 資格情報を渡す **CLI フラグは無く**、**eas.json は環境変数展開にも
対応していない**。したがって実行中だけ注入するしかない。

script は次の順で安全を担保している。**手で真似するときも同じ順序を守ること**:

1. **バックアップを取る前に、まず注入の残骸を洗う**
   （前回 SIGKILL 等で trap が走らなかった内容をそのまま backup すると
   「復元しても汚れたまま」が恒久化する。実際にそうなった事例がある）
2. `cp` でバックアップ
3. 注入 → ビルド / 提出
4. `trap` で復元。復元後にまだ汚染キーが残っていたら `git checkout` で戻す

注入されるキー: `ascApiKeyPath` / `ascApiKeyId` / `ascApiKeyIssuerId` / `ascAppId` /
`credentialsSource`。**コミット版の eas.json にこれらが 1 つでもあったら汚染**なので、
`git diff frontend/apps/mobile/eas.json` は毎回確認する。

---

## 5. 既知のビルド失敗と回避策（すべて script に入っている）

| 症状 | 原因 / 回避策 |
|---|---|
| iOS ローカルビルドが `-index-store-path` 等で落ちる | devenv(Nix) の C/リンカ env が `xcodebuild` に干渉する。`SDKROOT` / `LDFLAGS` / `NIX_*` を `env -u` で外し、`DEVELOPER_DIR` を Xcode に固定する |
| iOS ローカルビルドが原因不明の "unknown error" | fastlane の `xcodebuild -showBuildSettings` が既定 3 秒 × 4 回で足りない。`FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=180` / `..._RETRIES=5` |
| Android ローカルビルドが `ninja: error: ... libworklets.so ... missing` | macOS の `/tmp` は `/private/tmp` へのシンボリックリンクで、CMake と Ninja が論理/物理パスを取り違える（expo/expo#42893, reanimated#9151）。`EAS_LOCAL_BUILD_WORKINGDIR` をリンクを経由しない場所にする |
| Android ビルドが Gradle の分かりにくいエラーで落ちる | JDK が 17 でない / `platforms/android-<targetSdkVersion>` が無い。script は先に検査して落とす |
| クラウドビルド後に `.ipa` の URL が取れない | `--json` の成果物 URL は `artifacts.applicationArchiveUrl`（トップレベルではない） |
| `No suitable application records found` | App Store Connect のアプリレコード未作成 / `APPLE_ASC_APP_ID` が違う |
| 初回ビルドが対話を要求して非対話で失敗 | 配布証明書が未作成。`credentials.json` があれば `credentialsSource: local` を注入（script が自動判定）。無い場合は一度だけ対話実行する |
| `eas submit` がキューで滞留する（iOS） | `--submit-via altool` で Apple 公式 CLI から直接送る（macOS + Xcode 必要） |
| altool が正常な .ipa を ITMS-90207 と誤判定 | Xcode 26.x の新アップローダの既知バグ。Apple 公式フラグ `--use-old-altool` で回避（script は常に付ける） |

---

## 6. アップロードの後がある（`mobile-release-*` はリリースを完了させない）

**`mobile-release-ios` / `-android` はバイナリを上げるまでで終わる。** その時点では

- **iOS**: Apple の Processing（数分〜30 分）待ち。**テスターにも届かず、審査にも出ていない**
- **Android**: `eas.json` の submit プロファイルが `releaseStatus: "draft"` なので
  **誰にも配られていない**

という状態で、以前はここから先を App Store Connect / Play Console で人が押していた。
**その部分もコマンドになっている**ので、手で画面を開かないこと。

```bash
store-preflight                    # ★ 初回。人が画面で入力するしかない申告を値つきで出す（資格情報不要）
store-status                       # ★ まずこれ。両ストアの状態と「次の一手」（書き込まない）

# iOS
store-testflight --wait            # 処理完了を待つ → グループ配布 → 外部なら Beta App Review
store-submit-ios                   # 版作成 → ビルド紐付け → ノート → 審査情報 → 審査提出
store-submit-ios --status          # 状態のみ / --cancel で取り下げ / --phased で段階的リリース

# Android
store-release-play --track internal --rollout 1                       # テスターへ配る
store-release-play --from internal --track production --rollout 0.1   # 本番へ 10%
store-release-play --track production --rollout 1                     # 全公開
store-release-play --track production --halt                          # ロールアウト停止
```

| 落とし穴 | 内容 |
|---|---|
| **`eas submit` は審査に出さない** | バイナリを上げるだけ。「提出」は別操作で、版の作成・ビルド紐付け・**審査担当者用のログイン情報**・3 段階の提出 API が要る |
| **Play は draft のままだと誰にも届かない** | 「アップロードしたのに反映されない」の最頻出原因 |
| **外部 TestFlight はグループに入れても届かない** | Beta App Review の通過が必要。画面上は入っているように見える |
| **審査中の版を編集すると審査が取り下がる** | `store-submit-ios` は状態を見て危険なら実行前に落ちる（判断は `release-plan.mjs`・テスト済み） |
| **`--rollout` の 0 と 1 は割合ではない** | 全公開は `--rollout 1`（= `completed`）、停止は `--halt` |

### 「API が無い」と思い込まない（自動化できるものを人にやらせない）

| 項目 | API | 手段 |
|---|---|---|
| **年齢レーティング** | ✅ `ageRatingDeclarations` | `store.config.js` の `apple.advisory` → `mobile-metadata`。**2026-01-31 以降、未回答だと提出できない** |
| **Play の Data safety** | ✅ `applications.dataSafety` | `store-push-data-safety`（CSV を POST）。**edits に乗らず即時反映・取り消し不可** |
| **Play のテスター登録** | ✅ `edits.testers` | Google グループ単位 |
| **App Privacy（Apple）** | ❌ | 画面。fastlane の upload は**非公式 API + Apple ID パスワード**なので使わない |
| **EU DSA トレーダーステータス** | ❌ | 画面。未申告だと**EU 27 か国で販売停止**（審査では弾かれない） |
| **Play のコンテンツレーティング / 対象年齢** | ❌ | 画面 |

**`store-preflight` が「何を・どこで・どんな値で」入力するかを出す**ので、
❌ の項目はその出力をそのままユーザーに提示する。

**手順・状態遷移表・人でしかできない作業は
[`docs/store/release-runbook.md`](../../../docs/store/release-runbook.md) が正本。**

### 審査情報は SSM（値をチャット・ログ・コミットに出さない）

| キー | 用途 |
|---|---|
| `APPLE_REVIEW_CONTACT_FIRST_NAME` / `_LAST_NAME` / `_EMAIL` / `_PHONE` | 審査担当者からの連絡先。**未設定だと `store-submit-ios` が落ちる** |
| `APPLE_REVIEW_DEMO_ACCOUNT` / `APPLE_REVIEW_DEMO_PASSWORD` | 審査用アカウント。ログインが要るアプリで無いと **2.1(a) でリジェクト** |
| `APPLE_REVIEW_NOTES` | 審査メモ（任意） |

---

## 6.5. ストア掲載用スクリーンショット（`screenshots-mobile`）

```bash
# 実機描画（simulator / emulator）
screenshots-mobile                      # 撮って検証（アップロードしない）
screenshots-mobile --platform android   # Android だけ（Linux はこちらのみ）
screenshots-mobile --skip-capture       # 撮影済み画像を検証だけ
screenshots-mobile --upload             # ★ ストアへ送信（明示指定が必要）

# Storybook から（ネイティブビルド不要。多ロケール × 多サイズの量産向き）
build-storybook && screenshots-storybook
screenshots-storybook --devices iphone-6-9 --locales ja
screenshots-storybook --allow-fidelity-warnings   # 忠実度警告を承知で続行

# 検証だけ単体で
screenshots-validate --platform ios store-listing/ios
```

撮影対象は `scripts/mobile/storybook-shots.config.mjs`（story id / 端末 / ロケール）で宣言する。

### 撮影経路は 2 つある。画面ごとに選ぶ

| 経路 | コマンド | 何を撮るか |
|---|---|---|
| **実機描画** | `screenshots-mobile` | simulator / emulator の実キャプチャ。**ネイティブ部品・shadow/elevation・セーフエリアが写る画面はこちら必須** |
| **Storybook** | `screenshots-storybook` | react-native-web の描画。**到達しづらい状態**（空・エラー・特定データ）や**多ロケール × 多サイズの量産**に強い。ネイティブビルド不要 |

Apple のガイドライン 2.3.3 が求めるのは「アプリが**使用されている状態**を示すこと」であって、
生のデバイスキャプチャであることではない（掲載画像は合成が主流）。
問題になるのは**実機と見た目が食い違うこと**なので、そこだけを機械的に検出する方針にしてある:
`screenshots-storybook` は撮影後に DOM を検査し、以下を見つけたら**警告して exit 1** する。

| 検出 | なぜ危険か |
|---|---|
| `native-control` | `input`/`textarea`/`select`/switch/slider/progressbar は RN では OS 提供の部品になり見た目が別物 |
| `shadow` | CSS `box-shadow` と iOS `shadow*` / Android `elevation` は描画が一致しない |
| `broken-image` | 撮ってから気づくと痛い |
| `theme-decorator` | 下記の既知バグ |

警告が出た画面は `screenshots-mobile` で撮り直す。意図的に許容するなら
`--allow-fidelity-warnings` を付ける。**どちらの経路も出力先・検証・アップロードは共通**。

> ⚠️ **既知バグ: reanimated の CSS アニメーションを含む story はテーマ切替が効かない**
> `HelloWave` のような reanimated CSS アニメーションを含む story では、
> addon-themes の `withThemeByClassName` の effect が実行されず、
> **Storybook 上でダークに切り替えても light のまま**になる（HomeScreen も HelloWave を含むため該当）。
> 撮影スクリプトは `<html>` のクラスを**強制適用したうえで検証**するので撮影結果は正しくなるが、
> `theme-decorator` 警告が出る。**Storybook を目視でデバッグするときはテーマ切替が効かない**点に注意。

### 絶対に間違えてはいけない 2 点

| # | 注意 |
|---|---|
| 1 | **Play の「最大辺 ≤ 最小辺 × 2」**。最近の Android 既定プロファイル（Pixel 7 = 1080x2400 = 2.22 倍）は**そのままだと弾かれる**。実機撮影なら 1080x1920 (16:9) の AVD を `ANDROID_SCREENSHOT_AVD` に指定する（Storybook 経路は 360x640 @3x = 1080x1920 で撮るので既に適合） |
| 2 | **実機撮影には simulator/emulator 用のビルドが要る**。ストア提出用の `.ipa` / `.aab` はインストールできない。`eas build --profile development-simulator --platform ios --local`（iOS）/ `--profile preview --platform android --local`（Android）。Storybook 経路はビルド不要 |

### 反映はストアの API を直接叩く（fastlane も EAS も使わない）

**EAS Metadata はスクリーンショットを扱えず、Google Play のストア掲載情報にも対応しない**
（[公式](https://docs.expo.dev/eas/metadata/) の対応表で "Upload screenshots ✗"）。
`mobile-release-ios` が使う `eas metadata:push` は **App Store の文言専用**。

画像と Play の掲載情報は `scripts/mobile/store.sh` が
App Store Connect API / Play Developer API を直接叩く（Node のみ・追加ランタイム不要）。

```bash
store-push-ios-screenshots --dry-run     # 差分だけ見る（必ず先に）
store-push-ios-screenshots
store-push-play-listing --dry-run        # Play は文言 + 画像が同じ edit
store-push-play-listing
```

`screenshots-mobile --upload` はこの 2 つへ委譲するので、**同じことをする経路は 1 つだけ**。

> 以前は fastlane（`deliver` / `supply`）を使っていたが、Ruby ランタイム一式を
> 引き込むわりに **`deliver` が解像度から端末クラスを推定する**ため、
> **iPad の画像を iPhone のセットへ入れる**取り違えが起きる。現在は
> `screenshotDisplayType` を明示して送っている。

### パイプライン

```
1. simulator/emulator 起動 + アプリインストール
2. Maestro (.maestro/store/screenshots.yaml) をロケール分だけ実行
   └ ロケール切替は端末設定ではなく **アプリ内の LocaleSwitcher をタップ**する方式
3. store-listing/ へ配置（ストア反映スクリプトが読む正本）
   iOS     : store-listing/ios/<locale>/                  （端末クラスは実ピクセルから判定）
   Android : store-listing/android/<play-locale>/phoneScreenshots/
4. ストア要求を検証 ← ここで落ちたら 5 に進まない
5. --upload 時のみ store.sh 経由でストアの API へ送信
```

出力物は `.gitignore` 済み（撮影→検証→送信を 1 回で回す前提）。

### 撮影対象を増やすとき

`.maestro/store/screenshots.yaml` に `takeScreenshot` を足す。
ロケール依存の文言は env（`HOME_TAB` / `EXPLORE_TAB` 等）で渡しているので、
**アプリの翻訳を変えたら `scripts/mobile/screenshots.sh` の `locale_meta()` も直す**
（ズレるとフローが要素を見つけられずタイムアウトする）。

---

## 6.6. ストアへの反映（掲載情報・課金商品）

ビルドと提出とは別に、**掲載情報と課金商品をストアへ反映する経路**がある。
すべて `scripts/mobile/store.sh`（資格情報の SSM 注入込み）。
**本番を書き換えるので必ず `--dry-run` を先に通す。**

```bash
mobile-metadata                    # App Store の文言（store.config.js → eas metadata:push）
store-push-ios-screenshots         # App Store のスクショ（EAS Metadata では出せない）
store-push-play-listing            # Play の文言 + アイコン + スクショ（1 つの edit）

# 課金商品（iap.config.js が両ストア共通の正本）— この順序で
store-create-ios-subscriptions
store-equalize-ios-prices          # ★ 省略すると MISSING_METADATA が永久に解消しない
store-create-play-subscriptions
store-create-play-offers           # 無料トライアル（作成 → activate）
```

| 落とし穴 | 内容 |
|---|---|
| **`store-equalize-ios-prices` を飛ばす** | 商品作成は基準地域の価格しか作らない。全地域で販売する設定なので、残りが「販売するのに価格が無い」状態になり **商品が永久に準備中のまま**になる。ローカライズもスクショも揃っているので原因が分かりにくい |
| **Play の base plan は DRAFT で作られる** | activate するまで購入できない。offer は script が activate するが、**base plan は Play Console で有効化する** |
| **有料 App 契約が未締結** | iOS の商品が MISSING_METADATA から動かない。API では解決できない |
| **productId は変更できない** | 作り直すと購入履歴が切れる |

初回提出までの全体手順は `docs/store/submission-checklist.md`、
掲載文の設計は `docs/store/aso.md`、審査要件の不変条件は `.claude/rules/store-review.md`。

---

## 7. リリース前に必ず通すこと

1. `ci-check`（lint / format / type-check）
2. `unit-test`（`store-metadata` / `release-plan` / `required-flows` の検査を含む）
3. `store-status` で**今の状態**を確認する（審査中の版に手を入れないため）
4. `mobile-release-ios --dry-run` で注入内容と push 対象キーを目視

**All Green でないままリリースしない**（`.claude/rules/tdd.md`）。

---

## 8. 完了報告に必ず含めること

- ビルドモード（クラウド / ローカル）と **profile**
- EAS へ push した **EXPO_PUBLIC_* のキー名**と、空値で落としたキー（値は出さない）
- 成果物のサイズ、提出先（TestFlight のグループ名 / Play の track）
- **eas.json が git のクリーンな状態に戻っていること**
- **リリースがどこまで進んだか** — 審査提出済みか、Play は何 % で配布中か
- **残っている手作業**（§4.2 の申告フォームなど。`docs/store/release-runbook.md` §4）

「ビルドが通った」で完了報告しないこと。**ユーザーに届いていないなら未完**であり、
どこで止まっていて誰が何をすれば進むのかまで書く。

---

## 参照

- **リリース手順の正本（状態遷移表・人でしかできない作業）**:
  [`docs/store/release-runbook.md`](../../../docs/store/release-runbook.md)
- 初回提出の全体手順: `docs/store/submission-checklist.md` / 掲載文: `docs/store/aso.md`
- 審査要件のコード側不変条件: `.claude/rules/store-review.md`
- EAS のビルドプロファイル・提出設定: `expo-deployment` / `expo-cicd-workflows` skill
- Expo のアップグレード: `upgrading-expo` skill
- シークレットの扱い: `.claude/rules/aws-first.md` / `.claude/rules/env-naming.md`
- 公式: [Local builds](https://docs.expo.dev/build-reference/local-builds/) /
  [Environment variables](https://docs.expo.dev/eas/environment-variables/) /
  [Submit to the App Store](https://docs.expo.dev/submit/ios/) /
  [eas.json reference](https://docs.expo.dev/eas/json/)
- ストア API（**エンドポイントの形は推測せず一次情報で確認する**）:
  [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)（OpenAPI 仕様が公開されている） /
  [Google Play Developer API: Edits](https://developers.google.com/android-publisher/edits)
