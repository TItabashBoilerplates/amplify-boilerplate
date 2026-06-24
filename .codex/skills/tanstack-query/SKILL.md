---
name: tanstack-query
description: TanStack Query v5 server state management guidance. Use for useQuery, useMutation, QueryClient, cache invalidation, and Supabase integration.
---

# TanStack Query v5

This project uses TanStack Query v5 for server state management.

## Basic Usage

### useQuery

```typescript
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'

export function useUser(userId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    },
  })
}
```

### useMutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useUpdateUser() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ userId, data }: UpdateUserInput) => {
      const { data: result, error } = await supabase
        .from('users')
        .update(data)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: (data, { userId }) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['user', userId] })
    },
  })
}
```

## Query Key Design

```typescript
// Hierarchical key structure
const queryKeys = {
  all: ['users'] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  list: (filters: string) => [...queryKeys.lists(), { filters }] as const,
  details: () => [...queryKeys.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.details(), id] as const,
}

// Usage
useQuery({
  queryKey: queryKeys.detail(userId),
  queryFn: () => fetchUser(userId),
})
```

## FSD Integration

Place query hooks in the `model/` segment:

```
src/entities/user/
├── model/
│   ├── hooks.ts      # useUser, useUsers
│   ├── mutations.ts  # useUpdateUser, useDeleteUser
│   └── queries.ts    # Query key definitions
├── ui/
│   └── UserCard.tsx
└── index.ts
```

## Prefetching (Server Components)

```typescript
import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { getQueryClient } from '@/shared/lib/query-client'

export default async function UserPage({ params }: { params: { id: string } }) {
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['user', params.id],
    queryFn: () => fetchUser(params.id),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserDetail userId={params.id} />
    </HydrationBoundary>
  )
}
```

## Error Handling

```typescript
const { data, error, isError, isLoading } = useQuery({
  queryKey: ['user', userId],
  queryFn: fetchUser,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
})

if (isError) {
  return <ErrorMessage error={error} />
}
```
