import { fsdConfig } from '@workspace/eslint-config/fsd'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextCoreWebVitals,
  fsdConfig,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
]

export default config
