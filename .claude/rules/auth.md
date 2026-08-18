# 認証方式ポリシー（Mobile はメール + パスワード必須 / 再設定導線は必須実装）

**CRITICAL / NON-NEGOTIABLE**: **モバイルアプリ（Expo / React Native。ストアに配布するもの）を実装する場合、
主たるログイン手段は必ず「メールアドレス + パスワード」にする。OTP / passkey を唯一のログイン手段に
してはならない。** Web だけで完結するプロダクト（モバイルアプリを出さない）であれば OTP / passkey を
主手段にしてよい。

加えて、**認証方式が OTP であってもメール + パスワードであっても、アプリ内に「メールアドレスの再設定」
導線を必ず用意する**。メール + パスワードの場合は、さらに **ログイン画面の「パスワードを忘れた方」導線**と
**設定画面の「パスワード変更」導線**を必ず用意する。

これらは「あとで足せばいい機能」ではない。**認証はアカウントの入口であり、入口を失ったユーザーは
自力で復帰できない**（メールアドレスが変わった / パスワードを忘れた ＝ サポート問い合わせ以外に手段が無い）。
さらにモバイルでは**ストア審査で実際に落ちる**。

> **Cognito 固有の最重要事項**: **サインイン方式（`loginWith`）は初回デプロイ後 immutable**。
> あとから「やっぱりパスワードも」は User Pool 作り直しになる。**だから最初から
> `loginWith.email: { otpLogin: true }` にしておく** — この 1 行で
> **「メール + パスワード」と「Email OTP」の両方が first factor として有効**になる（§3.0）。

---

## 0. なぜモバイルで OTP を主手段にしてはいけないか（ファクト）

**App Store Review Guideline 2.1(a) — App Completeness**:

> Provide App Review with full access to your app. If your app includes account-based features,
> provide either **an active demo account** or fully-featured demo mode, plus any other hardware or
> resources that might be needed to review your app (e.g. **login credentials** or a sample QR code)

App Store Connect の「App Review Information」に渡せるのは **ユーザー名とパスワードの組**である。
ログインが OTP / passkey しか無いと、**審査担当者は 6 桁コードが届く受信箱にアクセスできない**
（毎回こちらが受信箱を見て口頭で伝えるわけにもいかない）。結果として

- 「アプリにログインできず審査できない」で **2.1 リジェクト**
- 回避のためにテスト用の固定コードや審査用バックドアを入れると、**それ自体が新たな指摘対象**になる

という詰みが発生する。Google Play も同様に、レビュー用のテストアカウント資格情報の提出を求める。

> **要するに**: 「レビュー担当者が、こちらの受信箱に触れずに、渡された資格情報だけでログインし切れるか」。
> メール + パスワードならこれが常に成立する。OTP は成立しない。

補助的な手段としての Email OTP / passkey（WebAuthn）/ ソーシャルは**併用してよい**（メール + パスワードで
必ずログインできる状態が保たれている限り）。禁止しているのは「パスワードで入れない」状態である。

---

## 1. 認証方式の決定表（実装前に必ずここを見る）

| プロダクトの形 | 主たるログイン手段 | 備考 |
|---|---|---|
| **モバイルアプリがある**（Expo / RN。ストア配布する / する予定がある） | **メール + パスワード（必須）** | Email OTP / passkey / ソーシャルは**併用可**。ただしメール + パスワードだけで完結できること |
| **Web のみで完結**（モバイルアプリを出さない） | Email OTP / passkey で可 | メール + パスワードにしてもよい |
| **Web + モバイルの両方**（同一 Cognito User Pool でアカウント共有） | **両方をメール + パスワードに揃える** | 同じ資格情報で両方に入れること。Web 側は OTP を**併用**してよいが、パスワードログインを必ず持たせる |
| PWA だけ（ストアに出さない） | OTP で可 | ストアに出す判断が出た時点で本ポリシーの対象になる |

**判断に迷う点（＝ユーザーに確認すべき点）**:

- 「将来モバイルを出す可能性があるか」が不明なとき。**Cognito では後からの移行が特に高くつく**
  （サインイン方式は immutable なので User Pool の作り直し ＝ 全ユーザーの移行が必要）。
  本ボイラープレートの既定 `otpLogin: true` は**両方を有効にする**設定なので、
  迷ったらこの既定のまま「パスワードのフォームも実装しておく」のが安全。ただし
  プロダクト方針に関わるので**推測で決めない**。
