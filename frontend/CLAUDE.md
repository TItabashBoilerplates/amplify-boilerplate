# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a Next.js frontend application following Feature-Sliced Design (FSD) methodology:

### Feature-Sliced Design Architecture

- **Methodology**: Feature-Sliced Design (FSD) with strict layer-based organization
- **Application**: Next.js 16 application with App Router
- **UI Framework**: shadcn/ui components with TailwindCSS 4 for styling
- **Tech Stack**: React 19, TypeScript, Next.js 16, shadcn/ui, Lucide React icons
- **Package Manager**: pnpm (fast, disk-efficient; required because the Amplify `ampx` CLI rejects bun)
- **Build System**: Next.js built-in build system with Turbopack (default in Next.js 16)
- **Internationalization**: next-intl for multi-language support (English & Japanese)
- **State Management**: Zustand for client-side state, TanStack Query for server state
- **Integration**: AWS Amplify (Cognito auth, AppSync + DynamoDB data, S3 storage) via `@workspace/auth` / `@workspace/data-client` / `@workspace/backend`

### FSD Layer Structure

```
frontend/
├── app/              # Next.js App Router (at project root, outside src/)
│   ├── [locale]/     # Locale-based routes
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Root page
└── src/              # FSD layers (inside src/)
    ├── app/          # FSD Application layer - providers, global styles
    ├── views/        # FSD Views layer - full page components
    ├── widgets/      # Widgets layer - large composite UI blocks
    ├── features/     # Features layer - business features and user scenarios
    ├── entities/     # Entities layer - business entities and domain models
    └── shared/       # Shared layer - reusable infrastructure code
```

**Important**: FSD architecture notes for Next.js:
- Next.js App Router is at project root (`app/`)
- FSD layers are in `src/` directory
- FSD Views layer (`views/`) renamed from `pages/` to avoid conflict with Next.js
- Use `@/views/*` import alias for FSD views layer

### Layer Import Rules

- **Layers can only import from lower layers**: `app` > `views` > `widgets` > `features` > `entities` > `shared`
- **Same layer imports**: Prohibited (use cross-imports with `@x` notation if absolutely necessary)
- **Upward imports**: Strictly forbidden

## Development Commands

### Frontend Development

すべて devenv の **scripts** (PATH 直結) または **tasks** (`devenv tasks run <name>`) を使用する。Makefile は **deprecated**（削除済み）。直接 `cd frontend && pnpm run X` での実行は禁止。

```bash
# Amplify backend（Supabase ローカル Docker の代替、AWS 認証情報が必要）
sandbox                 # ampx sandbox（per-dev クラウド sandbox + amplify_outputs.json 生成、watch）
sandbox-once            # 1 回デプロイして終了
sandbox-delete          # sandbox 破棄

# Services
dev-web                 # Next.js (web)
dev-mobile              # Expo Metro (mobile, non-interactive)
storybook               # Storybook
devenv up <names...>    # 任意組み合わせ
stop                    # devenv プロセス停止

# Quality
lint-frontend           # Biome lint (auto-fix)
format-frontend         # Biome format (auto-fix)
type-check-frontend     # tsc --noEmit
lint-fsd                # FSD boundary check (web + mobile, ESLint)
test-frontend           # Vitest

# Build
build-frontend          # Next.js production build
build-storybook         # Storybook static build

# Package management
# `devenv shell` 進入時 (direnv 経由含む) に `setup:install-frontend` task が
# lockfile 変更を検知して pnpm install を自動実行するので手動実行は通常不要。
# 個別パッケージ追加は ni / nr / nlx を使う:
ni package              # 依存追加 (= pnpm add package)
ni -D package           # 開発依存追加 (= pnpm add -D package)
nr <script>             # package.json scripts 実行 (= pnpm run <script>)
nlx <command>           # 一時実行 (= pnpm dlx <command>)
```

正典: `/.claude/rules/commands.md`

### Component Management

#### MagicUI Components (Primary Choice)

```bash
# Use MagicUI MCP for modern, animated UI components
# Access through MagicUI MCP tools - these should be your FIRST choice for any UI needs
# Available categories: Components, Device Mocks, Special Effects, Animations,
# Text Animations, Buttons, Backgrounds
```

#### shadcn/ui Components (Fallback)

