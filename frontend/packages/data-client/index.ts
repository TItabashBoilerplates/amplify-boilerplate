import type { Schema } from '@workspace/backend'
import { generateClient } from 'aws-amplify/data'

/**
 * @workspace/data-client - Amplify Data（AppSync + DynamoDB）クライアント
 *
 * Web / Mobile 共通で利用する型付きデータクライアント（Supabase クライアントの置換）。
 * `generateClient<Schema>()` を遅延初期化のシングルトンで提供する。
 *
 * @packageDocumentation
 */

let client: ReturnType<typeof generateClient<Schema>> | undefined

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
export function getDataClient() {
  if (!client) {
    client = generateClient<Schema>()
  }
  return client
}

export type { Schema }