- ソーシャル（Google / Apple）を主にしたい場合。**Apple でサインインの提供義務**（他のソーシャル
  ログインを出すなら Apple も出す）等の別要件が絡むので、実装前に確認する。

---

## 2. 必ず実装する導線（MANDATORY）

| # | 導線 | OTP（Web 完結） | メール + パスワード | 置き場所 |
|---|---|---|---|---|
| 1 | **メールアドレスの再設定** | **必須** | **必須** | 設定 / アカウント画面 |
| 2 | **パスワードを忘れた方**（未ログインからの復旧） | — | **必須** | **ログイン画面から到達できること** |
| 3 | **パスワードの変更**（ログイン中） | — | **必須** | 設定 / アカウント画面 |
| 4 | **アカウント削除** | モバイルは必須 | モバイルは必須 | 設定 / アカウント画面（`.claude/rules/store-review.md` §4） |

**「適切な場所」の解釈**（迷ったらこれに従う）:

- **1 / 3 / 4 は同じ「アカウント設定」画面にまとめる**。ユーザーは「自分の情報を変えたい」ときに
  設定画面を探すのであって、機能ごとに別の場所を探しはしない。
- **2 はログイン画面に置く**。パスワードを忘れた人は**ログインできない**のだから、
  ログイン後の画面に置いても意味が無い（実際にやりがちな設計ミス）。パスワード入力欄の直下に
  「パスワードをお忘れですか？」を置くのが標準形。
- モバイルではタブや Drawer の階層に埋めすぎない。**設定画面から 1 タップで到達**できること。

**すべての文言は i18n 必須**（`en` / `ja` 両方。`.claude/rules/i18n.md`）。

---

## 3. 実装（Amplify Auth / Cognito。API は推測せず下記に従う）

**認証は絶対に自作しない**（`.claude/rules/minimal-implementation.md`）。`aws-amplify/auth` の標準 API を使う。
実装ガイドは `.claude/skills/amplify-gen2`（`references/auth.md`）。

> **Amplify Auth のエラー契約は Amplify Data と違う**: `aws-amplify/auth` の関数は
> **`{ data, errors }` を返さず throw する**。したがって `features/auth/api/*` の各関数は
> `try/catch` で受けて **`{ success: true } | { error: string }` を返す**（`.claude/rules/error-handling.md`
> の「Boundary で catch」に相当。catch では必ず `console.error` する）。

### 3.0 backend（`defineAuth`）— この 1 行で両方が有効になる

```typescript
// frontend/packages/backend/amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: {
    email: { otpLogin: true }, // ← メール+パスワード と Email OTP の両方が first factor になる
  },
})
```

公式（Passwordless）:「In this configuration, users can authenticate using either: **Email and
password (traditional)** [or] **Email OTP (passwordless)**.」

- **MFA とパスワードレス（OTP / passkey）は併用不可**（Cognito 制約）。`multifactor` を足さない。
- **パスワードポリシーと「メール変更時の安全性」は `defineAuth` に露出していない**ので
  `backend.ts` の CDK オーバーライドで設定する（§4）。

### 3.1 サインアップ / ログイン

```ts
import { signUp, confirmSignUp, autoSignIn, resendSignUpCode, signIn } from 'aws-amplify/auth'

// サインアップ（Cognito が確認コードをメールする）
const { nextStep } = await signUp({
  username: email,
  password,
  options: { userAttributes: { email }, autoSignIn: { authFlowType: 'USER_AUTH' } },
})
// nextStep.signUpStep: 'CONFIRM_SIGN_UP' | 'COMPLETE_AUTO_SIGN_IN' | 'DONE'

await confirmSignUp({ username: email, confirmationCode: code })
await autoSignIn()               // nextStep が COMPLETE_AUTO_SIGN_IN のとき
await resendSignUpCode({ username: email })

// パスワードでログイン
const { nextStep: signInStep } = await signIn({ username: email, password })
// signInStep.signInStep: 'CONFIRM_SIGN_UP' | 'CONFIRM_SIGN_IN_WITH_*' | 'RESET_PASSWORD' | 'DONE'
```

**`nextStep` を必ず分岐する**。とくに:

- `'CONFIRM_SIGN_UP'` → 未確認ユーザー。確認コード画面へ送る（「パスワードが違います」と出さない）。
- `'RESET_PASSWORD'` → 管理者がリセットを要求した状態。**パスワード再設定導線（§3.2）へ送る**。
  ここを握りつぶすとユーザーがログイン画面で行き止まりになる。