```bash
# Add basic shadcn/ui components only when MagicUI doesn't provide suitable alternatives
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add form
```

## Code Style and Quality

### Frontend

- **Linting & Formatting**: Biome (all-in-one toolchain, replaces ESLint + Prettier)
- **Configuration**: `biome.json` at root with Next.js-optimized rules
- **Code Style**: 2-space indentation, 100-character line width, single quotes, semicolons as needed
- **TypeScript**: Strict mode enabled with type-only import enforcement
- **Styling**: TailwindCSS 4 with CSS variables
- **UI Components**: shadcn/ui component library with "New York" style
- **Import Organization**: Auto-organize imports on save/format

### FSD-Compliant UI Design System

- **Primary Components**: MagicUI components (accessed via MCP) for modern, animated UI elements
- **Secondary Components**: shadcn/ui components built on Radix UI primitives (fallback only)
- **Component Placement**: `src/shared/ui/magicui/` for MagicUI, `src/shared/ui/` for shadcn/ui
- **Package Runner**: Use `pnpm dlx` instead of `npx` for shadcn/ui component installation
- **Styling**: TailwindCSS with CSS variables for theming
- **Icons**: Lucide React icon library
- **Theme Configuration**: CSS variables defined in `src/app/styles/globals.css`
- **Component Aliases**: Configured in `components.json` with FSD structure
  - `@/shared/ui` - Reusable UI components (shadcn/ui)
  - `@/shared/lib` - Utility functions and libraries
  - `@/shared/api` - API client and request functions
  - `@/shared/config` - Configuration and environment variables
  - `@/entities` - Business entities and domain models
  - `@/features` - Business features and user scenarios
  - `@/widgets` - Composite UI blocks
  - `@/views` - Full page components
  - `@/app` - Application-level code

### FSD Implementation Guidelines

1. **Layer Placement**: Follow strict FSD layer hierarchy and import rules
2. **Components**: Use shadcn/ui components from `shared/ui` layer
3. **Styling**: Use TailwindCSS utility classes, avoid custom CSS
4. **Icons**: Use Lucide React icons consistently
5. **Theme**: Support light/dark modes using CSS variables
6. **Accessibility**: shadcn/ui components are accessible by default
7. **Type Safety**: Use TypeScript for all components and utilities
8. **Public API**: Create index.ts files for each slice to expose public interfaces
9. **Segments**: Organize code within slices using segments (ui, api, model, lib)

### Rendering Strategy Guidelines (Next.js Official Best Practices)

**IMPORTANT**: Always follow Next.js official best practices for rendering strategies:

1. **Public Pages (No Authentication Required)**: **SSG/SSR (Server Components) - MANDATORY**
   - DO NOT use `'use client'` directive
   - Implement as `async` functions
   - Use `getTranslations` from `next-intl/server` (NOT `useTranslations`)
   - Benefits: Best performance, SEO optimization, works without JavaScript
   - Example: Home page, About page, Blog posts

2. **Authenticated Pages (Login Required)**: **Hybrid (SSR + CSR) - STANDARD**

   **Standard Implementation: Hybrid (SSR + CSR) - Next.js Official Recommendation**
   - Page wrapper: Server Component (`async` function, NO `'use client'`)
   - Server-side authentication check with `await auth()` or `await verifySession()`
   - Interactive parts: Client Components (with `'use client'`)
   - Benefits: Fast initial load, server-side auth check, SEO support, security
   - Hydration management: Proper patterns prevent hydration errors (see docs/rendering-strategy.md)
   - Use for: Dashboards, settings pages, profiles, admin panels (almost all authenticated pages)

   **Special Case Only: Full CSR - NOT RECOMMENDED**
   - ⚠️ Use ONLY for real-time chat, collaborative editors requiring persistent WebSocket/SSE
   - Entire page: Client Component (with `'use client'`)
   - Trade-offs: Slower initial load, client-side auth only (security risk), no SEO, against Next.js design philosophy
   - ❌ DO NOT use simply because "it's easier to implement"

3. **Interactive Components**: **CSR (Client Components)**
   - USE `'use client'` directive
   - Use React Hooks (useState, useEffect, etc.)
   - Handle user interactions
   - Example: Forms, real-time updates, animations

