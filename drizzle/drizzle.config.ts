import { defineConfig } from 'drizzle-kit'

const postgresUrl = process.env.POSTGRES_URL
if (!postgresUrl) {
  throw new Error(
    'POSTGRES_URL environment variable is required for drizzle-kit. ' +
      'Set it via env/migration/.env.<profile> (loaded by devenv).'
  )
}

export default defineConfig({
  // スキーマ定義ファイル（drizzle/ディレクトリからの相対パス）
  schema: './schema/index.ts',

  // マイグレーション出力先（Drizzle 配下に集約。v3 フォルダ形式で出力される）
  out: './migrations',

  // PostgreSQL方言
  dialect: 'postgresql',

  // データベース接続（環境変数から取得）
  dbCredentials: {
    url: postgresUrl,
  },

  // マイグレーション設定
  migrations: {
    // マイグレーションテーブル名
    table: '__drizzle_migrations',
    // スキーマ名
    schema: 'public',
  },

  // Supabaseが管理するスキーマを除外
  schemaFilter: ['public'],

  // Verbose モード（デバッグ用）
  verbose: true,
  strict: true,
})
