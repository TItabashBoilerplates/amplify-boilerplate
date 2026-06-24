---
name: shadcn-ui
description: shadcn/ui + TailwindCSS 4 UI implementation guidance. Use for component addition, CSS variable usage, accessibility, and dark mode support.
---

# shadcn/ui + TailwindCSS 4

## Adding Components

devenv shell 内で `nlx` 経由で追加するのが正規の方法。Makefile は **deprecated**（削除済み）。

```bash
# devenv shell 内 (direnv 自動アクティベート含む)
nlx shadcn@latest add button     # = bunx shadcn@latest add button
```

> 開発サーバを動かしながら追加したい場合は別ターミナルで `dev-web` を起動しておく。

## TailwindCSS 4 - CSS Variables (MANDATORY)

**ALWAYS use CSS variables** for colors. Never hardcode color values.

```typescript
// CORRECT: Use CSS variables
<div className="bg-background text-foreground">
<Button className="bg-primary text-primary-foreground">

// WRONG: Hardcoded colors
<div className="bg-white text-black">
<Button className="bg-blue-500 text-white">
```

## Available CSS Variables

```css
/* Light theme */
--background: oklch(1 0 0);
--foreground: oklch(0.145 0 0);
--primary: oklch(0.205 0 0);
--primary-foreground: oklch(0.985 0 0);
--secondary: oklch(0.97 0 0);
--secondary-foreground: oklch(0.205 0 0);
--muted: oklch(0.97 0 0);
--muted-foreground: oklch(0.556 0 0);
--accent: oklch(0.97 0 0);
--accent-foreground: oklch(0.205 0 0);
--destructive: oklch(0.577 0.245 27.325);
--destructive-foreground: oklch(0.577 0.245 27.325);
--border: oklch(0.922 0 0);
--input: oklch(0.922 0 0);
--ring: oklch(0.708 0 0);
```

## Component Usage Pattern

```typescript
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card'

export function LoginForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('login.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <Input
            type="email"
            placeholder={t('login.email')}
          />
          <Input
            type="password"
            placeholder={t('login.password')}
          />
          <Button type="submit" className="w-full">
            {t('login.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

## Dark Mode Support

Components automatically support dark mode via CSS variables. The theme is controlled by adding `dark` class to `<html>` element.

```typescript
// Theme toggle example
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
```

## Accessibility

All shadcn/ui components are built on Radix UI primitives with:
- Keyboard navigation support
- Screen reader support
- ARIA attributes
- Focus management

```typescript
// Accessible dialog example
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog'

<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{t('dialog.title')}</DialogTitle>
      <DialogDescription>
        {t('dialog.description')}
      </DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

## Prohibited Patterns

**NEVER**:
- Hardcode color values (use CSS variables)
- Skip accessibility attributes
- Use inline styles for colors
- Import components from `@radix-ui/*` directly (use shadcn wrappers)