4. **Hybrid Pattern** (Standard best practice):
   - Server Component for main page logic, authentication, and data fetching
   - Extract interactive parts into separate Client Components
   - Example: DashboardPage (Server) + UserSettings (Client)
   - This is the default approach for Next.js applications

**Build Output Indicators:**
- `●  (SSG)`: Static Site Generation - Optimal for public pages
- `ƒ  (Dynamic)`: Server-Side Rendering - For authenticated pages
- `○  (Static)`: Static content

For detailed guidelines, see `docs/rendering-strategy.md`

### AWS Amplify Integration Guidelines

This project uses **AWS Amplify** for backend services (Cognito auth, AppSync + DynamoDB data, S3 storage),
following both Next.js and Amplify official best practices.

#### Clients

| Concern | Where | Import / API |
|---------|-------|--------------|
| **Auth (server)** | Server Components, Server Actions, Route Handlers | `runWithAmplifyServerContext` (`@/shared/lib/amplify/server`) + `getCurrentUser` / `fetchAuthSession` (`aws-amplify/auth/server`) |
| **Auth (client)** | Client Components | `aws-amplify/auth` (`signIn`, `confirmSignIn`, `resendSignInCode`, `signOut`) and `@workspace/auth` (`useAuthUser`, `useIsAuthenticated`) |
| **Data** | Server & Client | `getDataClient()` (`@workspace/data-client`) → `models.X.list()/get()/create()/update()/delete()`; type via `import type { Schema } from '@workspace/backend'` |

#### Authentication Best Practices

**🔒 CRITICAL SECURITY REQUIREMENT:**

In server code, always resolve the user via `runWithAmplifyServerContext` + `getCurrentUser`.
Authorization is enforced by Cognito + the per-model rules in `amplify/data/resource.ts`
(`allow.owner()` / `allow.authenticated()` / `allow.guest()`), which replace RLS.

Auth is **passwordless Email OTP**: `signIn({ username: email, options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' } })` → `confirmSignIn({ challengeResponse: code })`.

#### Implementation Patterns

**Public Pages (No Authentication):**
```tsx
// Server Component
import { getDataClient } from '@workspace/data-client'

export default async function BlogPage() {
  const { data } = await getDataClient().models.Post.list()
  return <BlogList posts={data} />
}
```

**Authenticated Pages (Standard Pattern):**
```tsx
// Server Component - Page wrapper
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from 'aws-amplify/auth/server'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'
import { getDataClient } from '@workspace/data-client'

export default async function DashboardPage() {
  const user = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: (contextSpec) => getCurrentUser(contextSpec),
  }).catch(() => null)

  if (!user) redirect('/login')

  const { data } = await getDataClient().models.UserData.list()

  return <Dashboard data={data} user={user} />
}
```

**Client Components with Amplify Data + Zustand:**
```tsx
// Client Component
'use client'

import { getDataClient } from '@workspace/data-client'
import { useUserStore } from '@/entities/user/model/store'

export function UserSettings({ initialData }) {
  const updateUser = useUserStore((state) => state.updateUser)

  const handleUpdate = async () => {
    const { data } = await getDataClient().models.Profile.update({ id, ...changes })
    if (data) updateUser(data) // Update Zustand store
  }

  return <button onClick={handleUpdate}>Save</button>
}
```

**Real-time Subscriptions (Client Component Only):**
```tsx
'use client'

import { getDataClient } from '@workspace/data-client'

export function RealtimeUpdates() {
  useEffect(() => {
    // Amplify Data observeQuery streams live updates from AppSync
    const sub = getDataClient().models.Post.observeQuery().subscribe({
      next: ({ items }) => setPosts(items),
    })
    return () => sub.unsubscribe()
  }, [])
}
```

#### Usage Matrix

| Feature | Component Type | Amplify API | State Management |
|---------|---------------|-------------|------------------|
| Auth check | Server Component | `runWithAmplifyServerContext` + `getCurrentUser` | N/A |
| Initial data fetch | Server Component | `getDataClient().models.X.list()` | Props |
| Real-time subscriptions | Client Component | `models.X.observeQuery()` | useState/Zustand |
| User interactions | Client Component | `getDataClient().models.X` | Zustand |
| Form submissions | Server Action | `getDataClient().models.X.create()` | N/A |

