# Mobile App

Expo 55 React Native application with gluestack-ui and NativeWind styling.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Expo 55, React Native |
| **Routing** | Expo Router (file-based) |
| **UI Library** | gluestack-ui |
| **Styling** | NativeWind 5 (TailwindCSS for React Native) |
| **State** | TanStack Query, Zustand |
| **Icons** | lucide-react-native |

## Project Structure

```
apps/mobile/
├── app/                    # Expo Router (file-based routing)
│   ├── (tabs)/             # Tab navigation
│   ├── _layout.tsx         # Root layout
│   └── +not-found.tsx      # 404 page
├── components/             # App-specific components
├── constants/              # App constants
├── hooks/                  # App-specific hooks
├── global.css              # TailwindCSS styles
└── tailwind.config.ts      # TailwindCSS configuration
```

## UI Components

This app uses **gluestack-ui** components from `@workspace/ui/mobile`:

```typescript
import { Button, ButtonText } from '@workspace/ui/mobile/components/button'
import { GluestackUIProvider } from '@workspace/ui/mobile/components/gluestack-ui-provider'
```

### Adding New Components

```bash
# From frontend directory
pnpm run ui:add:mobile button card input

# Or directly from this directory
pnpm dlx gluestack-ui@latest add button --use-bun
```

Components are installed to `packages/ui/mobile/components/`.

### Available Components

- Button, Card, Input, Text
- Modal, Toast, Overlay
- Box, HStack, VStack, Center
- And more...

## Development

### Prerequisites

- Node.js 20+
- Bun 1.2+
- Expo Go app (iOS/Android) or emulator

### Getting Started

```bash
# Install dependencies (from frontend root)
cd frontend
pnpm install

# Start Expo development server
cd apps/mobile
pnpm run start

# Or with specific platform
pnpm run ios      # iOS Simulator
pnpm run android  # Android Emulator
pnpm run web      # Web browser
```

### Common Commands

```bash
pnpm run start              # Start Expo dev server
pnpm run ios                # Run on iOS Simulator
pnpm run android            # Run on Android Emulator
pnpm run web                # Run in web browser
pnpm run type-check         # TypeScript type check
```

## Styling with NativeWind

NativeWind brings TailwindCSS utility classes to React Native:

```tsx
import { View, Text } from 'react-native'

export function MyComponent() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-foreground text-xl font-bold">
        Hello World
      </Text>
    </View>
  )
}
```

### CSS Variables

Use CSS variables for theming (defined in `global.css`):

```tsx
// Colors automatically adapt to light/dark mode
<View className="bg-background border-border">
  <Text className="text-foreground">Primary text</Text>
  <Text className="text-muted-foreground">Secondary text</Text>
</View>
```

## Design Tokens

Shared tokens from `@workspace/tokens`:

```typescript
import { colors, radius } from '@workspace/tokens'
```

## State Management

### TanStack Query (Server State)

```typescript
import { useQuery } from '@tanstack/react-query'

function MyComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: fetchItems,
  })
}
```

### Zustand (Global State)

```typescript
import { useUserStore } from '@/stores/user'

function MyComponent() {
  const user = useUserStore((state) => state.user)
}
```

## File-Based Routing (Expo Router)

```
app/
├── _layout.tsx           # Root layout
├── index.tsx             # Home screen (/)
├── (tabs)/               # Tab group
│   ├── _layout.tsx       # Tab layout
│   ├── index.tsx         # First tab
│   └── explore.tsx       # Second tab
└── +not-found.tsx        # 404 screen
```

## Authentication

Uses `@workspace/auth` for Supabase authentication:

```typescript
import { useAuth } from '@workspace/auth'

function MyComponent() {
  const { user, signIn, signOut } = useAuth()
}
```

## Environment Variables

Set in `env/frontend/.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Note**: Expo uses `EXPO_PUBLIC_` prefix (not `NEXT_PUBLIC_`).

## Troubleshooting

### Metro Bundler Issues

```bash
# Clear Metro cache
pnpm run start --clear
```

### NativeWind Not Working

1. Ensure `nativewind-env.d.ts` exists in `packages/ui/mobile/`
2. Check `tailwind.config.ts` content paths include UI packages
3. Restart Metro bundler

### Type Errors

```bash
# Run type check
pnpm run type-check
```

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [gluestack-ui Documentation](https://gluestack.io/ui/docs)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [TailwindCSS](https://tailwindcss.com/)
