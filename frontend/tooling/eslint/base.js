import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// eslint-config-next is CommonJS, we need to use require
const nextConfig = require('eslint-config-next')

export default nextConfig
