---
name: supabase
description: Supabase integration guidance. Use for authentication (getUser/getSession), Server/Browser client usage, RLS policies, and Next.js integration.
---

# Supabase SSR/CSR Best Practices

## Client Types

| Client | Function | Location | Cookie Write |
|--------|----------|----------|--------------|
| **Browser Client** | `createBrowserClient()` | Client Components | Auto |
| **Server Client** | `createServerClient()` | Server Components, Server Actions, Route Handlers | try-catch ignore |
| **Proxy Client** | `createServerClient()` | Proxy (middleware) | Required (request & response) |

## Authentication Method Security

| Method | Security | Verification | Recommended Use |
|--------|----------|--------------|-----------------|
| `getUser()` | **High** | Validates JWT with Auth server | Page protection, auth checks (**recommended**) |
| `getClaims()` | **High** | Local JWT signature verification | Page protection (no network) |
| `getSession()` | **Low** | Cookie-based (spoofable) | Client Component UI updates only |

```typescript
// CORRECT: Server-side authentication
const { data: { user }, error } = await supabase.auth.getUser()

// WRONG: Cookie can be spoofed (don't trust on server)
const { data: { session } } = await supabase.auth.getSession()
```

## Proxy Setup (CRITICAL)

> **Next.js 16 Breaking Change**: `middleware.ts` renamed to `proxy.ts`, `middleware()` to `proxy()`.

```typescript
// proxy.ts (Next.js 16)
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

## Server Component Usage

```typescript
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Use getUser() for secure auth check
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // RLS-protected data fetch
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return <Dashboard user={user} profile={profile} />
}
```

## Client Component Usage

```typescript
'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'

export function ProfileForm({ userId }: { userId: string }) {
  const supabase = createClient()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
      setProfile(data)
    }
    fetchProfile()
  }, [userId])

  return <form>{/* ... */}</form>
}
```

## Common Mistakes

### WRONG: Skip getUser() in Proxy

```typescript
// WRONG: Token won't refresh
export async function updateSession(request: NextRequest) {
  const supabase = createServerClient(/* ... */)
  // Missing getUser() → token not refreshed
  return NextResponse.next()
}
```

### WRONG: Trust getSession() on Server

```typescript
// WRONG: Cookie can be spoofed
const { data: { session } } = await supabase.auth.getSession()
if (session) {
  // Cookie might be forged
}
```
