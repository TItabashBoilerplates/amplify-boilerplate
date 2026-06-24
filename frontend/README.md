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
│   ├── auth/                   # Authentication package
│   ├── types/                  # Supabase type definitions
│   ├── client-supabase/        # Supabase client
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
bun run ui:add:web button card input dialog

# Or directly
cd packages/ui && bunx shadcn@canary add button
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
bun run ui:add:mobile button card input

# Or directly
cd packages/native-ui && bunx gluestack-ui@latest add button --use-bun
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
bun run tokens:build
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
# bun install / uv sync が完了する。明示的な init コマンドは不要。

# Start development server
dev-web                 # 軽量セット (Supabase + backend + storybook) + Next.js (web)
# または
devenv up web           # web を軽量セットと一緒に起動
```

### Common Commands (devenv scripts on PATH)

```bash
# Development
dev-web                # 軽量 + Next.js (web)
dev-mobile             # 軽量 + Expo Metro (mobile, non-interactive)
dev-all                # 全部入り (web + mobile + backend + storybook)
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

# Type Generation
devenv tasks run model:frontend       # Supabase types + API client
devenv tasks run model:build          # All models
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
bun add <package-name>

# Add to workspace root (dev dependencies)
bun add -D <package-name>
```

## Environment Variables

Frontend environment variables are managed in `env/frontend/.env.local`.

### Required Variables

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Note**: All public variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

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

### Vercel Deployment

This monorepo is optimized for deployment on Vercel with Turborepo integration.

#### Configuration Files

**`apps/web/vercel.json`** - Vercel configuration for the web app:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "cd ../.. && turbo build --filter=@workspace/web",
  "installCommand": "cd ../.. && bun install",
  "outputDirectory": ".next",
  "devCommand": "bun run dev"
}
```

Key features:
- **Monorepo build**: Uses Turbo to build only the web app
- **Bun package manager**: Installs dependencies with Bun
- **Security headers**: Adds X-Content-Type-Options, X-Frame-Options, etc.
- **Function timeouts**: Configures max duration for API routes

> **Note on `devCommand`**: `vercel.json` の `"devCommand": "bun run dev"` は **Vercel 環境専用フック**（Vercel ビルド環境には devenv が存在しないため）。ローカル開発では devenv の `dev-web` script を使用すること。Vercel 側からこのフックが呼ばれるのは `vercel dev` 等の限定的なケースのみで、通常のデプロイ (`buildCommand`) には影響しない。

#### Vercel Project Settings

When creating a new Vercel project, configure the following:

1. **Framework Preset**: Next.js
2. **Root Directory**: `frontend/apps/web`
3. **Build Command**: (automatically detected from vercel.json)
4. **Install Command**: (automatically detected from vercel.json)
5. **Output Directory**: (automatically detected from vercel.json)
6. **Node.js Version**: 20.x or later (recommended: 22.x)

#### Environment Variables

Set the following environment variables in Vercel project settings:

**Required**:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**Optional**:
- `NEXT_PUBLIC_API_URL` - Backend API URL (if using separate backend)

#### Deployment Workflow

1. **Connect Repository**: Link your Git repository to Vercel
2. **Configure Settings**: Set Root Directory to `frontend/apps/web`
3. **Add Environment Variables**: Configure Supabase credentials
4. **Deploy**: Push to main branch or trigger manual deployment

**Automatic Deployments**:
- **Production**: Deployments from `main` branch
- **Preview**: Deployments from `develop` or `staging` branches
- **Ignored**: Branches starting with `internal-*`

#### Vercel CLI Deployment

```bash
# Install Vercel CLI
bun add -g vercel

# Login to Vercel
vercel login

# Deploy to preview
cd frontend/apps/web
vercel

# Deploy to production
vercel --prod
```

#### Monorepo Considerations

- **Turborepo Cache**: Vercel automatically provides remote caching for Turborepo
- **Build Performance**: Only the web app is built (`--filter=@workspace/web`)
- **Workspace Dependencies**: All `@workspace/*` packages are built automatically
- **Install Performance**: Bun provides fast dependency installation

#### Deployment Best Practices

1. **Test Locally**: Run `build-frontend` before pushing
2. **Check Types**: Run `type-check-frontend` to catch type errors
3. **Lint Code**: Run `lint-frontend` to ensure code quality
4. **Full CI Gate**: Run `ci-check` (= `devenv test`) to verify all projects
5. **Preview Deployments**: Test changes in preview environments before merging
6. **Environment Variables**: Never commit secrets, use Vercel environment variables

#### Troubleshooting Deployment

**Build Fails with "Module not found"**:
- Ensure all workspace dependencies are listed in `package.json`
- `devenv shell` を再アクティベートして `setup:install-frontend` task で lockfile を同期

**Environment Variables Not Available**:
- Ensure variables are prefixed with `NEXT_PUBLIC_` for client-side access
- Check Vercel project settings for correct variable names

**Build Timeout**:
- Check Turborepo cache is working correctly
- Consider upgrading to a higher-tier plan for faster builds

**Deployment Ignored**:
- Check `git.deploymentEnabled` settings in `vercel.json`
- Verify branch name doesn't match ignore patterns

For more information, see [Vercel Monorepo Documentation](https://vercel.com/docs/monorepos).

## Troubleshooting

### Hydration Errors

If you see hydration errors related to dates or times:
1. Move date formatting to client components (`'use client'`)
2. Use `useEffect` to format dates on the client side
3. See "Date and Time Handling" section above

### Type Errors

If Supabase types are out of sync:
```bash
devenv tasks run model:frontend     # Frontend types のみ再生成
devenv tasks run model:build        # 全 model 再生成
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
- [next-intl Documentation](https://next-intl-docs.vercel.app)

For project-specific guidelines, see `/CLAUDE.md` in the project root.
