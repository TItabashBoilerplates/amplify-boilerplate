export * from './colors'
export * from './contract'
export * from './oklch'
export * from './radius'

/**
 * Convert camelCase to kebab-case.
 *
 * 文字と数字の境界も区切る（`chart1` → `chart-1`）。shadcn/ui の CSS 変数命名
 * (`--chart-1`) と一致させるために必須。
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase()
}

/**
 * Generate CSS variable reference from token name
 */
export function cssVar(token: string): string {
  return `var(--${toKebabCase(token)})`
}
