/**
 * Next.js 専用 Supabase クライアント
 *
 * Server Components, Server Actions, Route Handlers, Middleware で使用
 *
 * @packageDocumentation
 */

// Middleware用
export { updateSession } from './middleware'
// Server Components/Actions/Route Handlers用
export { createClient as createServerClient } from './server'