### 3.2 パスワードを忘れた（未ログインからの復旧）

**Web / Mobile とも同じ 6 桁コード方式**（Cognito のパスワードリセットはコードベースなので、
プラットフォームごとに実装を分ける必要が無い。ディープリンクも不要）。

```ts
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth'

// 1. ログイン画面 →「パスワードを忘れた方」→ コードを送る
const { nextStep } = await resetPassword({ username: email })
// nextStep.resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' | 'DONE'

// 2. 届いたコード + 新パスワードで確定
await confirmResetPassword({ username: email, confirmationCode: code, newPassword })
```

**「パスワードを忘れた」の応答はメールの存在を漏らさない**。送信できてもできなくても
「登録があればメールを送りました」と表示する（ユーザー列挙攻撃の防止）。
とくに `UserNotFoundException` を**そのまま画面に出さない**。

### 3.3 パスワードの変更（ログイン中）

**現在のパスワードの検証は Cognito 側が行う。`signIn` を「検証目的で」呼ぶのは誤り**
（新しいセッションが発行される副作用があり、公式の手順でもない）。

```ts
import { updatePassword } from 'aws-amplify/auth'

await updatePassword({ oldPassword, newPassword })
// oldPassword が違えば NotAuthorizedException を throw する（＝Cognito が検証している）
```

- 変更成功後は**他端末のセッションを落とすか**を設計として決める
  （`signOut({ global: true })` で全端末のトークンを失効させられる）。
  黙って全端末を維持するのも全端末を落とすのも、どちらも「決めていない」状態にしない。
- Cognito は**パスワード変更の通知メールを自動送信しない**。乗っ取りにユーザー自身が気づける
  手段が無くなるので、**変更完了時に SES で通知メールを送る**（`.claude/rules/aws-first.md`:
  メール送信は SES）。実装しない判断をするなら理由を残す。

### 3.4 メールアドレスの再設定

```ts
import { updateUserAttributes, confirmUserAttribute, sendUserAttributeVerificationCode } from 'aws-amplify/auth'

const { nextStep } = await updateUserAttributes({ userAttributes: { email: newEmail } })
// nextStep.email.updateAttributeStep: 'CONFIRM_ATTRIBUTE_WITH_CODE' | 'DONE'

await confirmUserAttribute({ userAttributeKey: 'email', confirmationCode: code })
// コードを再送する場合
await sendUserAttributeVerificationCode({ userAttributeKey: 'email' })
```

> **⚠️ ここが Cognito 最大の落とし穴**: 既定では、`updateUserAttributes` を呼んだ瞬間に
> `email` 属性が**新アドレスへ書き換わり、`email_verified` が false になる**。この状態のユーザーは
> **旧アドレスでも新アドレスでもログインできなくなる**（＝アカウントを失う）。
>
> **`UserAttributeUpdateSettings.AttributesRequireVerificationBeforeUpdate = ['email']` を必ず設定する**
> （§4）。設定すると**新アドレスの検証が完了するまで旧アドレスが有効なまま**になり、
> Supabase の `double_confirm_changes` に相当する安全性が得られる。
> **この設定はコードを書く前に入れる**（入れ忘れたまま検証すると、実際にユーザーが締め出される）。

- UI 上「新しいアドレスに確認コードを送りました。**確認が完了するまで現在のアドレスでログインできます**」
  と明示する（説明しないと「変わっていない」という問い合わせになる）。
- Amplify Data 側にメールアドレスを複製している場合、**`confirmUserAttribute` の成功後に同期する**
  （確認前に自前のモデルを書き換えない）。

### 3.5 アカウント削除

```ts
import { deleteUser } from 'aws-amplify/auth'
await deleteUser() // サインイン中の Cognito ユーザーを完全削除する
```

- **`deleteUser()` は Cognito ユーザーだけを消す。DynamoDB のデータは消えない。**
  Amplify Data 側の関連データは、**Cognito の postConfirmation ではなく削除フローの一部として**
  明示的に消す（owner 認可のモデルを列挙して削除する Lambda を用意し、削除後にサインアウトする）。
  消し漏れは「退会したのにデータが残る」＝法令・審査の両面でリスクになる。
- 実行前に**再認証相当の確認**（メールアドレスの再入力等）を挟む。誤タップで消えてはならない。

### 3.6 パスワード強度

