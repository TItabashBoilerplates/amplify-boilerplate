---
name: e2e-auth
description: Cognito の Email OTP（パスワードレス）ログインを Gmail 等の外部メールに依存せず AI/CI 単独で一気通貫 E2E テストする手順。OTP を Cognito CustomEmailSender 経由で DynamoDB にキャプチャし、AWS API で読んで認証を完走させる。認証フローの自動テスト・「ログインが動くか確認」「OTP を CLI で取得」「Gmail 不要の認証検証」「pnpm e2e:auth」などで使用する。
---

# 認証 E2E スキル（Gmail 不要・AI/CI 一気通貫）

このボイラープレートの認証は **Cognito パスワードレス Email OTP**（`signIn` USER_AUTH/EMAIL_OTP → `confirmSignIn`）。
OTP はメールにしか出ず **AWS API では取得できない**ため、素朴にやると Gmail 等の外部メールボックスに依存し、
AI/CI による完全自動の E2E が成立しない。

このスキルは **Cognito CustomEmailSender Lambda（AWS 公式機能）** で OTP を **DynamoDB にキャプチャ**し、
テストが AWS API で読んで認証を完走させる。外部メール不要・ネイティブ OTP 経路維持・100% AWS 内で完結する。

## いつ使うか

- 認証（Email OTP ログイン）を **AI/CI 単独で E2E 検証**したいとき。
- 「ログインが最後まで通るか」「OTP を CLI/自動で取得して認証を通したい」とき。
- Gmail / Mailpit 等に頼らずに OTP を取得したいとき。

## 仕組み

```
signIn(USER_AUTH/EMAIL_OTP)
  → Cognito が OTP を生成し CustomEmailSender Lambda を呼ぶ（KMS 暗号）
    → Lambda が復号して DynamoDB(OtpCaptureTable) に記録（email→code, TTL 10分）
      → テストが DynamoDB から code を読む
        → respond-to-auth-challenge(EMAIL_OTP_CODE) → JWT
```

- **opt-in**: 環境変数 `AUTH_E2E_OTP_CAPTURE=true` で `ampx sandbox` したときだけ配線される。
  既定 OFF のため **通常 / 本番デプロイは一切変化しない**（ネイティブ Cognito メールのまま）。
- CustomEmailSender を有効にすると Cognito は自前のメール送信を停止し Lambda に委譲する。
  キャプチャ Lambda は DynamoDB に書くだけ（メール送信しない）＝ E2E sandbox ではメール送出ゼロ。

## 手順

```bash
# 1) OTP キャプチャ付きで sandbox をデプロイ（AWS 認証情報が必要）
cd frontend/packages/backend
AUTH_E2E_OTP_CAPTURE=true pnpm run sandbox:once     # or: AUTH_E2E_OTP_CAPTURE=true sandbox（watch）

# 2) AI/CI 一気通貫の認証 E2E を実行（Gmail 不要）
pnpm run e2e:auth
#   → ユーザ作成 → initiate-auth(USER_AUTH/EMAIL_OTP) → DynamoDB から OTP 取得
#     → respond-to-auth-challenge → JWT 検証(signedIn=true) → 後始末
#   成功で exit 0、`{ email, signedIn:true, expiresIn:3600 }` を出力

# 3) 後始末（テスト sandbox を破棄）
#   ※ User Pool は deletionProtection=ACTIVE。teardown 前に解除が必要:
aws cognito-idp update-user-pool --user-pool-id <POOL_ID> --region <R> \
  --deletion-protection INACTIVE --auto-verified-attributes email \
  --user-attribute-update-settings 'AttributesRequireVerificationBeforeUpdate=email'
pnpm run sandbox:delete
```

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `amplify/functions/otp-capture/handler.ts` | CustomEmailSender。AWS Encryption SDK（`@aws-crypto/client-node`+KMS）で OTP 復号 → DynamoDB へ put |
| `amplify/functions/otp-capture/resource.ts` | `defineFunction`（`resourceGroupName:'auth'` で auth スタック同居） |
| `amplify/backend.ts` | `AUTH_E2E_OTP_CAPTURE` ガード。KMS キー+テーブルを **auth スタック**に作成、権限付与、`LambdaConfig.CustomEmailSender`+`KMSKeyID` をエスケープハッチ設定、`custom.otpCaptureTableName` 出力 |
| `scripts/e2e-auth-otp.mjs` | `pnpm e2e:auth` の本体（aws CLI で完走） |

## 注意・落とし穴

- **nested stack の循環依存**: Cognito トリガ関数は **必ず `resourceGroupName:'auth'`**。KMS/DynamoDB も
  `Stack.of(backend.auth.resources.userPool)`（auth スタック）に置く。別 `createStack` に置くと
  `CloudformationStackCircularDependencyError` になる。
- **循環参照回避**: Lambda invoke 許可は `sourceAccount`（User Pool ARN を参照しない）で付与。
- **テストユーザ**: `admin-create-user`+`admin-set-user-password --permanent` で CONFIRMED 化、`email_verified=true`。
- **本番でキャプチャを使わない**: 本番でメール送信に CustomEmailSender を使うなら Lambda に SES 送信を実装し、
  キャプチャ専用フラグと送信を分離する。本スキルの既定はあくまで E2E 専用キャプチャ。
- **UI まで検証したい場合**: ヘッドレスブラウザから Cognito へ到達できない環境では、E2E で得た JWT を
  Amplify の Cookie として注入して `/dashboard` を認証済み表示する（バックエンド E2E はこのスキルで担保）。

## 関連

- `.claude/skills/amplify-gen2`（`references/auth.md` / CDK エスケープハッチ）
- `.claude/rules/tdd.md`（All Green）/ `.claude/rules/commands.md`（devenv コマンド）
- AWS 公式: [Custom email sender Lambda trigger](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-email-sender.html)
