# Frontend

Modern full-stack frontend monorepo built with Next.js 16, React 19, and Feature-Sliced Design architecture.

## Architecture Overview

This frontend follows **Feature-Sliced Design (FSD)**, an architectural methodology that organizes code by business value and technical purpose.

### Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI Library**: React 19
- **Design System**: shadcn/ui (Radix UI + TailwindCSS 4)
- **Package Manager**: Bun 1.2.8
- **Build System**: Turbo (monorepo management)
- **State Management**: Zustand
- **Internationalization**: next-intl
- **Code Quality**: Biome (linting & formatting)

## Project Structure

```
frontend/
├── apps/
│   ├── web/                    # Next.js application
│   │   ├── app/                # Next.js App Router
│   │   │   ├── [locale]/       # Internationalized routes
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── src/                # Feature-Sliced Design layers
│   │       ├── app/            # Application layer (providers, global styles)
│   │       ├── views/          # Views layer (full-page components)
│   │       ├── widgets/        # Widgets layer (composite UI blocks)
│   │       ├── features/       # Features layer (business features)
│   │       ├── entities/       # Entities layer (business entities)
│   │       └── shared/         # Shared layer (reusable code)
│   │
│   └── mobile/                 # Expo React Native application
│       ├── app/                # Expo Router (file-based routing)
│       └── components/         # App-specific components
│
├── packages/
│   ├── ui/
│   │   ├── web/                # shadcn/ui + MagicUI (Web)
│   │   │   ├── components/     # shadcn/ui components
│   │   │   ├── magicui/        # MagicUI components
│   │   │   └── lib/            # Utilities (cn, etc.)
│   │   └── mobile/             # gluestack-ui (React Native)
│   │       ├── components/     # gluestack-ui components
│   │       ├── layout/         # Layout components
│   │       └── hooks/          # Mobile-specific hooks
│   │
│   ├── tokens/                 # Design tokens (shared)
│   │   ├── src/                # Token definitions (colors, radius)
│   │   └── scripts/            # CSS generation scripts
│   │
│   ├── auth/                   # Authentication (Cognito): AuthProvider, useAuthUser
│   ├── backend/                # Amplify Gen2 backend (auth/data/storage/functions) + Schema type
│   ├── data-client/            # Amplify Data client (getDataClient)
│   ├── types/                  # Shared generic types
│   ├── api-client/             # Backend API client
│   └── query/                  # TanStack Query configuration
│
└── tooling/                    # Development tools
    ├── typescript/             # TypeScript configurations
    └── tailwind/               # TailwindCSS configurations
```

## Feature-Sliced Design (FSD)

FSD organizes code into **layers** and **slices**, promoting maintainability and scalability.

### Layers (Top to Bottom)

1. **App** (`src/app/`) - Application initialization, providers, global styles
2. **Views** (`src/views/`) - Full-page components (HomePage, LoginPage, etc.)
3. **Widgets** (`src/widgets/`) - Composite UI blocks (Header, Footer, AuthStatus)
4. **Features** (`src/features/`) - Business features (auth, locale-switcher, user-menu)
5. **Entities** (`src/entities/`) - Business entities (user, chat, etc.)
6. **Shared** (`src/shared/`) - Reusable code (UI components, utils, API clients)

### Segments (Within Each Slice)

- **ui** - React components
- **api** - API calls
- **model** - Business logic, types, state management
- **lib** - Utilities
- **config** - Configuration

### Layer Rules

- **Higher layers can import from lower layers** (e.g., Features can import from Entities)
- **Lower layers cannot import from higher layers** (e.g., Entities cannot import from Features)
- **Slices within the same layer cannot import from each other directly** (use lower layers)

## Design System

This project uses a **platform-specific UI approach**:

| Platform | UI Library | Package |
|----------|------------|---------|
| **Web** | shadcn/ui + MagicUI | `@workspace/ui` |
| **Mobile** | gluestack-ui + NativeWind | `@workspace/native-ui` |
| **Shared** | Design Tokens | `@workspace/tokens` |

### Web: shadcn/ui Components

**shadcn/ui** provides accessible, customizable components built on Radix UI.

#### Adding New Components (Web)

```bash
# From frontend directory
pnpm run ui:add:web button card input dialog

# Or directly
cd packages/ui && pnpm dlx shadcn@canary add button
```

