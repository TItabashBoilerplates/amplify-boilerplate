import type { Schema } from '@workspace/backend'
import { type Client, generateClient } from 'aws-amplify/data'

/**
 * @workspace/data-client - Amplify Data（AppSync + DynamoDB）クライアント
 *
 * Web / Mobile 共通で利用する型付きデータクライアント（Supabase クライアントの置換）。
 * `generateClient<Schema>()` を遅延初期化のシングルトンで提供する。
 *
 * @packageDocumentation
 */

// 明示注釈: 推論型は `@aws-amplify/api-graphql` 内部型を相対パス参照してしまい
// TS2742（移植不能）になるため、直接依存 `aws-amplify` 由来の `Client<Schema>` で型付けする。
let client: Client<Schema> | undefined

/**
 * Amplify Data クライアントを取得する（遅延初期化・シングルトン）。
 *
 * `Amplify.configure()`（web: ConfigureAmplifyClientSide / mobile: 初期化）後に呼ぶこと。
 *
 * @example
 * ```ts
 * import { getDataClient } from '@workspace/data-client'
 *
 * const { data: todos } = await getDataClient().models.Todo.list()
 * ```
 */
export function getDataClient(): Client<Schema> {
  if (!client) {
    client = generateClient<Schema>()
  }
  return client
}

export type { Schema }
