import { defineFunction } from '@aws-amplify/backend'

/**
 * REST API（TypeScript / Hono on Lambda）.
 *
 * Amplify Gen2 のベストプラクティスである Node `defineFunction`。`handler.ts` が
 * `hono/aws-lambda` でエクスポートする Hono アプリを Lambda として動かし、
 * backend.ts で Function URL を付与して公開する。
 *
 * （Python の FastAPI Lambda は重い/LLM 処理向けのエスカレーション経路。
 *  通常の REST はこの TS 関数を第一候補にする。）
 */
export const restApi = defineFunction({
  name: 'rest-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
})
