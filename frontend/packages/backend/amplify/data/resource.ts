import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

/**
 * Amplify Data（AppSync + DynamoDB）— Supabase Postgres + Drizzle の置き換え
 *
 * Amplify Gen2 のベストプラクティスに従い、データモデルはコードファーストで定義する。
 * - `a.model()` ごとに DynamoDB テーブル + AppSync GraphQL API が生成される
 * - 認可は旧 RLS の代替（`allow.owner()` / `allow.authenticated()` / `allow.guest()` 等）
 * - 既定の認可モードは Cognito User Pool（`userPool`）
 *
 * 下記 `Todo` はサンプル。実モデルに置き換えて使う。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/data/
 */
const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
      done: a.boolean().default(false),
    })
    .authorization((allow) => [allow.owner()]),
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})
