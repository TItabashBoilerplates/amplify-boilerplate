import { getLogger } from '@workspace/backend-core'
import { Hono } from 'hono'

const log = getLogger('rest-api')

/**
 * Hono アプリ本体。`handler.ts` から `hono/aws-lambda` で Lambda 化し、テストからは
 * `app.request()` で直接叩ける（FSD/モノレポの「ロジックは純粋に・I/O は端で」）。
 */
export const app = new Hono()

app.get('/', (c) => c.json({ message: 'Amplify TypeScript REST API (Hono on Lambda)' }))

app.get('/health', (c) => {
  log.info('health check')
  return c.json({ status: 'ok', service: 'rest-api' })
})

// 認証が要るルートの例。Cognito JWT は Authorization ヘッダで受け取り検証する。
// 実検証は jose / aws-jwt-verify で User Pool の JWKS に照合する（env: COGNITO_*）。
app.get('/me', (c) => {
  const authorization = c.req.header('authorization')
  if (!authorization) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  return c.json({ user: { note: 'verify the Cognito JWT here (env COGNITO_*)' } })
})
