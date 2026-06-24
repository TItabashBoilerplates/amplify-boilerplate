---
name: fsd
description: Feature Sliced Design (FSD) architecture guidance. Use when creating new features, entities, widgets, views, or asking about FSD structure.
---

# Feature Sliced Design (FSD)

This project follows Feature Sliced Design architecture.

## Directory Structure

```
frontend/apps/web/
├── app/                    # Next.js App Router
│   └── [locale]/          # Locale-based routes
└── src/                   # FSD layers
    ├── app/               # Application layer - providers, global styles
    ├── views/             # Views layer - full page components
    ├── widgets/           # Widgets layer - composite UI blocks
    ├── features/          # Features layer - business features
    ├── entities/          # Entities layer - business entities
    └── shared/            # Shared layer - shared infrastructure
```

## Layer Hierarchy and Import Rules

```
App → Views → Widgets → Features → Entities → Shared
↓       ↓       ↓         ↓          ↓         ↓
Can only import from lower layers (imports to upper layers prohibited)
```

**Important Rules**:
- Each layer can only import from lower layers
- Same-layer imports are prohibited by default
- Upper-layer imports are strictly forbidden

## Segment Structure

Each slice consists of:

| Segment | Purpose | Examples |
|---------|---------|----------|
| **ui/** | React components | `UserAvatar.tsx`, `LoginForm.tsx` |
| **api/** | Server Actions, API calls | `signInWithOtp.ts`, `verifyOtp.ts` |
| **model/** | Types, state management, business logic | `types.ts`, `store.ts`, `hooks.ts` |

## Public API Pattern (REQUIRED)

All slices must define Public API via `index.ts`:

```typescript
// entities/user/index.ts
export { useAuthUser, useUser } from './model/hooks'
export { useUserStore } from './model/store'
export type { AuthUser, User, UserProfile } from './model/types'
export { UserAvatar } from './ui/UserAvatar'
```

## Creating New Slices

### Entity

```
src/entities/new-entity/
├── ui/
│   └── EntityComponent.tsx
├── model/
│   ├── types.ts
│   ├── store.ts
│   └── hooks.ts
└── index.ts
```

### Feature

```
src/features/new-feature/
├── ui/
│   └── FeatureComponent.tsx
├── api/
│   └── featureAction.ts
├── model/
│   └── types.ts
└── index.ts
```

### Widget

```
src/widgets/new-widget/
├── ui/
│   └── Widget.tsx
└── index.ts
```

### View

```
src/views/new-view/
├── ui/
│   └── NewViewPage.tsx
└── index.ts
```

## Import Examples

```typescript
// Good - import from lower layer
import { Button } from '@/shared/ui/button'
import { useUserStore } from '@/entities/user'
import { LoginForm } from '@/features/auth'
import { Header } from '@/widgets/header'

// Bad - import from upper layer
import { HomePage } from '@/views/home'  // from features - WRONG
```
