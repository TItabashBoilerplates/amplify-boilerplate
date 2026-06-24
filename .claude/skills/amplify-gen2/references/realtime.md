# Amplify Gen2 — Realtime (AppSync subscriptions)

Real-time data in this boilerplate is **AppSync GraphQL subscriptions over WebSocket**,
exposed through the typed data client (`getDataClient()` from `@workspace/data-client`).
There are two kinds:

- **Model subscriptions** — auto-generated per `a.model`: `observeQuery`, `onCreate`,
  `onUpdate`, `onDelete`.
- **Custom subscriptions** — `a.subscription().for(<mutation>)` for app-defined pub/sub
  channels (chat, cursors, notifications) decoupled from CRUD.

> **Client-only.** Subscriptions need a live WebSocket → they run **only in Client
> Components** (`'use client'`) / React Native. Never call them in Server Components,
> Server Actions, or `runWithAmplifyServerContext`. Server code uses one-shot queries.

## Table of contents

1. [observeQuery — live list](#1-observequery--live-list)
2. [Event subscriptions — onCreate / onUpdate / onDelete](#2-event-subscriptions--oncreate--onupdate--ondelete)
3. [Subscription filters](#3-subscription-filters)
4. [Authorization (read / listen)](#4-authorization-read--listen)
5. [Connection state monitoring](#5-connection-state-monitoring)
6. [Custom subscriptions (a.subscription)](#6-custom-subscriptions-asubscription)
7. [FSD placement & TanStack Query integration](#7-fsd-placement--tanstack-query-integration)
8. [Constraints & gotchas](#8-constraints--gotchas)

---

## 1. observeQuery — live list

`observeQuery()` returns an **always-current list** that merges create/update/delete events
into a single snapshot. Use it for "live list" UIs.

```ts
'use client'
import type { Schema } from '@workspace/backend'
import { getDataClient } from '@workspace/data-client'
import { useEffect, useState } from 'react'

type Todo = Schema['Todo']['type']

export function useLiveTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [isSynced, setIsSynced] = useState(false)

  useEffect(() => {
    const sub = getDataClient().models.Todo.observeQuery().subscribe({
      // snapshot: { items: Todo[]; isSynced: boolean }
      next: ({ items, isSynced }) => {
        setTodos([...items]) // always copy — items is a managed array
        setIsSynced(isSynced)
      },
      error: (err) => console.error('observeQuery failed', err),
    })
    return () => sub.unsubscribe() // MUST clean up
  }, [])

  return { todos, isSynced }
}
```

- While the initial sync is in progress, snapshots arrive with the items synced so far and
  `isSynced: false`; a final snapshot arrives with `isSynced: true`.
- Options: `observeQuery({ filter, selectionSet, authMode })` (same shapes as `list`).

## 2. Event subscriptions — onCreate / onUpdate / onDelete

Lower-level: receive **individual** change events. Each returns an observable; `next` gets the
changed record.

```ts
'use client'
import { getDataClient } from '@workspace/data-client'

const client = getDataClient()

const onCreate = client.models.Todo.onCreate({
  filter: { content: { contains: 'groceries' } }, // optional server-side filter
  // selectionSet: ['id', 'content', 'owner'],     // optional
  // authMode: 'userPool',                          // optional per-subscription
}).subscribe({
  next: (todo) => console.log('created', todo),
  error: (err) => console.error(err),
})

const onUpdate = client.models.Todo.onUpdate().subscribe({ next: (t) => {/* ... */} })
const onDelete = client.models.Todo.onDelete().subscribe({ next: (t) => {/* ... */} })

// cleanup
onCreate.unsubscribe()
onUpdate.unsubscribe()
onDelete.unsubscribe()
```

**observeQuery vs events**: prefer `observeQuery` for "render the current list"; use
`onCreate/onUpdate/onDelete` when you need to react to a specific event (toast, sound,
imperative cache patch) rather than maintain a list.

## 3. Subscription filters

Server-side filter object, same operators as queries:

```ts
filter: {
  and: [
    { priority: { eq: 'high' } },
    { content: { contains: 'urgent' } },
  ],
}
// operators: eq, ne, lt, le, gt, ge, contains, notContains, beginsWith, between, in, ...
// combinators: and, or, not
```

- **Do not pass an empty `{}` filter** — it can cause inconsistent delivery. Omit `filter` for "all".
- A field used in a filter **must be present in the selection set of the mutation** that
  triggers the event, otherwise the event is filtered out.

## 4. Authorization (read / listen)

Subscriptions honor the model's `.authorization(...)` rules (the RLS replacement). Minimum
rule needed per operation:

| Operation | Requires |
|-----------|----------|
| `onCreate` / `onUpdate` / `onDelete` | `read` **or** `listen` |
| `observeQuery` | `read` **or** (`listen` **and** `list`) |

- `allow.owner()` subscriptions only deliver the **owner's** records.
- `allow.groups([...])` / dynamic-group rules apply to subscriptions too (group-count limits
  apply — see gotchas).
- Pick the connection auth via `authMode` on the subscription call when the model allows
  multiple modes (e.g. `authMode: 'apiKey'` for public live feeds).

## 5. Connection state monitoring

Monitor the WebSocket via the `api` Hub channel — useful for "reconnecting…" UI and to refetch
after an offline gap (see gotchas).

```ts
'use client'
import { CONNECTION_STATE_CHANGE, type ConnectionState } from 'aws-amplify/data'
import { Hub } from 'aws-amplify/utils'

const stop = Hub.listen('api', ({ payload }) => {
  if (payload.event === CONNECTION_STATE_CHANGE) {
    const state = payload.data.connectionState as ConnectionState
    // 'Connected' | 'Connecting' | 'ConnectionDisrupted'
    //  | 'ConnectionDisruptedPendingNetwork' | 'ConnectedPendingNetwork'
    //  | 'ConnectedPendingKeepAlive' | 'ConnectedPendingDisconnect' | 'Disconnected'
    console.log('AppSync connection:', state)
  }
})
// stop() to remove the listener
```

## 6. Custom subscriptions (a.subscription)

For app-defined channels (chat, cursors, presence) decoupled from model CRUD: define a custom
**mutation** that publishes, and a custom **subscription** that subscribes via `.for()`.

Backend — `amplify/data/resource.ts`:

```ts
const schema = a.schema({
  Message: a.customType({
    content: a.string().required(),
    channelName: a.string().required(),
  }),

  // publisher
  publish: a
    .mutation()
    .arguments({ channelName: a.string().required(), content: a.string().required() })
    .returns(a.ref('Message'))
    .handler(a.handler.custom({ entry: './publish.js' }))
    .authorization((allow) => [allow.authenticated()]),

  // subscriber — fires whenever `publish` runs
  receive: a
    .subscription()
    .for(a.ref('publish'))
    .arguments({ namePrefix: a.string() })
    .handler(a.handler.custom({ entry: './receive.js' }))
    .authorization((allow) => [allow.authenticated()]),
})
```

`amplify/data/publish.js` (passthrough — returns the args as the published payload):

```js
export function request() {
  return {}
}
export function response(ctx) {
  return ctx.args
}
```

`amplify/data/receive.js` (optional per-arg server-side filter):

```js
import { util, extensions } from '@aws-appsync/utils'

export function request() {
  return { payload: null }
}
export function response(ctx) {
  const filter = { channelName: { beginsWith: ctx.args.namePrefix } }
  extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter(filter))
  return null
}
```

Client — custom ops live under `client.subscriptions` / `client.mutations`:

```ts
'use client'
import { getDataClient } from '@workspace/data-client'

const client = getDataClient()

const sub = client.subscriptions
  .receive({ namePrefix: 'world' })
  .subscribe({ next: (event) => console.log(event), error: (e) => console.error(e) })

await client.mutations.publish({ channelName: 'world', content: 'My first message!' })

sub.unsubscribe()
```

## 7. FSD placement & TanStack Query integration

- **Where it goes**: a live subscription that maintains entity data is a **query concern** →
  put the hook in the entity's `api`/`model` segment (`entities/<x>/api/useLive<X>.ts`), per
  `.claude/rules/render-optimization.md`. Shared across web+mobile → `packages/app/entities/<x>`.
- **Subscriptions are client-only** → the component using the hook is `'use client'`.

**Pattern A — observeQuery as the source of truth** (simplest): the `useLive*` hook above
owns `useState` and renders directly.

**Pattern B — feed subscriptions into the TanStack Query cache** (when the rest of the app
already reads via `useQuery`): seed with a normal query, then patch the cache from events so a
single query key stays live.

```ts
'use client'
import type { Schema } from '@workspace/backend'
import { getDataClient } from '@workspace/data-client'
import { useQuery, useQueryClient } from '@workspace/query'
import { useEffect } from 'react'

type Todo = Schema['Todo']['type']
const todoKeys = { list: ['todos'] as const } // entity owns the key (render-opt rule)

export function useTodos() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: todoKeys.list,
    queryFn: async () => {
      const { data, errors } = await getDataClient().models.Todo.list()
      if (errors) throw new Error(errors[0]?.message ?? 'list failed')
      return data
    },
  })

  useEffect(() => {
    const client = getDataClient()
    const upsert = (t: Todo) =>
      qc.setQueryData<Todo[]>(todoKeys.list, (prev = []) => [
        ...prev.filter((x) => x.id !== t.id),
        t,
      ])
    const subs = [
      client.models.Todo.onCreate().subscribe({ next: upsert }),
      client.models.Todo.onUpdate().subscribe({ next: upsert }),
      client.models.Todo.onDelete().subscribe({
        next: (t) =>
          qc.setQueryData<Todo[]>(todoKeys.list, (prev = []) =>
            prev.filter((x) => x.id !== t.id)
          ),
      }),
    ]
    return () => subs.forEach((s) => s.unsubscribe())
  }, [qc])

  return query
}
```

## 8. Constraints & gotchas

- **Cleanup is mandatory.** Always `sub.unsubscribe()` in the `useEffect` cleanup; leaked
  subscriptions keep WebSocket connections open and double-fire after re-mounts.
- **Related models don't trigger updates.** A mutation on a parent does **not** emit a
  real-time event for *related* models, even if they're in the selection set. Subscribe to the
  model that actually changes.
- **selectionSet must exist on the mutation.** Any field you expect in a real-time payload (or
  filter on) must be in the **triggering mutation's** selection set, or it's redacted/filtered.
- **Relational redaction.** With recent data-construct versions, relational fields can be
  returned as `null` in subscription payloads when parent/child authorization differs.
- **Offline = missed messages.** While offline the app misses events and does **not**
  auto-catch-up on reconnect. Use §5 connection state to detect reconnect and **refetch**
  (`invalidateQueries` / re-`list`) to resync.
- **Server-side is out of scope.** No subscriptions in SSR — render initial data with a server
  query, then attach the subscription in a client component.
- **Group-auth limits.** Dynamic group auth: users with >5 groups may not receive events;
  array-based groups cap at 20 per user / 20 per record.
- **Empty filter `{}`** can cause inconsistent delivery — omit `filter` instead.
