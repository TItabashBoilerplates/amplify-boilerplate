/**
 * `@workspace/backend` public API.
 *
 * フロントエンド（web / mobile）は Amplify Data の型をここから取得する:
 *
 *   import type { Schema } from '@workspace/backend'
 *   const client = generateClient<Schema>()
 *
 * Amplify Gen2 のモノレポ・ベストプラクティス（backend スキーマの型共有）に従う。
 */
export type { Schema } from './amplify/data/resource'