Components are installed to `packages/ui/components/`.

#### Available Components

- Button, Card, Input, Label
- Dialog, Dropdown Menu, Select
- Avatar, Separator, Navigation Menu
- And more...

### Mobile: gluestack-ui Components

**gluestack-ui** provides accessible components optimized for React Native with NativeWind styling.

#### Adding New Components (Mobile)

```bash
# From frontend directory
pnpm run ui:add:mobile button card input

# Or directly
cd packages/native-ui && pnpm dlx gluestack-ui@latest add button
```

Components are installed to `packages/native-ui/components/`.

### Design Tokens

Shared design tokens (colors, radius, spacing) are defined in `packages/tokens/`:

```typescript
// Usage in both Web and Mobile
import { colors, radius } from '@workspace/tokens'
```

Generate CSS files:
```bash
pnpm run tokens:build
```

### TailwindCSS 4 with CSS Variables

**Use CSS variables for colors** (supports dark mode automatically):

```tsx
// ✅ Good: Using CSS variables
<Card className="border-border bg-background">
  <h2 className="text-foreground">Title</h2>
  <p className="text-muted-foreground">Description</p>
</Card>

// ❌ Bad: Hardcoded colors
<Card className="border-gray-200 bg-white">
  <h2 className="text-black">Title</h2>
  <p className="text-gray-600">Description</p>
</Card>
```

#### Available CSS Variables

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`, `--radius`

Theme configuration: `packages/tokens/` and `apps/web/app/globals.css`

## Development

### Getting Started

すべて devenv の **scripts** (PATH 直結) または **tasks** (`devenv tasks run <name>`) を使用する。Makefile は **deprecated**（削除済み）。

```bash
# Setup
# `devenv shell` 進入 (direnv 経由含む) で setup:* タスクが自動実行され
# pnpm install / uv sync が完了する。明示的な init コマンドは不要。

# Start development server
dev-web                 # Next.js (web) dev サーバ
# または
devenv up web           # web を devenv プロセスとして起動

# Amplify backend は別途 sandbox で起動する（AWS 認証情報が必要）
sandbox                 # ampx sandbox（per-dev クラウド sandbox + amplify_outputs.json 生成、watch）
```

### Common Commands (devenv scripts on PATH)

```bash
# Amplify backend (sandbox, AWS 認証情報が必要)
sandbox                # ampx sandbox (per-dev クラウド sandbox + amplify_outputs.json 生成)
sandbox-once           # 1 回デプロイして終了
sandbox-delete         # sandbox 破棄

# Development
dev-web                # Next.js (web) dev サーバ
dev-mobile             # Expo Metro (mobile, non-interactive)
storybook              # Storybook
devenv up <names...>   # 任意のサーバを組み合わせて起動 (web / mobile / storybook)
build-frontend         # Next.js production build
type-check-frontend    # TypeScript type check

# Code Quality
lint-frontend          # Biome lint (auto-fix)
lint-frontend-ci       # Biome lint (CI, no fix)
format-frontend        # Biome format (auto-fix)
format-frontend-check  # Biome format check
lint-fsd               # FSD boundary check (web + mobile, ESLint)

# UI Components (devenv shell 内で nlx 経由)
nlx shadcn@latest add <name>          # shadcn/ui (Web)
nlx gluestack-ui@latest add --use-bun # gluestack-ui (Mobile)

# Types (手動の型生成タスクは不要)
# データモデルの型は `import type { Schema } from '@workspace/backend'` で共有され、
# amplify_outputs.json は `sandbox` (= ampx sandbox) が生成する。
```

正典: `/.claude/rules/commands.md`

## Internationalization (i18n)

This project uses **next-intl** for internationalization.

### Supported Locales

- `en` - English
- `ja` - Japanese

### Adding Translations

Edit message files:
- `src/shared/config/i18n/messages/en.json`
- `src/shared/config/i18n/messages/ja.json`

### Usage in Components

```tsx
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('HomePage');

  return <h1>{t('title')}</h1>;
}
```

## Authentication

Authentication is managed through the **@workspace/auth** package.

### Usage

```tsx
import { AuthProvider, useAuth } from '@workspace/auth';

// Wrap your app with AuthProvider
<AuthProvider>
  <App />
</AuthProvider>

