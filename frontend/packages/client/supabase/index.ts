/**
 * Supabase クライアント - Public API
 *
 * フレームワーク非依存のクライアント
 * Next.js 固有の機能（Server/Middleware）は apps/web に移動済み
 *
 * @packageDocumentation
 */

// Client Components用（フレームワーク非依存）
export { createClient as createBrowserClient } from './client'
