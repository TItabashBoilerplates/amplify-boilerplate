# Amplify Gen2 — Data (AppSync + DynamoDB)

Reference for modeling, authorization, and the type-safe data client. Verified against the
current AWS Amplify Gen2 (Next.js) docs. Versions in this repo: `aws-amplify ^6.18`,
`@aws-amplify/backend ^1.23`.

Repo conventions (match these in every example):

- Schema lives in `frontend/packages/backend/amplify/data/resource.ts`, defined with `a.schema({...})`.
- Default authorization mode is `userPool` (set in `defineData`).
- Frontend imports the schema type with `import type { Schema } from '@workspace/backend'`.
- App code uses the singleton client: `import { getDataClient } from '@workspace/data-client'`
  then `getDataClient().models.X...`. It wraps `generateClient<Schema>()` — do NOT call
  `generateClient` directly in app code.
- The client returns `{ data, errors }` and never throws — always check `errors`.

## Table of contents

1. [Modeling](#1-modeling)
2. [Relationships](#2-relationships)
3. [Authorization (replaces Supabase RLS)](#3-authorization-replaces-supabase-rls)
4. [Client CRUD](#4-client-crud)
5. [Realtime](#5-realtime)
6. [Custom business logic](#6-custom-business-logic)
7. [Secondary indexes](#7-secondary-indexes)
8. [Server-side (Next.js App Router)](#8-server-side-nextjs-app-router)
9. [Gotchas](#9-gotchas)

---

## 1. Modeling

Every `a.model()` generates a DynamoDB table + AppSync GraphQL API + typed client operations.

```ts
// frontend/packages/backend/amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

const schema = a.schema({
  // Reusable enum (top-level, referenced via a.ref)
  Priority: a.enum(['LOW', 'MEDIUM', 'HIGH']),

  // Reusable custom (non-model) type
  Address: a.customType({
    street: a.string().required(),
    city: a.string().required(),
    postalCode: a.string(),
  }),

  Todo: a
    .model({
      content: a.string().required(), // required → non-null
      notes: a.string().array(), // array → list of strings
      done: a.boolean().default(false), // default value
      priority: a.ref('Priority'), // reference the top-level enum
      // Inline enum (alternative to a.ref)
      stage: a.enum(['DRAFT', 'PUBLISHED']),
      dueDate: a.date(), // YYYY-MM-DD
      remindAt: a.datetime(), // ISO 8601 extended
      meta: a.json(), // arbitrary JSON
      address: a.ref('Address'), // embedded custom type
    })
    .authorization((allow) => [allow.owner()]),
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
})
```

### Field types

`a.string()`, `a.integer()`, `a.float()`, `a.boolean()`, `a.datetime()`, `a.date()`,
`a.time()`, `a.timestamp()`, `a.email()`, `a.json()`, `a.id()`,
`a.enum([...])`, `a.ref('OtherType')`.

### Modifiers

- `.required()` — non-null. Chain order: `a.string().required().array()` = required list.
- `.array()` — list of the type.
- `.default(value)` — server-side default on create (scalars only).

### Identifiers

By default each model has an auto-generated `id: a.id()` primary key. Override with `.identifier()`:

```ts
Customer: a
  .model({
    customerId: a.id().required(),
    region: a.string().required(),
    name: a.string(),
  })
  // Single or composite (partition + sort key) primary key:
  .identifier(['customerId', 'region'])
  .authorization((allow) => [allow.owner()]),
```

When a custom identifier is set, `id` is no longer added automatically.

---

## 2. Relationships

Relationships use an explicit **reference field** (the foreign key) plus a relationship field.
Current pattern: `a.hasMany('Child', 'fkOnChild')` on the parent + `a.belongsTo('Parent', 'fkOnChild')`
on the child. The reference field type must match the related model's identifier type.

### One-to-many

```ts
const schema = a.schema({
  Team: a.model({
    mantra: a.string().required(),
    members: a.hasMany('Member', 'teamId'), // points at Member.teamId
  }).authorization((allow) => [allow.owner()]),

  Member: a.model({
    name: a.string().required(),
    teamId: a.id(), // reference (foreign key) field
    team: a.belongsTo('Team', 'teamId'),
  }).authorization((allow) => [allow.owner()]),
})
```

### One-to-one

```ts
Customer: a.model({
  name: a.string(),
  activeCart: a.hasOne('Cart', 'customerId'),
}),
Cart: a.model({
  items: a.string().required().array(),
  customerId: a.id(), // reference field
  customer: a.belongsTo('Customer', 'customerId'),
}),
```

### Many-to-many (explicit join model)

There is no single `a.manyToMany()` — model the join table explicitly with two `belongsTo`:

```ts
Post: a.model({
  title: a.string(),
  tags: a.hasMany('PostTag', 'postId'),
}),
Tag: a.model({
  name: a.string(),
  posts: a.hasMany('PostTag', 'tagId'),
}),
PostTag: a.model({
  postId: a.id().required(),
  tagId: a.id().required(),
  post: a.belongsTo('Post', 'postId'),
  tag: a.belongsTo('Tag', 'tagId'),
}),
```

### Required vs optional & composite keys

```ts
authorId: a.id().required(),       // required relationship (can't be null)
author: a.belongsTo('Person', 'authorId'),
// Composite-key target: pass an array of reference fields
author: a.belongsTo('Person', ['authorName', 'authorDoB']),
```

---

## 3. Authorization (replaces Supabase RLS)

`.authorization((allow) => [...])` is deny-by-default and replaces Supabase Row-Level Security.
Rules are applied per model (and optionally per field). Restrict operations with
`.to(['create' | 'read' | 'update' | 'delete' | 'list' | 'listen' | 'sync' | 'get' | 'subscribe'])`.

```ts
Post: a.model({
  content: a.string(),
}).authorization((allow) => [
  allow.owner(),                          // record owner → full CRUD
  allow.authenticated().to(['read']),     // any signed-in user can read
  allow.guest().to(['read']),             // unauthenticated (identity pool / IAM)
  allow.groups(['Admin']).to(['create', 'update', 'delete']), // static Cognito groups
  allow.publicApiKey().to(['read']),      // anonymous via API key
])
```

Strategies:

- `allow.owner()` — implicit `owner` field (Cognito sub); creator gets access.
- `allow.ownerDefinedIn('fieldName')` — owner stored in a custom field.
- `allow.ownersDefinedIn('fieldName')` — multiple owners (list field).
- `allow.authenticated()` — any signed-in user.
- `allow.guest()` — unauthenticated via Cognito identity pool (IAM).
- `allow.group('Admin')` / `allow.groups(['Admin', 'Editor'])` — static groups.
- `allow.groupDefinedIn('groupField')` / `allow.groupsDefinedIn('groupsField')` — dynamic groups stored on the record.
- `allow.publicApiKey()` — API-key access.
- `allow.custom()` — Lambda authorizer.

### Per-owner data access

```ts
Todo: a.model({
  content: a.string(),
  author: a.string(),
}).authorization((allow) => [
  // Owner restricted to a subset of operations
  allow.owner().to(['create', 'read', 'update']),
  // Or store the owner in a custom field
  allow.ownerDefinedIn('author'),
])
```

### Field-level authorization

Field rules override model rules for that field. Common use: protect the owner field so owners
can't reassign records, or hide sensitive fields.

```ts
Employee: a.model({
  name: a.string(),
  ssn: a.string().authorization((allow) => [allow.owner()]), // only owner reads ssn
}).authorization((allow) => [
  allow.authenticated().to(['read']),
  allow.owner(),
})
```

---

## 4. Client CRUD

All examples use the repo's `getDataClient()`. Every call returns `{ data, errors }` — check `errors`.

```ts
import { getDataClient } from '@workspace/data-client'
import type { Schema } from '@workspace/backend'

type Todo = Schema['Todo']['type'] // typed model helper

const client = getDataClient()

// CREATE
const { data: created, errors } = await client.models.Todo.create({
  content: 'My new todo',
  done: false,
})
if (errors) console.error(errors)

// GET by identifier
const { data: one } = await client.models.Todo.get({ id: 'some-id' })

// UPDATE (must include the identifier)
const { data: updated } = await client.models.Todo.update({
  id: 'some-id',
  content: 'Updated content',
})

// DELETE
const { data: deleted } = await client.models.Todo.delete({ id: 'some-id' })

// LIST with filter, pagination, limit
const { data: todos, nextToken } = await client.models.Todo.list({
  filter: { content: { beginsWith: 'hello' } },
  limit: 100,
  nextToken: undefined, // pass the previous response's nextToken to page
})

// Compound filters
await client.models.Todo.list({
  filter: { or: [{ priority: { eq: 'HIGH' } }, { priority: { eq: 'MEDIUM' } }] },
})
```

Filter operators include `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `contains`, `notContains`,
`beginsWith`, `between`, `attributeExists`, plus `and` / `or` / `not`.

### Selection sets (incl. nested relationships)

```ts
const { data } = await client.models.Blog.get(
  { id: blogId },
  { selectionSet: ['id', 'name', 'author.email', 'posts.*'] },
)
```

### Lazy-loaded relationships

Related records are lazy by default — accessing the relationship field returns a function
returning `{ data }`:

```ts
const { data: team } = await client.models.Team.get({ id })
const { data: members } = await team!.members() // lazy load
```

### Per-request auth mode & cancellation

```ts
await client.models.Todo.create({ content: 'x' }, { authMode: 'userPool' })

const promise = client.models.Todo.list()
client.cancel(promise, 'cancellation message')
// detect: client.isCancelError(error)
```

---

## 5. Realtime (Client Components only)

Subscriptions require a client component (`'use client'`). Always `unsubscribe` on cleanup.

```ts
'use client'
import { useEffect, useState } from 'react'
import { getDataClient } from '@workspace/data-client'
import type { Schema } from '@workspace/backend'

type Todo = Schema['Todo']['type']

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    // observeQuery: always-current list, with isSynced status
    const sub = getDataClient().models.Todo.observeQuery().subscribe({
      next: ({ items, isSynced }) => setTodos([...items]),
      error: (e) => console.warn(e),
    })
    return () => sub.unsubscribe()
  }, [])

  return <ul>{todos.map((t) => <li key={t.id}>{t.content}</li>)}</ul>
}
```

Event subscriptions with optional server-side filter:

```ts
const sub = getDataClient().models.Todo.onCreate({
  filter: { content: { contains: 'groceries' } },
}).subscribe({ next: (data) => console.log(data) })
// also: .onUpdate(), .onDelete()
sub.unsubscribe()
```

---

## 6. Custom business logic

Define `a.query()` (read) / `a.mutation()` (write) with `.arguments()`, `.returns()`, and a handler.

```ts
import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend'

const echoHandler = defineFunction({ entry: './echo-handler/handler.ts' })

const schema = a.schema({
  EchoResponse: a.customType({
    content: a.string(),
    executionDuration: a.float(),
  }),

  // Lambda-backed query
  echo: a
    .query()
    .arguments({ content: a.string() })
    .returns(a.ref('EchoResponse'))
    .handler(a.handler.function(echoHandler))
    .authorization((allow) => [allow.authenticated()]),

  // Custom AppSync JS resolver (no Lambda cold start), bound to a model data source
  likePost: a
    .mutation()
    .arguments({ postId: a.id() })
    .returns(a.ref('Post'))
    .handler(a.handler.custom({ dataSource: a.ref('Post'), entry: './increment-like.js' }))
    .authorization((allow) => [allow.authenticated()]),
})
```

Lambda handler file (`echo-handler/handler.ts`):

```ts
import type { Schema } from '../resource'

export const handler: Schema['echo']['functionHandler'] = async (event) => ({
  content: `Echoing: ${event.arguments.content}`,
  executionDuration: 0,
})
```

Invoke from app code via `queries` / `mutations` (not `models`):

```ts
const { data, errors } = await getDataClient().queries.echo({ content: 'hello' })
const { data: liked } = await getDataClient().mutations.likePost({ postId: 'p1' })
```

---

## 7. Secondary indexes

`.secondaryIndexes((index) => [...])` creates DynamoDB GSIs and generated `listBy...` queries.
The index field must be `.required()`.

```ts
Customer: a
  .model({
    name: a.string(),
    accountRepresentativeId: a.id().required(),
  })
  .secondaryIndexes((index) => [
    index('accountRepresentativeId'),
    index('accountRepresentativeId').sortKeys(['name']), // composite
    index('accountRepresentativeId').queryField('listByRep'), // custom query name
    index('accountRepresentativeId').name('MyGsiName'), // custom DynamoDB index name
    index('accountRepresentativeId').projection('INCLUDE', ['name']), // ALL | KEYS_ONLY | INCLUDE
  ])
  .authorization((allow) => [allow.owner()]),
```

Query from the client (generated `listBy<Model>By<Field>` / custom name):

```ts
await client.models.Customer.listCustomerByAccountRepresentativeId({
  accountRepresentativeId: 'rep-1',
})

// With sort key condition
await client.models.Customer.listCustomerByAccountRepresentativeIdAndName({
  accountRepresentativeId: 'rep-1',
  name: { beginsWith: 'Rene' },
})

// Custom queryField name
await client.models.Customer.listByRep({ accountRepresentativeId: 'rep-1' })
```

---

## 8. Server-side (Next.js App Router)

Create a shared server runner once:

```ts
// utils/amplifyServerUtils.ts
import { createServerRunner } from '@aws-amplify/adapter-nextjs'
import outputs from '@/amplify_outputs.json'

export const { runWithAmplifyServerContext } = createServerRunner({ config: outputs })
```

Read data in a Server Component (cookie-based auth):

```tsx
import { cookies } from 'next/headers'
import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/data'
import { runWithAmplifyServerContext } from '@/utils/amplifyServerUtils'
import outputs from '@/amplify_outputs.json'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const { data, errors } = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async () => {
      const client = generateServerClientUsingCookies({ config: outputs, cookies })
      return client.models.Todo.list()
    },
  })
  if (errors) return <p>Error loading data</p>
  return <ul>{data?.map((t) => <li key={t.id}>{t.content}</li>)}</ul>
}
```

The server cookie client still returns `{ data, errors }`. Subscriptions are not available
server-side; use `list`/`get` only.

---

## 9. Gotchas

- **Errors are returned, not thrown.** Every operation resolves to `{ data, errors }`. `data`
  can be `null` while `errors` is populated — always check `errors`.
- **authMode is per request.** Pass `{ authMode: 'userPool' | 'apiKey' | 'identityPool' | 'oidc' | 'lambda' }`
  as the trailing option to override `defaultAuthorizationMode` for a single call.
- **API keys expire.** `allow.publicApiKey()` issues a key with a max lifetime (default 7 days,
  up to 365). Rotate / redeploy before expiry, or it stops authorizing.
- **Enums can't be `.required()` and have no defaults.** Enum fields are always nullable; use a
  custom validation or a string field if you need a non-null constraint.
- **No `a.manyToMany()`** — model the join table explicitly with two `belongsTo` relationships.
- **Relationships are lazy.** Accessing a relationship field calls a function returning `{ data }`;
  use `selectionSet` to eager-load nested data in a single round trip.
- **Reference field type must match the target identifier** (e.g. `a.id()` against a default id).
- **Subscriptions are client-only** and need `read`/`listen` permission; avoid empty `{}` filters.
- **Owner reassignment.** Protect the `owner` field with field-level auth
  (`a.string().authorization((allow) => [allow.owner().to(['read', 'delete'])])`) so owners can't
  hand records to other users.
- **Secondary-index fields must be `.required()`**, and adding/removing indexes can trigger a
  table rebuild on deploy.
- **Use `getDataClient()` in app code**, not a raw `generateClient`, so the singleton is reused
  after `Amplify.configure()`.
