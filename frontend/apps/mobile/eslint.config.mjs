import { createRequire } from 'node:module'
import { fsdConfig } from '@workspace/eslint-config/fsd'

const require = createRequire(import.meta.url)
const expoConfig = require('eslint-config-expo/flat')

export default [
  ...expoConfig,
  fsdConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**'],
  },
]
