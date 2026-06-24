import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/index.ts";
import { getDbUrl } from "./url.ts";

/**
 * Drizzle クライアントを作成（トランザクション対応）
 *
 * Note: `prepare: false` は Supabase の Transaction pool mode で必須
 * https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase-edge-functions
 *
 * @example
 * ```typescript
 * const db = createDrizzleClient();
 *
 * // 単純なクエリ
 * const users = await db.select().from(generalUsers);
 *
 * // トランザクション
 * await db.transaction(async (tx) => {
 *   await tx.insert(users).values({ ... });
 *   await tx.update(accounts).set({ ... });
 * });
 * ```
 */
export function createDrizzleClient() {
  const connectionString = getDbUrl();
  // Disable prefetch as it is not supported for "Transaction" pool mode
  const queryClient = postgres(connectionString, { prepare: false });
  return drizzle({ client: queryClient, schema });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;
