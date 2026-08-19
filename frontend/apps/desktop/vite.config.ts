import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Tauri デスクトップアプリのフロントエンド（Vite + React）。
 *
 * ## なぜ Next.js（apps/web）を再利用しないのか
 *
 * **Tauri は Node.js サーバーを持たないため SSR を動かせず、Next.js は SSG
 * （`output: 'export'`）でしか載らない。** `apps/web` は Server Components /
 * next-intl / Amplify の server context（`runWithAmplifyServerContext` +
 * `getCurrentUser` によるサーバー側の認可）を前提にしており、これらは静的書き出し
 * できない。無理に SSG 化すると web 側の設計を壊すことになるので、デスクトップは
 * Vite の別アプリにし、**UI とドメインロジックを `@workspace/*` で共有**する。
 *
 * @see https://v2.tauri.app/start/frontend/nextjs/
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Tauri の dev server は固定ポート前提（tauri.conf.json の devUrl と一致させる）
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rust 側の変更で Vite が再読み込みしないようにする
      ignored: ['**/src-tauri/**'],
    },
  },

  // Tauri は最新の WebView（macOS: WKWebView / Windows: WebView2 / Linux: WebKitGTK）で動くため
  // レガシーブラウザ向けのトランスパイルは不要。
  build: {
    target: 'esnext',
    // 本番ビルドでソースマップを出すかは Tauri の debug ビルドかどうかで切り替える
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
  },
})