- **最低長は 8 文字未満にしない**。本リポジトリの既定は **12**。
- 大文字 / 小文字 / 数字 / 記号をすべて要求する（§4 の `passwordPolicy`）。
- **Cognito の「侵害された認証情報（compromised credentials）」検知は Threat protection
  （旧 advanced security）の機能で、上位の機能プランが必要**。有効化できないプランのときは
  黙って無効のままにせず、**その旨をユーザーに伝える**。
- ポリシーを強化しても**既存ユーザーは古いパスワードのままサインインできる**。強制的に更新させたい
  場合は管理者側でリセットを要求する（→ サインイン時に `nextStep = 'RESET_PASSWORD'` が返るので、
  §3.1 のとおり**必ず再設定導線へ送る**）。

### 3.7 クライアント設定（ここを外すと毎回ログインになる / 認可が壊れる）

**Mobile（Expo / RN）** — 必要なのは**ネイティブ依存と polyfill を揃えること**:

```ts
// apps/mobile/src/shared/lib/amplify.ts
// crypto.getRandomValues の polyfill。**Amplify より前に import する**
import 'react-native-get-random-values'
import { Amplify } from 'aws-amplify'
import outputs from '../../../amplify_outputs.json'

Amplify.configure(outputs)
```

Cognito のトークンは **`@react-native-async-storage/async-storage` へ自動的に永続化される**
（ブラウザの `localStorage` に相当）。**依存が入っていないとアプリ再起動でセッションが失われる**
ので、次の 4 つを必ず入れておく（`.claude/skills/amplify-gen2/references/react-native.md`）:

| 依存 | 役割 |
|---|---|
| `@aws-amplify/react-native` | RN アダプタ（crypto / app state 等のネイティブ要件の配線） |
| `@react-native-async-storage/async-storage` | **トークンの永続化先** |
| `@react-native-community/netinfo` | Data のリアルタイム（サブスクリプションの接続状態） |
| `react-native-get-random-values` | `crypto.getRandomValues` の polyfill。**`aws-amplify` より前に import** |

> トークンを**暗号化ストレージ（`expo-secure-store` 等）に置き換えたい**ときだけ
> `cognitoUserPoolsTokenProvider.setKeyValueStorage(...)` を使う。
> 既定の永続化のために呼ぶ必要は無い。

**Server（Next.js / `@aws-amplify/adapter-nextjs`）** — **クライアント由来の値でページを保護しない**:

```ts
// Server Component / Server Action / proxy
import { getCurrentUser } from 'aws-amplify/auth/server'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'

const user = await runWithAmplifyServerContext({
  nextServerContext: { cookies },
  operation: (contextSpec) => getCurrentUser(contextSpec),
})
```

- 認可判断は**サーバー側で `runWithAmplifyServerContext` を通した結果**で行う。
  Client Component が持っている `useAuthUser()` の値をサーバーの判断根拠にしない。
- `Amplify.configure` は**アプリごとに 1 か所だけ**（web は `ConfigureAmplifyClientSide`、
  mobile は `shared/lib/amplify.ts`）。feature の中で呼ばない。

---

## 4. backend 側の必須設定（`amplify/`）

```typescript
// frontend/packages/backend/amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: { email: { otpLogin: true } },   // ← password + Email OTP。immutable なので最初から
  accountRecovery: 'EMAIL_ONLY',
})
```

```typescript
// frontend/packages/backend/amplify/backend.ts
const { cfnUserPool } = backend.auth.resources.cfnResources

// パスワード強度（defineAuth に露出していないので L1 で設定する）
//
// ⚠️ `cfnUserPool.policies = { passwordPolicy: ... }` と**代入してはならない**。
// `otpLogin: true` が設定する `Policies.SignInPolicy.AllowedFirstAuthFactors` ごと
// 吹き飛び、**OTP ログインが無言で壊れる**。サブキーだけを上書きする。
cfnUserPool.addPropertyOverride('Policies.PasswordPolicy.MinimumLength', 12)
cfnUserPool.addPropertyOverride('Policies.PasswordPolicy.RequireLowercase', true)
cfnUserPool.addPropertyOverride('Policies.PasswordPolicy.RequireUppercase', true)
cfnUserPool.addPropertyOverride('Policies.PasswordPolicy.RequireNumbers', true)
cfnUserPool.addPropertyOverride('Policies.PasswordPolicy.RequireSymbols', true)

// ⚠️ 必須: メール変更中も旧アドレスを有効に保つ（無いとユーザーが締め出される。§3.4）
cfnUserPool.addPropertyOverride(
  'UserAttributeUpdateSettings.AttributesRequireVerificationBeforeUpdate',
  ['email'],
)

// ユーザー列挙エラーの抑止（サインインで UserNotFoundException を返さない）
backend.auth.resources.cfnResources.cfnUserPoolClient.preventUserExistenceErrors = 'ENABLED'
```