// Use authentication in components
function MyComponent() {
  const { user, signIn, signOut } = useAuth();

  if (!user) return <button onClick={signIn}>Sign In</button>;

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

## Date and Time Handling

**IMPORTANT**: Always handle dates in client components to avoid hydration errors.

### Best Practices

1. **Store dates in UTC** (database timestamps with timezone)
2. **Format dates in client components** (use `'use client'`)
3. **Use `useEffect` for timezone-dependent rendering**

### Example

```tsx
'use client';

import { useEffect, useState } from 'react';

interface DateDisplayProps {
  utcDate: string; // ISO string from server
}

export function DateDisplay({ utcDate }: DateDisplayProps) {
  const [formatted, setFormatted] = useState('');

  useEffect(() => {
    const date = new Date(utcDate);
    const formatted = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
    setFormatted(formatted);
  }, [utcDate]);

  if (!formatted) return <time>Loading...</time>;

  return <time dateTime={utcDate}>{formatted}</time>;
}
```

## Code Style

### Biome Configuration

- **Indentation**: 2 spaces
- **Line Width**: 100 characters
- **Quote Style**: Single quotes
- **Semicolons**: As needed
- **Trailing Commas**: ES5

### TypeScript

- **Strict mode**: Enabled
- **Path aliases**:
  - `@/*` → `apps/web/src/*` or `apps/mobile/*`
  - `@workspace/ui` → `packages/ui`
  - `@workspace/native-ui` → `packages/native-ui`
  - `@workspace/tokens` → `packages/tokens`

## Testing

This project uses **Vitest** for unit testing. すべて devenv の **scripts** (PATH 直結) で実行する。

```bash
test-frontend              # Run Vitest (一回のみ)
test                       # 全 unit test (frontend + backend-py)

# Watch / coverage が必要な場合は devenv shell 内で nr 経由
nr test:watch              # Watch mode
nr test:coverage           # Coverage report
```

## Package Management

This is a **Bun workspace** monorepo. Each package has its own `package.json`.

### Workspace Dependencies

Packages can reference each other using `@workspace/` prefix:

```json
{
  "dependencies": {
    "@workspace/ui": "workspace:*",
    "@workspace/native-ui": "workspace:*",
    "@workspace/tokens": "workspace:*",
    "@workspace/auth": "workspace:*",
    "@workspace/types": "workspace:*"
  }
}
```

### Adding Dependencies

```bash
# Add to specific package
cd apps/web
pnpm add <package-name>

# Add to workspace root (dev dependencies)
pnpm add -D <package-name>
```

## Environment Variables

### Amplify configuration

The web app does **not** rely on public backend URL/key env vars. Instead, the Amplify
backend configuration is read from the generated `amplify_outputs.json` (produced by
`ampx sandbox` locally, or by Amplify Hosting CI per branch). The app imports this file
and configures Amplify on the client via `ConfigureAmplifyClientSide`.

```tsx
// apps/web から amplify_outputs.json を読み込んで Amplify を構成
import outputs from '@/amplify_outputs.json'
import { ConfigureAmplifyClientSide } from '@/shared/lib/amplify'
```

### Secrets

Backend secrets are stored as **Amplify secrets** in AWS SSM Parameter Store, not in
`.env` files:

```bash
ampx sandbox secret set <NAME>     # ローカル sandbox 用シークレットを設定
```

These are referenced from the backend via `secret('NAME')` and resolved per branch by
Amplify Hosting in CI.

**Note**: Browser-exposed Next.js public vars (if any) must still be prefixed with
`NEXT_PUBLIC_`, but Amplify backend access does not require one.

## Best Practices

### Component Organization

1. **Use Feature-Sliced Design layers** appropriately
2. **Co-locate related code** (ui, api, model in the same feature slice)
3. **Keep components small** and focused on a single responsibility
4. **Extract reusable components** to the Shared layer

### Styling

1. **Use CSS variables** for colors (dark mode support)
2. **Use shadcn/ui components** as building blocks
3. **Follow TailwindCSS conventions** for utility classes
4. **Avoid inline styles** unless absolutely necessary

### State Management

1. **Use Zustand** for global state (authentication, theme, etc.)
2. **Use React hooks** (useState, useReducer) for local state
3. **Avoid prop drilling** (use context or state management)

### Performance

1. **Use Server Components** by default (Next.js 16)
2. **Add `'use client'`** only when necessary (interactivity, hooks)
3. **Lazy load heavy components** with `dynamic` imports
4. **Optimize images** with Next.js `<Image>` component

## Deployment

### AWS Amplify Hosting Deployment

This monorepo deploys on **AWS Amplify Hosting**. Amplify Hosting builds and deploys
**per branch**, driven by the `amplify.yml` build spec at the repository root
(monorepo configuration with `appRoot: frontend`).

#### Build Spec (`amplify.yml`)

`amplify.yml` (repo root) defines both the backend and frontend phases:

- **Backend**: `ampx pipeline-deploy --branch <branch> --app-id <app-id>` provisions the
  Amplify Gen2 backend (Cognito / AppSync+DynamoDB / S3 / functions) for that branch and
  emits `amplify_outputs.json`. This is run by Amplify Hosting CI, **not locally**.
- **Frontend**: `pnpm install && pnpm run build` builds the Next.js web app, consuming the
  `amplify_outputs.json` produced by the backend phase.

#### Deployment Workflow

1. **Connect the Git repository** in the AWS Amplify console.
2. **Configure the monorepo app root** (`frontend`) so Amplify resolves the workspace.
3. **Add per-branch secrets/env** as Amplify secrets (see below).
4. **Push to a branch**: each push triggers a build that runs the backend deploy +
   Next.js build. Connected branches also get **branch previews** automatically.

Production is typically the `main` branch; feature branches get their own isolated
backend + preview URL.

#### Environment Variables & Secrets

Backend configuration is delivered via the generated `amplify_outputs.json` (no public
backend URL/key env vars). Secrets are stored as **Amplify secrets** in AWS SSM
Parameter Store, scoped per branch:

```bash
# ローカル sandbox 用
ampx sandbox secret set <NAME>
```

For deployed branches, set secrets per branch in the Amplify console (or via the Amplify
secrets tooling); they are resolved at `ampx pipeline-deploy` time.

#### Deployment Best Practices

1. **Test Locally**: Run `build-frontend` before pushing
2. **Check Types**: Run `type-check-frontend` to catch type errors
3. **Lint Code**: Run `lint-frontend` to ensure code quality
4. **Full CI Gate**: Run `ci-check` (= `devenv test`) to verify all projects
5. **Branch Previews**: Validate changes in the branch preview before merging to `main`
6. **Secrets**: Never commit secrets; use Amplify secrets (SSM) per branch

#### Troubleshooting Deployment

**Build Fails with "Module not found"**:
- Ensure all workspace dependencies are listed in `package.json`
- `devenv shell` を再アクティベートして `setup:install-frontend` task で lockfile を同期

**Backend phase fails / `amplify_outputs.json` missing**:
- Check `amplify.yml` (repo root) is present and the backend phase runs
  `ampx pipeline-deploy --branch <branch> --app-id <id>`
- Verify the Amplify app has valid AWS credentials / service role for the branch

**Auth/Data not configured at runtime**:
- Confirm the frontend build consumed `amplify_outputs.json` from the backend phase
- Check the branch's Amplify secrets (SSM) are set for that environment

For more information, see [AWS Amplify Hosting Documentation](https://docs.amplify.aws/nextjs/deploy-and-host/).

## Troubleshooting

### Hydration Errors

If you see hydration errors related to dates or times:
1. Move date formatting to client components (`'use client'`)
2. Use `useEffect` to format dates on the client side
3. See "Date and Time Handling" section above

### Type Errors

If the `Schema` type from `@workspace/backend` is out of sync, re-run `sandbox`
(= `ampx sandbox`) to regenerate `amplify_outputs.json`:
```bash
sandbox                             # ampx sandbox (watch, amplify_outputs.json を再生成)
sandbox-once                        # 1 回だけデプロイして終了
```

### Build Errors

Clear cache and rebuild:
```bash
nr clean                            # turbo clean + node_modules 削除 (devenv shell 内)
# `devenv shell` を抜けて再アクティベートで setup:install-frontend が再実行される
build-frontend                      # Next.js production build
```

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [TailwindCSS Documentation](https://tailwindcss.com)
- [Feature-Sliced Design](https://feature-sliced.design)
- [next-intl Documentation](https://next-intl.dev)

For project-specific guidelines, see `/CLAUDE.md` in the project root.
