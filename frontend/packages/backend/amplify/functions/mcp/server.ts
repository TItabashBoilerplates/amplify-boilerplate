import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { add, generate, ping } from './tools'

/**
 * MCP サーバを組み立てる（ツールを登録）。Lambda はステートレスなのでリクエストごとに
 * 新しい `McpServer` を生成する（`handler.ts` 参照）。
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'backend-mcp-ts', version: '0.1.0' })

  server.registerTool('ping', { description: 'Health-check tool' }, () => ({
    content: [{ type: 'text', text: JSON.stringify(ping()) }],
  }))

  server.registerTool(
    'add',
    { description: 'Add two integers', inputSchema: { a: z.number(), b: z.number() } },
    ({ a, b }) => ({ content: [{ type: 'text', text: String(add(a, b)) }] })
  )

  server.registerTool(
    'generate',
    {
      description: 'Generate text from a prompt (AI extension point)',
      inputSchema: { prompt: z.string() },
    },
    ({ prompt }) => ({ content: [{ type: 'text', text: generate(prompt) }] })
  )

  return server
}
