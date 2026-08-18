import { defineAuth } from '@aws-amplify/backend'

/**
 * Cognito 認証（Amplify Auth）
 *
 * **既定は「メールアドレス + パスワード」と「Email OTP」の併用**。
 * `loginWith.email: { otpLogin: true }` の 1 行で **両方が first factor として有効**になる
 * （公式: "users can authenticate using either: Email and password (traditional) [or]
 * Email OTP (passwordless)"）。
 *
 * **パスワードログインを必ず残すこと**（`.claude/rules/auth.md`）。モバイルアプリを
 * 出す場合、OTP のみだと App Store Review 2.1(a) の「審査担当者に渡せる資格情報」を
 * 満たせず**リジェクトされる**（審査担当者はこちらの受信箱に触れられない）。
 * サインイン方式は初回デプロイ後 immutable なので、後から足すことはできない。
 *
 * パスワードポリシー / メール変更時の安全設定 / ユーザー列挙エラーの抑止は
 * `defineAuth` に露出していないため `backend.ts` の CDK オーバーライドで設定している。
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
 *   最初から有効化しておく（後付けは User Pool 作り直しになる）。
 * - passkey の登録はサインイン済みユーザーに対して `associateWebAuthnCredential()` で行う
 *   （サインアップ時には作れない）。OTP がブートストラップの first-factor になる。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/auth/concepts/passwordless/
 * @see https://docs.amplify.aws/nextjs/build-a-backend/auth/concepts/external-identity-providers/
 */
export const auth = defineAuth({
  loginWith: {
    // メール + パスワード（Cognito の既定）に加えて Email OTP も first factor にする。
    // Cognito から OTP / 確認コードのメールを送るには Amazon SES が必要
    // （既定の Cognito 送信は 1 日あたりの上限が非常に小さい）。
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
