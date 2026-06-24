/**
 * Database Seed Entry Point
 *
 * Usage:
 *   bun run seed/index.ts
 *
 * Environment:
 *   POSTGRES_URL - PostgreSQL connection string (required)
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { reset, seed } from 'drizzle-seed'
import postgres from 'postgres'
import * as schema from '../schema'
import { seedMasterData } from './master'
import { refinements } from './random'

// Deterministic seed number for reproducible random data
const SEED_NUMBER = 12345

async function main() {
  const databaseUrl = process.env.POSTGRES_URL
  if (!databaseUrl) {
    console.error('POSTGRES_URL is required')
    process.exit(1)
  }

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client, { schema })

  try {
    console.log('Resetting database...')
    await reset(db, schema)

    console.log('Seeding master data...')
    await seedMasterData(db)

    console.log('Seeding random data...')
    await seed(db, schema, { seed: SEED_NUMBER }).refine(refinements)

    console.log('Seeding complete!')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
