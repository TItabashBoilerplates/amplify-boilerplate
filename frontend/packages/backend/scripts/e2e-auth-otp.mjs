#!/usr/bin/env node
/**
 * AI/CI 一気通貫の認証 E2E（Gmail 等の外部メール不要）。
 *
 * 前提: `AUTH_E2E_OTP_CAPTURE=true ampx sandbox`（または sandbox-once）でデプロイ済み。
 *   → Cognito の Email OTP が CustomEmailSender Lambda 経由で DynamoDB に記録される。
 *
 * フロー: テストユーザ作成 → initiate-auth(USER_AUTH/EMAIL_OTP) →
 *   DynamoDB から OTP 取得 → respond-to-auth-challenge → JWT 検証 → 後始末。
 *
 * 使い方: `node scripts/e2e-auth-otp.mjs`（packages/backend で実行。aws CLI が必要）
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputsPath = join(root, 'amplify_outputs.json')
if (!existsSync(outputsPath)) {
  console.error('amplify_outputs.json がありません。先に sandbox をデプロイしてください。')
  process.exit(1)
}
const outputs = JSON.parse(readFileSync(outputsPath, 'utf8'))
const region = outputs.auth?.aws_region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
const poolId = outputs.auth?.user_pool_id
const clientId = outputs.auth?.user_pool_client_id
const table = outputs.custom?.otpCaptureTableName
if (!table) {
  console.error(
    'custom.otpCaptureTableName がありません。AUTH_E2E_OTP_CAPTURE=true でデプロイしてください。'
  )
  process.exit(1)
}

const aws = (args) => {
  const out = execFileSync('aws', [...args, '--region', region, '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return out.trim() ? JSON.parse(out) : null
}
const sleep = (s) => execFileSync('sleep', [String(s)])

const email = `e2e-${Date.now()}@example.com`
const log = (m) => console.log(`• ${m}`)

try {
  log(`test user: ${email}`)
  aws([
    'cognito-idp',
    'admin-create-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--user-attributes',
    `Name=email,Value=${email}`,
    'Name=email_verified,Value=true',
    '--message-action',
    'SUPPRESS',
  ])
  aws([
    'cognito-idp',
    'admin-set-user-password',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--password',
    'Auth-E2E-Test-1!',
    '--permanent',
  ])

  log('initiate-auth (USER_AUTH / EMAIL_OTP)…')
  const init = aws([
    'cognito-idp',
    'initiate-auth',
    '--client-id',
    clientId,
    '--auth-flow',
    'USER_AUTH',
    '--auth-parameters',
    `USERNAME=${email},PREFERRED_CHALLENGE=EMAIL_OTP`,
  ])
  if (init?.ChallengeName !== 'EMAIL_OTP')
    throw new Error(`unexpected challenge: ${init?.ChallengeName}`)

  log('OTP を DynamoDB から取得中…')
  let code = null
  for (let i = 0; i < 20 && !code; i++) {
    const r = aws([
      'dynamodb',
      'get-item',
      '--table-name',
      table,
      '--key',
      JSON.stringify({ email: { S: email } }),
    ])
    code = r?.Item?.code?.S ?? null
    if (!code) sleep(2)
  }
  if (!code) throw new Error('OTP が DynamoDB にキャプチャされませんでした')
  log(`OTP captured: ${code}`)

  log('respond-to-auth-challenge…')
  const resp = aws([
    'cognito-idp',
    'respond-to-auth-challenge',
    '--client-id',
    clientId,
    '--challenge-name',
    'EMAIL_OTP',
    '--session',
    init.Session,
    '--challenge-responses',
    `USERNAME=${email},EMAIL_OTP_CODE=${code}`,
  ])
  const signedIn = Boolean(resp?.AuthenticationResult?.IdToken)
  if (!signedIn) throw new Error('JWT が発行されませんでした')

  const idClaims = JSON.parse(
    Buffer.from(resp.AuthenticationResult.IdToken.split('.')[1], 'base64').toString()
  )
  console.log('\n✅ AI 一気通貫の認証 E2E 成功（Gmail 不要）')
  console.log(
    JSON.stringify(
      { email: idClaims.email, signedIn, expiresIn: resp.AuthenticationResult.ExpiresIn },
      null,
      2
    )
  )
} finally {
  // 後始末（テストユーザ削除）
  try {
    aws(['cognito-idp', 'admin-delete-user', '--user-pool-id', poolId, '--username', email])
  } catch {}
}
