import { defineConfig } from '@hey-api/openapi-ts'

const backendUrl =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_PY_URL ?? 'http://127.0.0.1:4040'

export default defineConfig({
  input: `${backendUrl}/openapi.json`,
  output: {
    path: './src/generated',
    format: 'biome',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
    {
      name: '@hey-api/client-fetch',
      runtimeConfigPath: '../runtime-config',
    },
    {
      name: '@tanstack/react-query',
    },
  ],
})
