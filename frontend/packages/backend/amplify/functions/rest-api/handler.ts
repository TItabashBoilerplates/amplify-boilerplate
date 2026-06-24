import { handle } from 'hono/aws-lambda'
import { app } from './app'

/**
 * Lambda エントリポイント。`backend.ts` の `addFunctionUrl` で公開される。
 */
export const handler = handle(app)
