export * from './colors'
export * from './radius'

/**
 * Convert camelCase to kebab-case
 */
export function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Generate CSS variable reference from token name
 */
export function cssVar(token: string): string {
  return `var(--${toKebabCase(token)})`
}
