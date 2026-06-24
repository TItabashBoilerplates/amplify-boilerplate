/**
 * Master Data Seeding
 *
 * This module seeds fixed/master data that should exist in all environments.
 * Master data is typically:
 * - Initial configuration values
 * - Default categories/types
 * - System-required records
 *
 * All master data seeds should be idempotent (safe to run multiple times).
 *
 * Currently empty — the boilerplate ships with only the `users` table, which
 * is populated automatically via the `handle_new_user()` trigger on
 * `auth.users` insertions. Add project-specific master data here as needed.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../../schema'

type Database = PostgresJsDatabase<typeof schema>

export async function seedMasterData(_db: Database): Promise<void> {
  // Add master data seeds here in order of dependency.
  // Example:
  //   await seedCategories(_db)
  //   await seedDefaultSettings(_db)
}
