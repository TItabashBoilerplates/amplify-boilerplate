# Cognito の認証メール - 運用手順書

このリポジトリの認証メール（確認コード / Email OTP / パスワードリセット / メールアドレス変更）は
**Amazon Cognito** が送る。Cognito のメッセージ設定は `defineAuth` と CDK オーバーライドで
Git 管理し、Dashboard での手動編集はしない。

> ポリシーの正本は [`.claude/rules/auth.md`](../../.claude/rules/auth.md) と
> [`.claude/skills/amplify-gen2/`](../../.claude/skills/amplify-gen2/)。

---

## 0. 先に押さえること: **本番は必ず SES に切り替える**

Cognito の既定の送信元（`COGNITO_DEFAULT`）は **1 日あたりの送信上限が非常に小さい**
（検証・開発用の枠であって、本番トラフィックを想定していない）。

- **Email OTP をログイン手段に含めるなら SES は前提**（毎回のログインでメールが飛ぶ）
- 上限に当たると**エラーではなく「コードが届かない」**という形で失敗する。
  アプリ側は正常に見えるので、気づけるのは問い合わせが来たときだけ

```typescript
// frontend/packages/backend/amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: { email: { otpLogin: true } },
  senderEmail: 'no-reply@example.com', // ← SES で検証済みの ID
})
```

SES 側の前提:

1. ドメイン（またはメールアドレス）の **ID を検証**する
2. **DKIM / SPF / DMARC** を設定する（到達性。設定しないと迷惑メール送りになる）
3. **サンドボックスを解除**する（未解除だと**検証済みの宛先にしか送れない**。
   自分宛のテストだけ通って本番で全滅する典型）

---

## 1. 文面の設定（`backend.ts` の CDK オーバーライド）

件名・本文は `defineAuth` に十分に露出していないため、L1（CFN）で設定する。

```typescript
// frontend/packages/backend/amplify/backend.ts
const { cfnUserPool } = backend.auth.resources.cfnResources

// 確認コード（サインアップ / 属性検証）
cfnUserPool.addPropertyOverride('EmailVerificationSubject', 'Confirm your account')
cfnUserPool.addPropertyOverride(
  'EmailVerificationMessage',
  'Your verification code is {####}',
)
cfnUserPool.addPropertyOverride('VerificationMessageTemplate.DefaultEmailOption', 'CONFIRM_WITH_CODE')
```

> **`{####}` を消さないこと。** これがコードのプレースホルダで、
> 落とすとメールは届くのに**コードが書かれていない**状態になる。

---

## 2. 多言語（en / ja）は customMessage トリガーで出し分ける

**Cognito のメッセージテンプレートは単一言語**しか持てない。
`.claude/rules/i18n.md` は全ユーザー向けテキストの en / ja 対応を必須にしているので、
多言語が要るなら **customMessage Lambda トリガー**で分岐する。

```typescript
// frontend/packages/backend/amplify/auth/custom-message/handler.ts
import type { CustomMessageTriggerHandler } from 'aws-lambda'

export const handler: CustomMessageTriggerHandler = async (event) => {
  // ロケールは sign-up 時に userAttributes へ入れておく（例: 'locale'）
  const locale = event.request.userAttributes.locale === 'ja' ? 'ja' : 'en'
  const code = event.request.codeParameter // ← "{####}" に相当

  if (event.triggerSource === 'CustomMessage_SignUp') {
    event.response.emailSubject = locale === 'ja' ? 'アカウントの確認' : 'Confirm your account'
    event.response.emailMessage =
      locale === 'ja' ? `確認コード: ${code}` : `Your verification code is ${code}`
  }
  return event
}
```

- **`triggerSource` をすべて分岐すること**（`CustomMessage_SignUp` /
  `CustomMessage_ForgotPassword` / `CustomMessage_UpdateUserAttribute` /
  `CustomMessage_Authentication` 等）。分岐が漏れたトリガーは**既定の文面のまま**送られる
- **`codeParameter` を本文に必ず含める**。含め忘れるとコード無しのメールが届く

---

## 3. 反映

| 環境 | 反映方法 |
|---|---|
| sandbox（開発者ごと） | `sandbox`（watch 中なら保存で自動再デプロイ） |
| ブランチ / 本番 | Amplify Hosting が `amplify.yml` に従って `ampx pipeline-deploy` を実行 |

`senderEmail` の変更や customMessage トリガーの追加は **User Pool の更新**になるので、
反映後に**実際にメールを受け取って確認する**（「デプロイが成功した」は
「メールが届く」を意味しない）。

---

## 4. 動作確認（**送信できたで終わらせない**）

パスワード再設定もメールアドレス変更も、**コードを受け取って確定するまでが 1 本のフロー**
であり、そこを踏まないテストは壊れていることに気づけない（`.claude/rules/auth.md` §6）。

```bash
e2e-web       # Maestro。ログイン〜パスワード再設定の往復
e2e-mobile
```

E2E ドライバ（`scripts/e2e/run-maestro.mjs`）は、テストユーザの作成 → OTP ブリッジの起動
（`AUTH_E2E_OTP_CAPTURE` の DynamoDB からコードを読む）→ maestro 実行 → 後始末までを行う。
**Maestro の graaljs は SigV4 を扱えない**ため、AWS を触る処理はすべて外側に置いてある。

手動で確認する場合のチェック:

| # | 確認 |
|---|---|
| 1 | サインアップの確認コードが届き、コードで確定できる |
| 2 | 「パスワードを忘れた方」のコードが届き、新パスワードでログインできる |
| 3 | メールアドレス変更のコードが**新アドレス**に届く。かつ**確認完了までは旧アドレスでログインできる**（`AttributesRequireVerificationBeforeUpdate` が効いている証拠） |
| 4 | 文面が en / ja で切り替わる |
| 5 | 送信元が SES 経由になっている（本番） |

---

## 5. 落とし穴

| 症状 | 原因 |
|---|---|
| コードが届かない（エラーは出ない） | Cognito 既定の送信上限。**SES に切り替える** |
| 検証済みの宛先にしか届かない | SES が**サンドボックス**のまま |
| 迷惑メールに入る | DKIM / SPF / DMARC 未設定 |
| メールは届くがコードが空 | 本文から `{####}` / `codeParameter` が抜けている |
| 一部のメールだけ文面が変わらない | customMessage の `triggerSource` 分岐が漏れている |
| メール変更後にログインできなくなった | **`AttributesRequireVerificationBeforeUpdate: ['email']` の設定漏れ**（`.claude/rules/auth.md` §3.4） |

## 参考

- [Amplify Gen2: Passwordless](https://docs.amplify.aws/react/build-a-backend/auth/concepts/passwordless/)
- [Amplify Gen2: Email customization](https://docs.amplify.aws/react/build-a-backend/auth/moderate-and-manage-users/)
- [Cognito: Custom message Lambda trigger](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message-trigger.html)
- [Cognito: Email settings（SES への切り替え）](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html)
