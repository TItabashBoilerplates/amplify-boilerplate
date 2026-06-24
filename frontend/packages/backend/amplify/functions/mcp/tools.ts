/**
 * MCP のツール本体（純粋関数）。FSD/モノレポ方針に従い、ロジックは I/O から切り離して
 * 直接テスト可能にする。`server.ts` がこれらを MCP ツールとして登録する。
 */

export function ping(): { status: string; server: string } {
  return { status: 'ok', server: 'backend-mcp-ts' }
}

export function add(a: number, b: number): number {
  return a + b
}

/**
 * AI 拡張ポイント（スタブ）。LangChain.js / Bedrock SDK に差し替える。
 * Bedrock の権限・配線は amplify-gen2 スキルの references/aws-services.md を参照。
 */
export function generate(prompt: string): string {
  return `[stub] would generate a response for: ${prompt}`
}