#### Security Requirements

1. **Authentication**: Resolve the user in a Server Component via `runWithAmplifyServerContext` + `getCurrentUser`
2. **Cache Control**: Call `cookies()` before user-specific Amplify operations in authenticated pages
3. **Authorization**: Declare access in `amplify/data/resource.ts` (`allow.*`) — do not rely on client-side checks
4. **Config**: `amplify_outputs.json` is generated by `ampx sandbox`; the client is configured via `ConfigureAmplifyClientSide`

#### Hydration Error Prevention (CRITICAL)

**⚠️ MUST AVOID HYDRATION ERRORS AT ALL COSTS**

Follow these rules strictly when using Amplify with Next.js:

**Rule 1: Server Component = Static Data Only**
- Only render data that is confirmed on the server
- NO conditional rendering based on auth state in Server Components
- Use `redirect()` for unauthenticated users instead of conditional UI

```tsx
// ✅ GOOD
export default async function Page() {
  const user = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: (s) => getCurrentUser(s),
  }).catch(() => null)
  if (!user) redirect('/login') // Redirect, not conditional UI
  return <div>Welcome {user.signInDetails?.loginId}</div>
}

// ❌ BAD - Hydration risk
export default async function Page() {
  const user = await getCurrentUserOrNull()
  return <div>{user ? 'Logged in' : 'Not logged in'}</div>
}
```

**Rule 2: Client Component = Use `mounted` Flag**
- Always use `mounted` state for browser-dependent logic
- Render `null` or loading state until mounted
- This prevents server/client HTML mismatch

```tsx
// ✅ GOOD
'use client'
export function Component() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null
  // Safe to use browser APIs here
}
```

**Rule 3: Real-time Data = Client Component Only**
- NEVER use `observeQuery()` in Server Components
- Pass initial data from Server Component to Client Component
- Subscribe to real-time updates in Client Component only

```tsx
// ✅ GOOD Pattern
// Server Component
export default async function Page() {
  const { data: initial } = await getDataClient().models.Post.list()
  return <PostsList initialData={initial} />
}

// Client Component
'use client'
export function PostsList({ initialData }) {
  const [posts, setPosts] = useState(initialData)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const sub = getDataClient().models.Post.observeQuery().subscribe({
      next: ({ items }) => setPosts(items),
    })
    return () => sub.unsubscribe()
  }, [])

  if (!mounted) return null
  return <>{posts.map(...)}</>
}
```

**Rule 4: Time/Random Values = Client Component Only**
- Date formatting (timeAgo, relative time, etc.)
- Random values
- All must be in Client Component with `mounted` guard

**Rule 5: Props Flow = Server → Client**
- Server Component fetches initial data
- Pass data to Client Component via props
- Client Component manages dynamic updates

For complete hydration prevention patterns, see `docs/rendering-strategy.md` - "Hydrationエラーの完全回避ガイド" section.

#### Common Patterns

**Pattern 1: Server Component + Client Component Hybrid**
```tsx
// ✅ Recommended
// Server Component handles auth + initial data
// Client Component handles interactivity + Zustand
```

**Pattern 2: Real-time Features**
```tsx
// ✅ Always in Client Component
// Amplify Data observeQuery only works in the browser client
```

**Pattern 3: Zustand Integration**
```tsx
// ✅ Client Component only
// Server Component passes initial data via props
// Client Component updates Zustand store
```

For complete examples and detailed patterns, see `docs/rendering-strategy.md`.

### Example: FSD-Compliant Implementation with SSR/CSR

