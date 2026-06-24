import { defineFunction } from '@aws-amplify/backend'

/**
 * MCP サーバ（TypeScript / FastMCP 相当の `@modelcontextprotocol/sdk`）.
 *
 * Node `defineFunction`。`handler.ts` が Hono + `@hono/mcp` の Streamable HTTP で
 * MCP を公開し、backend.ts で Function URL を付与する。
 *
 * （backend-py 側にも Python の MCP サーバ雛形があるが、Amplify ネイティブな
 *  TypeScript はこの関数。用途に応じて使い分ける。）
 */
export const mcp = defineFunction({
  name: 'mcp',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
})
