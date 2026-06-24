/**
 * Users Random Data Refinement
 *
 * Generates random user data for development and testing.
 * The seed number in index.ts ensures deterministic generation.
 */
import type { RefinementsType } from 'drizzle-seed'

type GeneratorFunctions = Parameters<RefinementsType>[0]

export const usersRefinement = (f: GeneratorFunctions) => ({
  // Note: users table has RLS and requires auth.uid() for insert
  // Random seeding may need to be done via service_role or SQL
  // This is a template showing the refinement structure
  users: {
    count: 10,
    columns: {
      displayName: f.fullName(),
      accountName: f.email({ isUnique: true }),
    },
  },
})