- **メール文面（確認コード / 招待）** は `defineAuth` の `senderEmail` / email customization、
  もしくは Cognito のメッセージテンプレートで設定する。**多言語が要るなら
  customMessage Lambda トリガーで出し分ける**（Cognito のテンプレートは単一言語）。
- **Cognito の既定メール送信は 1 日あたりの上限が非常に小さい。本番は必ず Amazon SES に切り替える**
  （Email OTP を使う場合は SES が前提。`.claude/skills/amplify-gen2/references/auth.md`）。

---

## 5. 配置（FSD）

```
features/auth/
├── ui/          # LoginForm / PasswordLoginForm / SignUpForm / ForgotPasswordForm /
│                # UpdatePasswordForm / ChangeEmailForm / ChangePasswordForm /
│                # DeleteAccountForm                          → Storybook 必須・単体テスト不要
├── model/       # バリデーション・フォーム状態・required-flows.test.ts  → 単体テスト必須（TDD）
└── api/         # signUpWithPassword / signInWithPassword / signInWithOtp /
                 # verifyOtp / resendOtp / requestPasswordReset / updatePassword /
                 # changePassword / changeEmail / deleteAccount / signOut
                                                              → 単体テスト必須（TDD）

views/auth/          # ログイン / サインアップ / パスワード再設定の画面
views/account/       # 設定画面（メール変更・パスワード変更・アカウント削除）
```

- **Web と Mobile で同じ関数をコピペしない**。共有できるロジック（バリデーション、
  Cognito 例外名 → 表示メッセージのマッピング）は `frontend/packages/*` に置く
  （`.claude/rules/clean-code.md` / `minimal-implementation.md`）。
- パスワード入力欄も**フォーム要素の 16px 規約**の対象（`.claude/rules/form-controls.md`）。

---

## 6. テスト

| 対象 | 要求 |
|---|---|
| `features/auth/api/*` / `model/*` | **単体テスト必須（TDD）**。成功・失敗・`nextStep` 分岐・エラーメッセージ |
| `features/auth/ui/*` | **Storybook 必須**（初期 / 送信中 / エラー / 送信完了の各状態）。単体テストは不要 |
| 必須導線の存在 | `features/auth/model/required-flows.test.ts` が §2 の導線の実装を静的に検査する（消さない） |
| E2E | Maestro でログイン〜パスワード再設定〜メール変更の往復を通す |

**「送信できた」で終わらせない**。パスワード再設定もメール変更も、**コードを受け取って確定するまでが
1 本のフロー**であり、そこを踏まないテストは壊れていることに気づけない。

---

## 7. ストア提出時（モバイル）

- **審査メモに、失効しないレビュー用アカウントのメールアドレスとパスワードを書く**。
  毎回作り直して失効させない。
- レビュー用アカウントで**アプリの主要導線がすべて通る**こと。
- **アプリ内アカウント削除**は必須（`.claude/rules/store-review.md` §4）。

---

## 8. 禁止パターン

```ts
// ❌ モバイルアプリのログインを OTP / passkey のみで実装する（審査で詰む）
await signIn({ username: email, options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' } })
//   ← これ*しか*無い状態

// ❌ 審査を通すために、特定アカウントだけ固定コードで入れるバックドアを仕込む

// ❌ メールアドレス変更の導線が無い（ユーザーがアカウントを失う）
// ❌「パスワードを忘れた方」をログイン後の画面にだけ置く（忘れた人は到達できない）
// ❌ 設定画面にパスワード変更が無い（漏洩時に自力で変えられない）

// ❌ AttributesRequireVerificationBeforeUpdate を設定せずにメール変更を実装する
//    （検証完了前に email が置き換わり、旧アドレスでも新アドレスでもログインできなくなる）

// ❌ 現在のパスワードの「検証」を signIn で代用する（新セッション発行の副作用。
//    正しくは updatePassword({ oldPassword, newPassword }) で Cognito に検証させる）

// ❌ signIn の nextStep を無視する（RESET_PASSWORD / CONFIRM_SIGN_UP のユーザーが行き止まりになる）
const { isSignedIn } = await signIn({ username, password })
if (!isSignedIn) return { error: 'ログインに失敗しました' }   // ← 何が必要なのか分からない

// ❌ サーバー側でクライアントの認証状態を信じてページ・データを保護する
//    （runWithAmplifyServerContext + aws-amplify/auth/server を使う）

// ❌ Mobile で AsyncStorage / @aws-amplify/react-native を入れず、起動のたびにログインさせる
// ❌ react-native-get-random-values を aws-amplify より後に import する（認証が落ちる）

// ❌ パスワード再設定で「そのメールアドレスは登録されていません」と返す（ユーザー列挙）
//    UserNotFoundException をそのまま画面に出さない

// ❌ deleteUser() だけ呼んで Amplify Data の関連データを残す

// ❌ 認証・セッション・パスワードハッシュを自作する
```

