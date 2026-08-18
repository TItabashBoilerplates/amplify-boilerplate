---
description: "Authentication policy - mobile apps must support email + password (never OTP-only); reset flows are mandatory"
alwaysApply: true
globs: ["frontend/**/*.ts", "frontend/**/*.tsx"]
---
# Authentication Method Policy (Cognito)

**MANDATORY**: **モバイルアプリ（Expo / RN。ストア配布）を実装する場合、主たるログイン手段は必ず
「メールアドレス + パスワード」。OTP / passkey を唯一のログイン手段にしてはならない。**

正本: `/.claude/rules/auth.md`

## 理由（好みではなく審査要件）

App Store Review Guideline **2.1(a)** は審査担当者への「**an active demo account** ...
**login credentials**」提供を求める。**OTP しか無いと担当者はコードが届く受信箱に触れられず、
ログインできないまま 2.1 リジェクト**になる。OAuth / passkey / OTP の**併用は可**。

## Cognito 固有（後から直せない / 直しにくい）

- **サインイン方式は初回デプロイ後 immutable**。`loginWith.email: { otpLogin: true }` の 1 行で
  **password と Email OTP の両方**が first factor になるので、最初からこの設定にしておく
- **`UserAttributeUpdateSettings.AttributesRequireVerificationBeforeUpdate: ['email']` は必須**。
  無いと `updateUserAttributes({ email })` の時点で email が置き換わり、
  **旧アドレスでも新アドレスでもログインできなくなる**（アカウント喪失）
- **MFA とパスワードレスは併用不可**

## 必ず実装する導線

| 導線 | 置き場所 |
|---|---|
| メールアドレスの再設定 | 設定 / アカウント画面（**認証方式を問わず必須**） |
| パスワードを忘れた方 | **ログイン画面**（忘れた人はログイン後の画面に到達できない） |
| パスワードの変更 | 設定 / アカウント画面 |
| アカウント削除 | 設定 / アカウント画面（App Store 5.1.1(v)。モバイルは必須） |

## 実装（`aws-amplify/auth`）

- `signIn` / `signUp` の **`nextStep` を必ず分岐**（`CONFIRM_SIGN_UP` / `RESET_PASSWORD` を
  握りつぶすとログイン画面が行き止まりになる）
- パスワード変更は **`updatePassword({ oldPassword, newPassword })`**。
  `signIn` を検証目的で呼ばない（新セッション発行の副作用）
- パスワード再設定は **Web / Mobile とも 6 桁コード方式**（`resetPassword` → `confirmResetPassword`）
- SDK は **throw する**ので api 層で catch し、**英語文言ではなく i18n キー**を返す
- 認可判断はサーバー側で `runWithAmplifyServerContext` + `aws-amplify/auth/server`
- Mobile は `cognitoUserPoolsTokenProvider.setKeyValueStorage()` を設定（無いと毎回ログイン）
- `UserNotFoundException` / `UsernameExistsException` を画面に出さない（ユーザー列挙）