```typescript
// ✅ Good example: Public page with SSR (Server Component)
// views/home/ui/HomePage.tsx
import { getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from './LanguageSwitcher'

/**
 * ホームページ（Server Component - SSG）
 * ログイン不要のパブリックページのため、SSRで実装
 */
export default async function HomePage() {
  const t = await getTranslations('HomePage')

  return (
    <div>
      <h1>{t('title')}</h1>
      <LanguageSwitcher /> {/* Interactive part as Client Component */}
    </div>
  )
}

// ✅ Good example: Interactive component (Client Component)
// views/home/ui/LanguageSwitcher.tsx
'use client'

import { Link } from '@/shared/lib/i18n'

/**
 * 言語切り替えコンポーネント（Client Component）
 * ユーザーインタラクションを処理するため、CSRで実装
 */
export function LanguageSwitcher() {
  return (
    <div>
      <Link href="/" locale="en">English</Link>
      <Link href="/" locale="ja">日本語</Link>
    </div>
  )
}

// ✅ Good example: Authenticated page (Amplify + Next.js Best Practice)
// views/dashboard/ui/DashboardPage.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from 'aws-amplify/auth/server'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'
import { getDataClient } from '@workspace/data-client'
import { UserSettings } from './UserSettings'

/**
 * ダッシュボードページ（Server Component - Amplify + Next.js公式推奨パターン）
 * サーバーで Cognito 認証チェックとデータ取得、インタラクティブ部分のみ Client Component
 */
export default async function DashboardPage() {
  await cookies() // Disable cache for user-specific data

  // 🔒 Cognito authentication check (server context)
  const user = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: (contextSpec) => getCurrentUser(contextSpec),
  }).catch(() => null)

  if (!user) redirect('/login')

  // Server-side data fetching with Amplify Data (authorization via allow.owner())
  const { data: profiles } = await getDataClient().models.UserProfile.list()
  const userData = profiles?.[0]

  return (
    <div>
      {/* Static content rendered on server */}
      <h1>Welcome, {user.signInDetails?.loginId}</h1>
      <p>User ID: {user.userId}</p>

      {/* Interactive parts as Client Components */}
      <UserSettings initialData={userData} userId={user.userId} />
    </div>
  )
}

// views/dashboard/ui/UserSettings.tsx (Client Component with Amplify Data + Zustand)
'use client'

import { useState } from 'react'
import { getDataClient } from '@workspace/data-client'
import { useUserStore } from '@/entities/user/model/store'

export function UserSettings({ initialData, userId }) {
  const [settings, setSettings] = useState(initialData)
  const updateUser = useUserStore(state => state.updateUser) // Zustand

  const handleUpdate = async () => {
    // Amplify Data client for client-side operations
    const { data, errors } = await getDataClient().models.UserProfile.update({
      id: settings.id,
      ...settings,
    })

    if (!errors && data) {
      setSettings(data)
      updateUser(data) // Update Zustand store
    }
  }

  return (
    <div>
      <button onClick={handleUpdate}>Update Settings</button>
    </div>
  )
}

// ⚠️ Special case ONLY: Full CSR (NOT RECOMMENDED)
// Use ONLY for real-time chat, collaborative editors, etc.
// views/chat/ui/ChatPage.tsx
'use client'

import { useState, useEffect } from 'react'
import { useWebSocket } from '@/shared/lib/websocket'

/**
 * チャットページ（Full CSR - 特殊ケース）
 * ⚠️ WebSocket常時接続が必須のため、例外的にFull CSRを使用
 */
export default function ChatPage() {
  const { messages, sendMessage } = useWebSocket()
  // Real-time bidirectional communication logic
  return <div>{/* Chat UI */}</div>
}

// ✅ Good example: FSD structure with shadcn/ui
// shared/ui/card/index.ts - Reusable UI component
export { Button } from "@/shared/ui/button"
export { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"

// entities/user/ui/UserCard.tsx - Business entity component
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Calendar } from "lucide-react"

export function UserCard({ user }) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {user.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{user.email}</p>
        <Button variant="default">View Profile</Button>
      </CardContent>
    </Card>
  )
}

// ❌ Bad example: Wrong layer placement and custom styling
// views/home/ui/HomePage.tsx - View importing from non-shared layer
import { UserCard } from "@/entities/user" // ✅ This is correct
import { LoginForm } from "@/features/auth" // ✅ This is correct

// ❌ Wrong - upward import from shared to entities
// shared/ui/SomeComponent.tsx
import { User } from "@/entities/user" // ❌ Shared cannot import from entities
```

## FSD Project Structure

