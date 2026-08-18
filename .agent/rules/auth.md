# Authentication Method Policy（認証方式と再設定導線）

**MANDATORY**: **モバイルアプリ（Expo / RN。ストア配布）を実装する場合、主たるログイン手段は必ず
「メールアドレス + パスワード」。OTP / passkey を唯一のログイン手段にしてはならない。**
Web だけで完結する（モバイルを出さない）プロダクトなら OTP / passkey を主手段にしてよい。

正本: `/.claude/rules/auth.md`

## なぜモバイルで OTP のみが禁止か

App Store Review Guideline **2.1(a)** は審査担当者への「**an active demo account** ...
**login credentials**」提供を求める。**OTP しか無いと担当者はコードが届く受信箱に触れられず、
ログインできないまま 2.1 リジェクト**になる。審査用のバックドアや固定コードでの回避は別の指摘対象。
Google Play も同様にテスト用アカウントの資格情報を求める。

OAuth / passkey / OTP の**併用は可**。禁止しているのは「パスワードで入れない」状態。

## Cognito 固有（あとから直せない / 直しにくい）

| 事項 | 内容 |
|---|---|
| サインイン方式は **initial deploy 後 immutable** | `loginWith.email: { otpLogin: true }` の 1 行で **password と Email OTP の両方**が first factor になる。最初からこの設定にしておく |
| `AttributesRequireVerificationBeforeUpdate: ['email']` は **必須** | 無いと `updateUserAttributes({ email })` の時点で email が置き換わり、**旧アドレスでも新アドレスでもログインできなくなる**（アカウント喪失） |
| MFA とパスワードレスは **併用不可** | `multifactor` を足さない |
| `passwordPolicy` は `defineAuth` に無い | `backend.ts` で `Policies.PasswordPolicy.*` を L1 オーバーライド。**`cfnUserPool.policies` への代入は SignInPolicy を吹き飛ばして OTP を壊す** |

## 必ず実装する導線

| 導線 | 置き場所 |
|---|---|
| メールアドレスの再設定 | 設定 / アカウント画面（**認証方式を問わず必須**） |
| パスワードを忘れた方 | **ログイン画面**（忘れた人はログイン後の画面に到達できない） |
| パスワードの変更 | 設定 / アカウント画面 |
| アカウント削除 | 設定 / アカウント画面（App Store 5.1.1(v)。モバイルは必須） |

すべての文言は i18n（en + ja）。

## 実装（`aws-amplify/auth`）

- `signIn` / `signUp` の **`nextStep` を必ず分岐**する。`CONFIRM_SIGN_UP` /
  `RESET_PASSWORD` を握りつぶすとログイン画面が行き止まりになる
- パスワード変更は **`updatePassword({ oldPassword, newPassword })`**。
  `signIn` を検証目的で呼ばない（新セッション発行の副作用）
- パスワード再設定は Web / Mobile とも **6 桁コード方式**（`resetPassword` → `confirmResetPassword`）
- SDK は **throw する**（Amplify Data と違い `{ data, errors }` を返さない）。
  api 層で catch + ログし、**英語の原文ではなく i18n キー**を返す
- サーバー側の認可判断は `runWithAmplifyServerContext` + `aws-amplify/auth/server`
- Mobile はトークンが AsyncStorage へ**自動で**永続化される。`@aws-amplify/react-native` /
  `@react-native-async-storage/async-storage` / `@react-native-community/netinfo` /
  `react-native-get-random-values`（**`aws-amplify` より前に import**）を揃える
- `UserNotFoundException` / `UsernameExistsException` を画面に出さない（ユーザー列挙）
- `deleteUser()` は Cognito のユーザーだけを消す。**Amplify Data の関連データは別途削除**する

## 検査

`frontend/apps/web/src/features/auth/model/required-flows.test.ts` が、必須ルート・
ログイン画面のパスワード導線・アカウント設定の 3 フォーム・backend の必須設定・
i18n のキー集合を静的に検査する。**消さない。**
