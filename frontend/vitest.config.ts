import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        '**/*.config.*',
        '**/dist/',
        '**/.turbo/**',
        '**/coverage/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
      '@workspace/ui': path.resolve(__dirname, './packages/ui'),
      '@workspace/native-ui': path.resolve(__dirname, './packages/native-ui'),
      '@workspace/auth': path.resolve(__dirname, './packages/auth'),
      '@workspace/types': path.resolve(__dirname, './packages/types'),
      '@workspace/client-supabase': path.resolve(__dirname, './packages/client/supabase'),
      '@workspace/logger': path.resolve(__dirname, './packages/logger'),
    },
  },
})
