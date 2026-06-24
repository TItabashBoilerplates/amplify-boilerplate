import { StreamableHTTPTransport } from '@hono/mcp'
import { Hono } from 'hono'
import { handle } from 'hono/aws-lambda'
import { buildMcpServer } from './server'

/**
 * MCP サーバ（TypeScript）を Streamable HTTP で公開する Lambda。
 * Hono + `@hono/mcp` の `StreamableHTTPTransport` で、`hono/aws-lambda` 経由で動かす。
 * Lambda はステートレスなのでリクエストごとに server+transport を生成する。
 */
const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok', service: 'mcp' }))

app.all('/mcp', async (c) => {
  const server = buildMcpServer()
  const transport = new StreamableHTTPTransport()
  await server.connect(transport)
  return transport.handleRequest(c)
})

export const handler = handle(app)