---

## 9. チェックリスト（認証を実装・変更したら必ず）

| # | 確認 |
|---|---|
| 1 | モバイルがある（出す予定がある）なら、メール + パスワードだけでログインし切れるか |
| 2 | `defineAuth` が `email: { otpLogin: true }`（＝password + OTP 両方）になっているか |
| 3 | メールアドレス再設定が設定画面にあるか |
| 4 | **`AttributesRequireVerificationBeforeUpdate: ['email']` を設定したか**（§3.4 / §4） |
| 5 | 「パスワードを忘れた方」が**ログイン画面**から到達できるか |
| 6 | 設定画面にパスワード変更があり、`updatePassword({ oldPassword, newPassword })` で検証しているか（`signIn` での代用になっていないか） |
| 7 | `signIn` / `signUp` / `updateUserAttributes` の `nextStep` をすべて分岐しているか |
| 8 | `passwordPolicy`（最低 12 文字 + 4 種）を設定したか |
| 9 | 5 状態（初期 / 送信中 / 成功 / 失敗 / レート制限）の UI があるか |
| 10 | Mobile の必須ネイティブ依存 4 つが揃っているか / Server が `runWithAmplifyServerContext` を通しているか |
| 11 | 文言が en / ja 両方あるか |
| 12 | api / model に単体テスト、ui に Storybook、`required-flows.test.ts` があるか |
| 13 | モバイルならアカウント削除導線（+ 関連データ削除）があり、審査メモの資格情報が有効か |
| 14 | 本番のメール送信が SES 経由になっているか（Cognito 既定の送信上限に張り付いていないか） |

---

## 10. 強制事項

このポリシーは**交渉の余地なし**。

- **モバイルアプリのログインを OTP / passkey のみで実装した PR はレビューで却下**する。
- **メールアドレス再設定の導線が無い実装は却下**する（認証方式を問わない）。
- **メール + パスワードでログイン画面の「パスワードを忘れた方」または設定画面のパスワード変更が
  欠けている実装は却下**する。
- **`AttributesRequireVerificationBeforeUpdate` 無しのメール変更実装は却下**する。
- 「開発者から指示が無かった」は理由にならない。**これらは指示を待たずに最初から入れる**。
- 将来モバイルを出すかが不明で認証方式が決められない場合、および ソーシャルを主手段にしたい場合は、
  **推測で進めずユーザーに確認**する。

## 参考

- [App Store Review Guidelines 2.1 App Completeness](https://developer.apple.com/app-store/review/guidelines/#app-completeness) — demo account / login credentials
- [App Store Review Guidelines 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage) — アプリ内アカウント削除
- [Amplify Gen2: Passwordless](https://docs.amplify.aws/react/build-a-backend/auth/concepts/passwordless/) — `otpLogin: true` で password と Email OTP が共存する / MFA とは併用不可
- [Amplify Gen2: Sign-in](https://docs.amplify.aws/react/build-a-backend/auth/connect-your-frontend/sign-in/) — `signIn` の `nextStep`
- [Amplify Gen2: Manage user attributes](https://docs.amplify.aws/react/build-a-backend/auth/connect-your-frontend/manage-user-attributes/) — `updateUserAttributes` / `confirmUserAttribute`
- [Cognito: UpdateUserAttributes / UserAttributeUpdateSettings](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_UpdateUserAttributes.html) — `AttributesRequireVerificationBeforeUpdate`
- `.claude/rules/store-review.md` / `.claude/rules/aws-first.md` / `.claude/skills/amplify-gen2/references/auth.md`