```
frontend/
├── src/                   # Source code following FSD methodology
│   ├── app/              # Application layer
│   │   ├── providers/    # Global providers (Redux, React Query, etc.)
│   │   ├── styles/       # Global styles and CSS variables
│   │   └── index.tsx     # Application entry point
│   ├── views/            # Views layer
│   │   ├── home/         # Home view slice
│   │   │   ├── ui/       # View UI components
│   │   │   ├── api/      # View-specific API calls
│   │   │   └── index.ts  # Public API
│   │   └── auth/         # Auth views slice
│   ├── widgets/          # Widgets layer
│   │   ├── header/       # Header widget
│   │   ├── sidebar/      # Sidebar widget
│   │   └── footer/       # Footer widget
│   ├── features/         # Features layer
│   │   ├── auth/         # Authentication feature
│   │   │   ├── ui/       # Feature UI components
│   │   │   ├── api/      # Feature API calls
│   │   │   ├── model/    # Feature business logic
│   │   │   └── index.ts  # Public API
│   │   └── theme-toggle/ # Theme switching feature
│   ├── entities/         # Entities layer
│   │   ├── user/         # User entity
│   │   │   ├── ui/       # User-related UI components
│   │   │   ├── api/      # User API calls
│   │   │   ├── model/    # User business logic and types
│   │   │   └── index.ts  # Public API
│   │   └── article/      # Article entity
│   └── shared/           # Shared layer
│       ├── ui/           # Reusable UI components (shadcn/ui)
│       │   ├── button/   # Button component
│       │   ├── card/     # Card component
│       │   └── input/    # Input component
│       ├── api/          # API client and base requests
│       │   ├── client.ts # HTTP client configuration
│       │   └── index.ts  # Public API
│       ├── lib/          # Utility functions and libraries
│       │   ├── utils.ts  # General utilities
│       │   └── hooks.ts  # Reusable React hooks
│       └── config/       # Configuration and constants
│           ├── env.ts    # Environment variables
│           └── routes.ts # Route constants
├── app/                  # Next.js App Router (at project root)
│   ├── [locale]/        # Locale-based routes
│   │   ├── layout.tsx   # Locale layout (with i18n provider)
│   │   └── page.tsx     # Locale page (imports from src/views/home)
│   ├── layout.tsx       # Minimal root layout
│   ├── page.tsx         # Root page (triggers 404)
│   └── not-found.tsx    # 404 page
├── components.json       # shadcn/ui configuration (points to src/shared/ui)
├── next.config.ts        # Next.js configuration
├── package.json          # Dependencies and scripts
├── pnpm-lock.yaml         # pnpm lockfile
├── pnpm-workspace.yaml     # pnpm workspace definition
├── postcss.config.mjs    # PostCSS configuration for Tailwind
├── tailwind.config.ts    # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration with FSD paths
```

## FSD Layer Definitions

### App Layer

- **Purpose**: Application initialization, global providers, and configuration
- **Contains**: Providers, global styles, app entry points, routing configuration
- **Examples**: `src/app/providers/index.tsx`, `src/app/styles/globals.css`

### Views Layer

- **Purpose**: Complete view components that compose widgets, features, and entities
- **Contains**: Full page implementations, view-specific logic
- **Segments**: `ui` (view components), `api` (view loaders/actions)
- **Examples**: `views/home/ui/HomePage.tsx`, `views/auth/ui/LoginPage.tsx`

### Widgets Layer

- **Purpose**: Large, composite UI blocks that combine features and entities
- **Contains**: Header, sidebar, footer, complex UI compositions
- **Segments**: `ui` (widget components), `model` (widget state)
- **Examples**: `widgets/header/ui/Header.tsx`, `widgets/article-list/ui/ArticleList.tsx`

### Features Layer

- **Purpose**: Business features and user interaction scenarios
- **Contains**: User actions, business processes, feature-specific logic
- **Segments**: `ui` (feature UI), `api` (feature requests), `model` (business logic)
- **Examples**: `features/auth/ui/LoginForm.tsx`, `features/article-create/api/createArticle.ts`

### Entities Layer

- **Purpose**: Business entities and domain models
- **Contains**: Data models, entity-specific UI components, entity operations
- **Segments**: `ui` (entity components), `api` (CRUD operations), `model` (types, adapters)
- **Examples**: `entities/user/model/types.ts`, `entities/article/ui/ArticleCard.tsx`

### Shared Layer

- **Purpose**: Reusable code without business logic dependencies
- **Contains**: UI kit, utilities, API clients, configurations
- **Segments**: `ui` (shadcn/ui components), `api` (HTTP client), `lib` (utilities), `config` (constants)
- **Examples**: `shared/ui/button/index.ts`, `shared/api/client.ts`

