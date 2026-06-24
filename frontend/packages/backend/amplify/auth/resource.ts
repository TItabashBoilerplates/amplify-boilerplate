import { defineAuth } from '@aws-amplify/backend'

/**
 * Cognito 認証（Supabase Auth の置き換え）
 *
 * Amplify Gen2 のベストプラクティスに従い、認証は Cognito User Pool で定義する。
 * - email + password ログインを既定とする
 * - ソーシャルログイン / MFA / カスタム属性を足す場合はこの定義を拡張する
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/auth/
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    // 例: ソーシャルログインを足す場合（secret は Amplify secrets 管理）
    // externalProviders: {
    //   google: {
    //     clientId: secret('GOOGLE_CLIENT_ID'),
    //     clientSecret: secret('GOOGLE_CLIENT_SECRET'),
    //   },
    //   callbackUrls: ['http://localhost:3000/'],
    //   logoutUrls: ['http://localhost:3000/'],
    // },
  },
})
