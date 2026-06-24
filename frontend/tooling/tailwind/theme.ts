/**
 * Shared theme configuration for Web and Native
 * CSS variables are used to enable theming across platforms
 */

export const colors = {
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  card: {
    DEFAULT: 'var(--card)',
    foreground: 'var(--card-foreground)',
  },
  popover: {
    DEFAULT: 'var(--popover)',
    foreground: 'var(--popover-foreground)',
  },
  primary: {
    DEFAULT: 'var(--primary)',
    foreground: 'var(--primary-foreground)',
  },
  secondary: {
    DEFAULT: 'var(--secondary)',
    foreground: 'var(--secondary-foreground)',
  },
  muted: {
    DEFAULT: 'var(--muted)',
    foreground: 'var(--muted-foreground)',
  },
  accent: {
    DEFAULT: 'var(--accent)',
    foreground: 'var(--accent-foreground)',
  },
  destructive: {
    DEFAULT: 'var(--destructive)',
    foreground: 'var(--destructive-foreground)',
  },
  border: 'var(--border)',
  input: 'var(--input)',
  ring: 'var(--ring)',
  chart: {
    1: 'var(--chart-1)',
    2: 'var(--chart-2)',
    3: 'var(--chart-3)',
    4: 'var(--chart-4)',
    5: 'var(--chart-5)',
  },
} as const

export const borderRadius = {
  '4xl': 'calc(var(--radius) * 2.6)',
  '3xl': 'calc(var(--radius) * 2.2)',
  '2xl': 'calc(var(--radius) * 1.8)',
  xl: 'calc(var(--radius) * 1.4)',
  lg: 'var(--radius)',
  md: 'calc(var(--radius) * 0.8)',
  sm: 'calc(var(--radius) * 0.6)',
} as const

export const themeExtend = {
  colors,
  borderRadius,
} as const