## FSD Implementation Rules

### Public API Pattern

Every slice must export its interface through `index.ts`:

```typescript
// entities/user/index.ts
export { UserCard } from './ui/UserCard'
export { UserAvatar } from './ui/UserAvatar'
export type { User, UserDto } from './model/types'
export { userApi } from './api'
```

### Cross-Import Rules

- **Same layer imports**: Use `@x` notation for necessary cross-references

```typescript
// entities/artist/@x/song.ts
export type { Song } from '../model/song.ts'

// entities/artist/model/types.ts
import type { Song } from 'entities/song/@x/artist'
```

### Segment Organization

Standard segments within slices:

- **ui**: React components and UI logic
- **api**: HTTP requests, data fetching
- **model**: Business logic, types, state management
- **lib**: Slice-specific utilities
- **config**: Slice-specific configuration

This implementation ensures a consistent, scalable, and maintainable FSD architecture.

## MCP Integration Guidelines

### Context7 Documentation Lookup (Mandatory)

Always use Context7 MCP when working with external libraries or frameworks:

1. **Before Implementation**: Always resolve library documentation using Context7

```bash
# Use mcp__context7__resolve-library-id to find correct library ID
# Then use mcp__context7__get-library-docs for up-to-date documentation
```

2. **Required for**: React, Next.js, TypeScript, TailwindCSS, Zustand, AWS Amplify, and any other external dependencies
3. **Benefits**: Ensures you have the latest API documentation and best practices

### MagicUI MCP (Primary UI Component Source)

**IMPORTANT**: Always use MagicUI components as your PRIMARY choice for UI development:

#### Component Selection Priority:

1. **First**: Check MagicUI MCP for suitable components
2. **Second**: Use shadcn/ui only if MagicUI doesn't have what you need
3. **Last**: Create custom components only if neither above options work

#### Available MagicUI Categories:

- **Components**: General UI components (marquee, terminal, bento-grid, etc.)
- **Device Mocks**: Mobile and device mockups (safari, iphone-15-pro, android)
- **Special Effects**: Visual effects (animated-beam, border-beam, particles, etc.)
- **Animations**: Motion and transition effects (blur-fade)
- **Text Animations**: Text-specific animations (animated-gradient-text, typing-animation, etc.)
- **Buttons**: Interactive button components (rainbow-button, shimmer-button, etc.)
- **Backgrounds**: Background patterns and effects (warp-background, animated-grid-pattern, etc.)

#### Implementation Process:

1. Use appropriate MagicUI MCP tool to get component implementation
2. Place components in `src/shared/ui/magicui/` directory
3. Create proper index.ts exports following FSD Public API pattern
4. Import using FSD-compliant paths: `import { Component } from "@/shared/ui/magicui/component"`

### Playwright MCP (UI Testing)

**MANDATORY**: Use Playwright MCP for all UI testing and verification:

#### Testing Requirements:

1. **After UI Changes**: Always test with Playwright before considering work complete
2. **Navigation Testing**: Verify all routes and navigation work correctly
3. **Component Testing**: Test interactive elements, forms, and user flows
4. **Cross-browser**: Test critical paths in different viewport sizes

#### Testing Process:

1. Start development server: `dev-web` (or `devenv up web`)
2. Use `mcp__playwright__browser_navigate` to access pages
3. Use `mcp__playwright__browser_snapshot` to verify page state
4. Use `mcp__playwright__browser_click`, `mcp__playwright__browser_type` for interactions
5. Take screenshots with `mcp__playwright__browser_take_screenshot` when needed

#### Required Test Scenarios:

- Page loads without 404 errors
- All interactive elements respond correctly
- Forms submit and validate properly
- Responsive design works on different screen sizes
- Dark/light mode switching (if implemented)

### Integration Workflow

1. **Documentation**: Use Context7 MCP to get latest library docs
2. **Component Selection**: Check MagicUI MCP first for UI components
3. **Implementation**: Follow FSD architecture with proper layer placement
4. **Testing**: Verify with Playwright MCP before completion
5. **Documentation Update**: Update relevant documentation if needed

This MCP-integrated workflow ensures high-quality, well-tested, and properly documented code.
