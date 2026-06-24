/**
 * データベースURLを取得
 *
 * Workaround: Deno cannot resolve hostnames containing underscores (Issue #23157)
 * https://github.com/denoland/deno/issues/23157
 * Replace supabase_db_* hostname with host.docker.internal for local development
 *
 * @throws SUPABASE_DB_URLが設定されていない場合
 */
export function getDbUrl(): string {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) {
    throw new Error("Missing required environment variable: SUPABASE_DB_URL");
  }

  // Workaround for Deno's node:dns underscore hostname bug
  // supabase_db_* -> host.docker.internal:54322
  if (url.includes("supabase_db_")) {
    return url.replace(
      /@supabase_db_[^:]+:5432/,
      "@host.docker.internal:54322",
    );
  }

  return url;
}
