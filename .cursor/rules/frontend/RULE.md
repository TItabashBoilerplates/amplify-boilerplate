---
description: "Frontend code standards for Next.js, React, and FSD architecture"
alwaysApply: false
globs: ["frontend/**/*.ts", "frontend/**/*.tsx"]
---
# Frontend Code Standards

## Architecture

- **Pattern**: Feature Sliced Design (FSD)
- **Segments**: api, model, ui
- **State**: TanStack Query (server), Zustand (global)

## Monorepo Structure

```
frontend/
├── apps/
│   ├── web/        # Next.js 16 + shadcn/ui
│   └── mobile/     # Expo 55 + gluestack-ui
└── packages/
    ├── ui/web/     # shadcn/ui (Web)
    ├── ui/mobile/  # gluestack-ui (Mobile)
    ├── tokens/     # Design tokens
    ├── client-supabase/
    ├── query/      # TanStack Query
    └── tailwind-config/
```

## DRY Principle (MANDATORY)

| 対象 | 配置場所 |
|------|---------|
| Web UI | `packages/ui/web/` |
| Mobile UI | `packages/ui/mobile/` |
| Supabase | `packages/client-supabase/` |
| Query設定 | `packages/query/` |
| 型定義 | `packages/*/types/` |

## Code Style

- **Linting**: Biome
- **Indentation**: 2 spaces
- **Quotes**: Single
- **TypeScript**: Strict mode

## CSS/Styling

**必須**: CSS変数を使用、ハードコード色禁止

```typescript
// CORRECT
<Card className="bg-background text-foreground">

// WRONG
<Card className="bg-white text-black">
```

