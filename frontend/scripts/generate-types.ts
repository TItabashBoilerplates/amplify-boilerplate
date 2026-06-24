#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $ } from 'bun'

console.log('🔄 Generating Supabase types...')

// プロジェクトルートを取得（frontend/scripts/ の親の親）
const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const outputPath = resolve(frontendRoot, 'packages/types/schema.ts')

// 最小限のダミー型定義（Supabase が起動していない場合に使用）
const FALLBACK_SCHEMA = `// Auto-generated placeholder - regenerate with 'make build-model-frontend' when Supabase is running
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
`

/**
 * Supabase が起動しているか確認
 */
async function isSupabaseRunning(): Promise<boolean> {
  try {
    $.cwd(projectRoot)
    const result = await $`supabase status --output json`.quiet()
    return result.exitCode === 0
  } catch {
    return false
  }
}

/**
 * 既存の schema.ts が有効かどうか確認
 */
function hasValidSchema(): boolean {
  if (!existsSync(outputPath)) return false
  const content = readFileSync(outputPath, 'utf-8').trim()
  // 空ファイルまたはプレースホルダーのみの場合は無効
  return content.length > 0 && content.includes('export type Database')
}

try {
  const supabaseRunning = await isSupabaseRunning()

  if (supabaseRunning) {
    // Supabase が起動している場合は型を生成
    console.log('Using workdir', projectRoot)
    $.cwd(projectRoot)
    await $`supabase gen types typescript --local > ${outputPath}`
    console.log('✅ Type generation complete!')
  } else if (hasValidSchema()) {
    // Supabase が起動していないが、既存の有効な型定義がある場合はスキップ
    console.log('⚠️  Supabase is not running. Using existing schema.ts')
  } else {
    // Supabase が起動しておらず、有効な型定義もない場合はフォールバック
    console.log('⚠️  Supabase is not running. Creating placeholder schema.ts')
    writeFileSync(outputPath, FALLBACK_SCHEMA)
    console.log('ℹ️  Run "make build-model-frontend" with Supabase running to generate actual types')
  }
} catch {
  // エラーが発生しても、有効な schema.ts があればそれを使用
  if (hasValidSchema()) {
    console.log('⚠️  Type generation failed, but existing schema.ts is valid. Continuing...')
  } else {
    console.log('⚠️  Type generation failed. Creating placeholder schema.ts')
    writeFileSync(outputPath, FALLBACK_SCHEMA)
  }
}
