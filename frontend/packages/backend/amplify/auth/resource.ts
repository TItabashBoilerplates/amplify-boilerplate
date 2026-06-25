import { defineAuth } from '@aws-amplify/backend'

/**
 * Cognito 認証（Amplify Auth）
 *
 * このボイラープレートの既定は **パスワードレス Email OTP**。最近はパスワードより OTP /
 * passkey が主流のため、パスワード/パスワードポリシーは既定にしない。
 *
 * 追加できる first-factor（すべて Email OTP と共存可。詳細は下のテンプレート）:
 *  - **passkey（WebAuthn）**: `loginWith.webAuthn`。`true` で RP ID を自動解決
 *    （sandbox=localhost / ブランチ=Amplify ドメイン）。本番はドメインを明示。
 *  - **ソーシャル**: `loginWith.externalProviders`（Google / Apple / Amazon / Facebook）。
 *    機密は Amplify secrets（`secret('NAME')`）。Hosted UI ドメインは Amplify が自動発行。
 *
 * @remarks
 * - **MFA とパスワードレス（OTP / passkey）は併用不可**（Cognito 制約）。`multifactor` は足さない。
 * - **sign-in 方式・識別子・検証方式は初回デプロイ後 immutable**。passkey/social を使うなら
 *   最初から有効化しておく（後付けは User Pool 作り直しになる）。だからこそ既定は OTP のみにし、
 *   採用が決まった機能だけ下のテンプレートを有効化する。
 * - passkey の登録はサインイン済みユーザーに対して `associateWebAuthnCredential()` で行う
 *   （サインアップ時には作れない）。OTP がブートストラップの first-factor になる。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/auth/concepts/passwordless/
 * @see https://docs.amplify.aws/nextjs/build-a-backend/auth/concepts/external-identity-providers/
 */
export const auth = defineAuth({
  loginWith: {
    // パスワードレス Email OTP（既定）。Cognito から OTP メールを送るには Amazon SES が必要。
    email: {
      otpLogin: true,
    },

    // --- 任意: passkey（WebAuthn）を有効化する場合は次をアンコメント ---------
    // import を `import { defineAuth } from '@aws-amplify/backend'` のままにし、これを足すだけ。
    // webAuthn: true,
    // 本番でカスタムドメインを使う場合は RP ID を明示する:
    // webAuthn: { relyingPartyId: 'example.com', userVerification: 'preferred' },

    // --- 任意: ソーシャルログインを有効化する場合は次をアンコメント -----------
    // ファイル先頭の import を `import { defineAuth, secret } from '@aws-amplify/backend'` にし、
    // `ampx sandbox secret set GOOGLE_CLIENT_ID` 等で各 secret を登録してからデプロイする。
    // externalProviders: {
    //   google: {
    //     clientId: secret('GOOGLE_CLIENT_ID'),
    //     clientSecret: secret('GOOGLE_CLIENT_SECRET'),
    //     scopes: ['email'],
    //     attributeMapping: { email: 'email' },
    //   },
    //   signInWithApple: {
    //     clientId: secret('SIWA_CLIENT_ID'),
    //     keyId: secret('SIWA_KEY_ID'),
    //     privateKey: secret('SIWA_PRIVATE_KEY'),
    //     teamId: secret('SIWA_TEAM_ID'),
    //   },
    //   // ブラウザのリダイレクト先（Hosted UI）。本番ドメインも追加する。
    //   callbackUrls: ['http://localhost:3000/', 'https://example.com/'],
    //   logoutUrls: ['http://localhost:3000/', 'https://example.com/'],
    // },
  },
})
