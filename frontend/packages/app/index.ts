/**
 * @workspace/app - 共有ビジネスロジックパッケージ
 *
 * Web/Native 間で共有されるビジネスロジック、エンティティ、フックを提供。
 * データ取得は TanStack Query（`@workspace/query`）+ Amplify Data
 * （`@workspace/data-client`）を使う。
 *
 * @packageDocumentation
 */

// Entities
export * from './entities/user'

// Features
export * from './features/auth'
