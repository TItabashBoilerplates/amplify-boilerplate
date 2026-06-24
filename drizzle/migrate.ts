#!/usr/bin/env bun

/**
 * Drizzle Custom SQL Migration Script
 *
 * このスクリプトは、カスタムSQL（拡張機能、関数、トリガーなど）を適用します。
 *
 * 使用方法:
 *   bun run migrate.ts <phase>
 *
 * フェーズ:
 *   pre-migration  - config/pre-migration/ 内のSQLを実行（extensions等）
 *   post-migration - config/post-migration/ 内のSQLを実行（functions/triggers等）
 *
 * 例:
 *   bun run migrate.ts pre-migration   # マイグレーション前に実行
 *   bun run migrate.ts post-migration  # マイグレーション後に実行
 *
 * 環境変数:
 *   POSTGRES_URL - PostgreSQL接続文字列（必須）
 */

import { existsSync, readdirSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const VALID_PHASES = ['pre-migration', 'post-migration'] as const
type Phase = (typeof VALID_PHASES)[number]

function showUsage(): void {
  console.log('')
  console.log('Usage: bun run migrate.ts <phase>')
  console.log('')
  console.log('Phases:')
  console.log('  pre-migration  - Execute config/pre-migration/*.sql (extensions, etc.)')
  console.log('  post-migration - Execute config/post-migration/*.sql (functions, triggers, etc.)')
  console.log('')
  console.log('Examples:')
  console.log('  bun run migrate.ts pre-migration')
  console.log('  bun run migrate.ts post-migration')
  console.log('')
}

function isValidPhase(phase: string): phase is Phase {
  return VALID_PHASES.includes(phase as Phase)
}

async function executeSqlFiles(configDir: string, phase: Phase): Promise<void> {
  const targetDir = `${configDir}/${phase}`

  // ディレクトリが存在するか確認（接続前にスキップ判定）
  if (!existsSync(targetDir)) {
    console.log(`⚠️  Directory not found: ${targetDir}`)
    console.log('Skipping SQL execution.')
    return
  }

  // 対象ディレクトリ内の全 .sql ファイルを取得
  const sqlFiles = readdirSync(targetDir)
    .filter((file) => file.endsWith('.sql'))
    .sort() // アルファベット順でソート（一貫性のため）

  if (sqlFiles.length === 0) {
    console.log(`⚠️  No SQL files found in ${phase}/`)
    console.log('Skipping SQL execution.')
    return
  }

  // 実行が確定したのち POSTGRES_URL を要求する
  const databaseUrl = Bun.env.POSTGRES_URL
  if (!databaseUrl) {
    console.error('❌ Error: POSTGRES_URL environment variable is required')
    process.exit(1)
  }

  console.log(`🔌 Connecting to database...`)

  // PostgreSQL接続（実行後は接続を閉じるため max: 1）
  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)

  try {
    console.log(`📖 Reading SQL files from ${phase}/...`)

    console.log(`Found ${sqlFiles.length} SQL file(s): ${sqlFiles.join(', ')}`)
    console.log('')

    // 各SQLファイルを順次実行。1ファイルでも失敗したら即時 throw して停止。
    for (const file of sqlFiles) {
      console.log(`🔧 Executing ${file}...`)
      const sqlPath = `${targetDir}/${file}`
      const sqlFile = Bun.file(sqlPath)
      const sqlContent = await sqlFile.text()

      try {
        await db.execute(sql.raw(sqlContent))
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`❌ Failed to execute ${file}: ${error.message}`)
        } else {
          console.error(`❌ Failed to execute ${file}: unknown error`, error)
        }
        throw error
      }

      console.log(`✅ ${file} executed successfully`)
      console.log('')
    }
  } finally {
    // 接続を確実にクローズ
    await client.end()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const phase = args[0]

  // 引数チェック
  if (!phase) {
    console.error('❌ Error: Phase argument is required')
    showUsage()
    process.exit(1)
  }

  if (!isValidPhase(phase)) {
    console.error(`❌ Error: Invalid phase "${phase}"`)
    showUsage()
    process.exit(1)
  }

  console.log(`🚀 Running ${phase} SQL scripts...`)
  console.log('')

  const configDir = `${import.meta.dir}/config`
  await executeSqlFiles(configDir, phase)

  console.log('')
  console.log(`✨ ${phase} phase complete!`)
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`\n❌ Fatal error: ${error.message}`)
    if (error.stack) console.error(error.stack)
  } else {
    console.error('\n❌ Fatal error: unknown error', error)
  }
  process.exit(1)
})
