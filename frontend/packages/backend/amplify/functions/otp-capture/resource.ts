import { defineFunction } from '@aws-amplify/backend'

/**
 * Cognito **CustomEmailSender** トリガ用の Lambda（E2E テスト専用・opt-in）。
 *
 * `AUTH_E2E_OTP_CAPTURE=true` で `ampx sandbox` したときだけ `backend.ts` から
 * User Pool に配線される。Cognito が送る OTP（KMS 暗号）を復号し、DynamoDB に
 * 記録する。これにより **Gmail 等の外部メールボックスに依存せず、AI/CI が CLI で
 * OTP を取得して認証フローを一気通貫で検証**できる。
 *
 * ⚠️ 本番では配線しない（env フラグ未設定なら一切デプロイされない）。CustomEmailSender を
 * 有効にすると Cognito は自前のメール送信を停止し、この Lambda に委譲する点に注意。
 *
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-email-sender.html
 */
export const otpCapture = defineFunction({
  name: 'otp-capture',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  // Cognito の Lambda トリガなので auth スタックに同居させる（nested stack の循環依存回避）。
  resourceGroupName: 'auth',
})
