# Amplify Gen2 on Expo / React Native

A code-heavy guide to building the **Expo / React Native** mobile app (`frontend/apps/mobile`)
on AWS Amplify Gen2, matched to this repo. Researched against the **react-native** variant of
the official docs — the mobile API surface, native deps and polyfills differ from the web/SSR docs.

> Versions in this repo: Expo 55, expo-router, gluestack-ui + NativeWind, `aws-amplify ^6.18`,
> `@aws-amplify/react-native ^1.3`, `@react-native-community/netinfo ^12`,
> `react-native-get-random-values ^2`, `@react-native-async-storage/async-storage 2.2`.
> FSD layout: `src/{app,views,widgets,features,entities,shared}`. Shared cross-platform code lives
> in `frontend/packages/*` (`@workspace/auth`, `@workspace/data-client`, `@workspace/backend`).

## Table of contents

1. [Setup & required native deps / polyfills](#1-setup--required-native-deps--polyfills)
2. [Configuration & token storage](#2-configuration--token-storage)
3. [Auth on React Native](#3-auth-on-react-native)
4. [Data + realtime on React Native](#4-data--realtime-on-react-native)
5. [Storage on React Native](#5-storage-on-react-native)
6. [Push notifications (Amazon Pinpoint)](#6-push-notifications-amazon-pinpoint)
7. [FSD placement & cross-platform sharing](#7-fsd-placement--cross-platform-sharing)
8. [Gotchas](#8-gotchas)

---

## 1. Setup & required native deps / polyfills

Amplify on React Native pulls **native modules**, so the headless `aws-amplify` package is not
enough on mobile. This repo already installs the required deps:

```jsonc
// frontend/apps/mobile/package.json (excerpt)
"aws-amplify": "^6.18.0",
"@aws-amplify/react-native": "^1.3.3",          // RN bridge: crypto, secure value storage hooks
"@react-native-community/netinfo": "^12.0.1",    // connection state for Data realtime/subscriptions
"react-native-get-random-values": "^2.0.0",      // crypto.getRandomValues polyfill (UUIDs, auth)
"@react-native-async-storage/async-storage": "2.2.0" // token persistence backend
```

Why each one:

- **`@aws-amplify/react-native`** — the RN adapter that wires Amplify's native module
  requirements (crypto, app state, etc.). Required by `aws-amplify` v6 on RN.
- **`@react-native-async-storage/async-storage`** — Amplify Auth persists Cognito tokens here
  automatically on RN (the browser equivalent is `localStorage`). Without it, sessions are lost
  on app restart.
- **`@react-native-community/netinfo`** — Amplify Data uses it to detect connectivity and to drive
  AppSync subscription connection state. Required when you use `observeQuery` / `onCreate` etc.
- **`react-native-get-random-values`** — polyfills `crypto.getRandomValues`. Hermes has no Web
  Crypto; auth flows and client UUIDs need it. **Must be imported before `aws-amplify`.**

The official RN install line (for reference; UI/polyfill extras only added if you use them):

```bash
bun add aws-amplify @aws-amplify/react-native \
  @react-native-community/netinfo @react-native-async-storage/async-storage \
  react-native-get-random-values
# optional, only if you use Amplify's prebuilt RN UI / URL handling:
#   @aws-amplify/ui-react-native react-native-safe-area-context react-native-url-polyfill
```

### Polyfill import order (critical)

The repo centralizes config + polyfill in **`frontend/apps/mobile/src/shared/lib/amplify.ts`**.
The polyfill is the **first** import so `crypto.getRandomValues` exists before Amplify loads:

```ts
// frontend/apps/mobile/src/shared/lib/amplify.ts
import 'react-native-get-random-values' // polyfill FIRST — before aws-amplify
import { Amplify } from 'aws-amplify'
import outputs from '../../../amplify_outputs.json' // generated, git-ignored

Amplify.configure(outputs)
```

This module is imported once as a **side-effect** from `AppProvider`:

```tsx
// frontend/apps/mobile/src/app/providers/AppProvider.tsx
import { NativeAuthProvider } from '@workspace/auth/providers/native'
import '@/shared/lib/amplify' // side-effect: polyfill + Amplify.configure(outputs)

export function AppProvider({ children }: PropsWithChildren) {
  // ...ThemeProvider...
  return <NativeAuthProvider>{children}</NativeAuthProvider>
}
```

### Expo dev client is required (Expo Go does NOT work)

Amplify v6 requires native modules that are **not** in the Expo Go runtime, so:

> "Amplify now requires native modules not available through the Expo SDK" — **Expo Go is no
> longer supported.**

You must build a **custom dev client** (generate native projects with `expo prebuild`, then run a
dev build), not `expo start` into Expo Go:

```bash
bunx expo prebuild            # generates ios/ and android/ native projects
bunx expo run:ios             # or: eas build --profile development --platform ios
# then start Metro for the dev client:
bunx expo start --dev-client
```

Metro/Hermes notes: Hermes is the default RN engine and ships **no Web Crypto**, which is exactly
why `react-native-get-random-values` is mandatory. If Metro fails to resolve workspace deps in the
monorepo, ensure the Metro config watches the repo root and resolves `node_modules` hoisted by the
Bun workspace (standard Expo monorepo Metro setup).

---

## 2. Configuration & token storage

- **One configure call.** `Amplify.configure(outputs)` runs once in `shared/lib/amplify.ts`. Do not
  call it again per screen.
- **`amplify_outputs.json` is generated and git-ignored.** It is produced by the backend sandbox
  (`bunx ampx sandbox`) or `bunx ampx generate outputs`, and imported with a **relative** path from
  the mobile app root (`../../../amplify_outputs.json`). A fresh clone will not compile/run until
  this file exists — run the sandbox first.
- **Token persistence is automatic on RN.** Once `@react-native-async-storage/async-storage` is
  installed, Amplify Auth stores Cognito tokens in AsyncStorage and restores the session on
  restart. There is **no SSR / cookie handling** on mobile — everything is client-side and there is
  no `runWithAmplifyServerContext`.

---

## 3. Auth on React Native

Client auth APIs come from **`aws-amplify/auth`**. Auth **state** is held in
`@workspace/auth` (`NativeAuthProvider` + a Zustand store), shared with web.

### Passwordless Email OTP (repo default)

```ts
import { signIn, confirmSignIn } from 'aws-amplify/auth'

// 1) request the email code
const { nextStep } = await signIn({
  username: 'hello@example.com',
  options: {
    authFlowType: 'USER_AUTH',
    preferredChallenge: 'EMAIL_OTP',
  },
})

// 2) user enters the 6-digit code from email
if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE') {
  const { nextStep: confirmStep } = await confirmSignIn({
    challengeResponse: '123456',
  })
  if (confirmStep.signInStep === 'DONE') {
    // signed in — Hub 'signedIn' fires; NativeAuthProvider syncs the store
  }
}
```

A successful `confirmSignIn` triggers Cognito to persist tokens to AsyncStorage and fires a Hub
`signedIn` event.

### Auth state: NativeAuthProvider + Hub + Zustand

`NativeAuthProvider` (in `@workspace/auth/providers/native`) subscribes to the Amplify `Hub` auth
channel and mirrors the Cognito session into the Zustand store. It restores the persisted session on
first mount and gates rendering behind a `loading` flag (pair with a splash screen):

```tsx
// @workspace/auth — NativeAuthProvider.tsx (shape)
import { Hub } from 'aws-amplify/utils'

useEffect(() => {
  const sync = () => loadAuthUser().then((user) => (user ? setUser(user) : reset()))
  sync().finally(() => setLoading(false)) // restore persisted session

  const stop = Hub.listen('auth', ({ payload }) => {
    switch (payload.event) {
      case 'signedIn':
      case 'tokenRefresh':
        sync()
        break
      case 'signedOut':
        reset()
        break
      case 'tokenRefresh_failure':
        reset() // session lost
        break
    }
  })
  return () => stop()
}, [setUser, reset])
```

`loadAuthUser` normalizes the Cognito user (shared web/native — DRY):

```ts
// @workspace/auth/lib/loadAuthUser.ts (shape)
import { fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth'

export async function loadAuthUser(): Promise<AuthUser | null> {
  try {
    const { userId, username } = await getCurrentUser() // throws if unauthenticated
    let email: string | undefined
    try {
      email = (await fetchUserAttributes()).email // best-effort
    } catch {}
    return { userId, username, email }
  } catch {
    return null // unauthenticated — expected control flow
  }
}
```

Read state in components via the selector hooks (no direct store access):

```tsx
import { useAuthUser, useIsAuthenticated } from '@workspace/auth/hooks'

const user = useAuthUser()                  // re-renders only when user changes
const isAuthenticated = useIsAuthenticated()
```

### Sessions & tokens

```ts
import { getCurrentUser, fetchAuthSession, fetchUserAttributes, signOut } from 'aws-amplify/auth'

await getCurrentUser()                          // { username, userId, signInDetails } — throws if none
const session = await fetchAuthSession()         // session.tokens.idToken / accessToken (JWT)
await fetchAuthSession({ forceRefresh: true })   // manual refresh
const attrs = await fetchUserAttributes()        // email, etc.
await signOut()                                  // clears AsyncStorage tokens; fires Hub 'signedOut'
```

Tokens auto-refresh while a valid refresh token exists. Note: sessions from external IdPs
(`signInWithRedirect`) **cannot be refreshed by default**, and `signInDetails` is unavailable for
hosted-UI / redirect sign-ins.

### Social sign-in with deep links (native)

```ts
import { signInWithRedirect } from 'aws-amplify/auth'
await signInWithRedirect({ provider: 'Apple' }) // or 'Google', 'Amazon', 'Facebook'
```

On native, the OAuth redirect comes back through a **custom URL scheme**, not http(s). Configure the
scheme in `app.json` (this repo uses `"scheme": "mobile"`) and register matching redirect URLs in
the backend auth resource:

```ts
// amplify/auth/resource.ts — must include a non-http scheme URL for native
externalProviders: {
  callbackUrls: ['mobile://callback/', 'http://localhost:3000/'], // native + web
  logoutUrls:   ['mobile://signout/',  'http://localhost:3000/'],
}
```

> iOS requires an `appScheme` when creating the web auth session, so a scheme-based (non
> http/https) URL **must** be present in the configured redirect list. After redirect, expo-router
> deep-link handling routes back into the app and the Hub `signedIn` event syncs the store.

---

## 4. Data + realtime on React Native

The typed Data client is shared via `@workspace/data-client`, which wraps
`generateClient<Schema>()` as a lazy singleton. Types come from `@workspace/backend`.

```ts
import { getDataClient } from '@workspace/data-client'
import type { Schema } from '@workspace/backend'

const client = getDataClient()
```

### CRUDL — every call returns `{ data, errors }`

```ts
const { data: todo, errors } = await client.models.Todo.create({ content: 'Buy milk' })
if (errors) { /* handle */ }

const { data: list }   = await client.models.Todo.list()
const { data: one }    = await client.models.Todo.get({ id })
const { data: updated} = await client.models.Todo.update({ id, content: 'Buy oat milk' })
await client.models.Todo.delete({ id })
```

Auth mode defaults to the schema default; override per-client or per-request when needed:

```ts
const client = generateClient<Schema>({ authMode: 'userPool' })
await client.models.Todo.list({ authMode: 'apiKey' })
```

### Realtime (client-only — works fine on RN)

RN has **no React Server Components**, so there is no `'use client'` directive and no SSR.
Realtime is just a hook with `useEffect` + `unsubscribe`. Put these hooks under `entities/*/api`.

```tsx
// frontend/apps/mobile/src/entities/todo/api/useTodos.ts
import { useEffect, useState } from 'react'
import { getDataClient } from '@workspace/data-client'
import type { Schema } from '@workspace/backend'

export function useTodos() {
  const [todos, setTodos] = useState<Schema['Todo']['type'][]>([])

  useEffect(() => {
    const sub = getDataClient().models.Todo.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        setTodos([...items]) // live snapshot; isSynced=false until cloud sync completes
      },
      error: (err) => console.warn(err),
    })
    return () => sub.unsubscribe() // always clean up on unmount
  }, [])

  return todos
}
```

Granular event subscriptions (optionally server-side filtered):

```ts
const sub = getDataClient().models.Todo.onCreate({
  filter: { content: { contains: 'groceries' } },
}).subscribe({
  next: (created) => console.log(created),
  error: (e) => console.warn(e),
})
// later: sub.unsubscribe()
```

> NetInfo (installed) drives subscription connection state. You can monitor health via the Hub
> `api` channel `CONNECTION_STATE_CHANGE` payload (`Connected` / `Connecting` / `Disconnected`).

---

## 5. Storage on React Native

Storage APIs come from `aws-amplify/storage`. On RN you work with **device file URIs**, so convert
the URI to a `Blob` before uploading (RN `fetch(uri).blob()` is the standard bridge).

### Upload a device file (pick → blob → uploadData)

```tsx
import * as ImagePicker from 'expo-image-picker'
import { uploadData } from 'aws-amplify/storage'

async function uploadPickedImage() {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] })
  if (picked.canceled) return
  const uri = picked.assets[0].uri

  // RN: turn the file:// (or content://) URI into a Blob
  const blob = await fetch(uri).then((r) => r.blob())

  const task = uploadData({
    path: ({ identityId }) => `private/${identityId}/album/1.jpg`,
    data: blob,
    options: {
      onProgress: ({ transferredBytes, totalBytes }) => {
        if (totalBytes) {
          console.log(`upload ${Math.round((transferredBytes / totalBytes) * 100)} %`)
        }
      },
    },
  })

  const result = await task.result
  // task.pause() / task.resume() / task.cancel() are available
  return result.path
}
```

> `arrayBuffer` also works as `data`. Uploads not finished within ~1 hour are cancelled
> automatically — for very large files, chunk or keep the app foregrounded.

### Download / get a URL

```ts
import { getUrl, downloadData } from 'aws-amplify/storage'

// presigned URL (default expiry 900s) — good for <Image source={{ uri }}>
const { url, expiresAt } = await getUrl({ path: 'album/2024/1.jpg' })

// download bytes into memory
const { body } = await downloadData({ path: 'album/2024/1.jpg' }).result
const blob = await body.blob()  // or body.text() / body.json()
```

For displaying remote images, prefer `getUrl` and feed `url.toString()` into an `<Image>` source
rather than pulling the whole blob into memory.

---

## 6. Push notifications (Amazon Pinpoint)

> Status in this repo: **not yet wired.** Server-side notifications currently go through **SNS**.
> Mobile push via Amazon Pinpoint is the **recommended add-on** and is a documented follow-up.
> It needs a Pinpoint backend resource (custom CDK) that does not exist yet.

Mobile push uses **`aws-amplify/push-notifications`** backed by **Amazon Pinpoint** (APNs for iOS,
FCM for Android). Install the native push module alongside the existing deps:

```bash
bun add @aws-amplify/rtn-push-notification
```

Initialize **at the app entry point, after `Amplify.configure`** (so notifications are handled even
when the app is terminated), then request permissions and wire the listeners:

```ts
import {
  initializePushNotifications,
  requestPermissions,
  getPermissionStatus,
  onTokenReceived,
  onNotificationReceivedInForeground,
  onNotificationReceivedInBackground,
  onNotificationOpened,
  getLaunchNotification,
  identifyUser,
} from 'aws-amplify/push-notifications'

// 1) call once at startup, right after Amplify.configure(outputs)
initializePushNotifications()

// 2) ask the user (iOS prompt / Android 13+ runtime permission)
async function setupPush() {
  const status = await getPermissionStatus()
  if (status !== 'granted') await requestPermissions()

  // 3) device token — register it (and tie device to the Cognito user)
  onTokenReceived(async (token) => {
    await identifyUser({
      userId: /* Cognito sub from useAuthUser() */ 'cognito-sub',
      userProfile: {},
    })
  })

  // 4) receive / open handlers
  onNotificationReceivedInForeground((n) => console.log('fg', n))
  onNotificationReceivedInBackground((n) => console.log('bg', n)) // register at module scope
  onNotificationOpened((n) => console.log('opened', n))

  const launched = await getLaunchNotification() // notification that cold-started the app
  if (launched) console.log('launched from', launched)
}
```

`identifyUser` associates the device endpoint with the authenticated Cognito user so the backend can
target a specific user. Backend prerequisite: a **Pinpoint app** with APNs/FCM credentials, surfaced
into `amplify_outputs.json` so `aws-amplify/push-notifications` can resolve it.

> Note: AWS has announced Amazon Pinpoint end-of-support (Oct 30, 2026); new projects should plan to
> migrate to **AWS End User Messaging**. Track this when wiring push into the repo.
> **In-app messaging** (`aws-amplify/in-app-messaging`, also Pinpoint-backed) is a related optional
> add-on for in-session campaigns; it is out of scope for this repo today.

---

## 7. FSD placement & cross-platform sharing

What is shared in `frontend/packages/*` (used by both web and mobile):

- **`@workspace/auth`** — auth **state**: `NativeAuthProvider` (RN) / `AuthProvider` (web),
  `authStore` (Zustand), `useAuthUser` / `useIsAuthenticated`, `loadAuthUser`. Client auth **APIs**
  (`signIn`, `confirmSignIn`, `signOut`, ...) are imported directly from `aws-amplify/auth`.
- **`@workspace/data-client`** — `getDataClient()` (singleton `generateClient<Schema>()`).
- **`@workspace/backend`** — the `Schema` type for end-to-end typing.

App-specific code in `frontend/apps/mobile/src/*` follows FSD:

| Layer | Goes here |
|-------|-----------|
| `app/providers` | `AppProvider` composition (Theme + `NativeAuthProvider` + `import '@/shared/lib/amplify'`) |
| `shared/lib` | `amplify.ts` (polyfill + `Amplify.configure`) |
| `entities/*/api` | Data hooks: `observeQuery` / `onCreate` subscriptions, CRUD wrappers |
| `entities/*/model` | Zustand stores, entity types/hooks |
| `features/*` | User-facing actions (sign-in form, locale switcher, upload-image) |
| `widgets/*`, `views/*` | Composed UI; `views/*` are expo-router screens |

`AppProvider` composition (the side-effect import is what configures Amplify):

```tsx
<ThemeProvider value={...}>
  <NativeAuthProvider>{children}</NativeAuthProvider>
</ThemeProvider>
```

---

## 8. Gotchas

- **Expo Go is unsupported.** Amplify needs native modules → use a **custom dev client**
  (`expo prebuild` + `expo run:ios`/`run:android`, `expo start --dev-client`). `expo start` into Expo
  Go will crash on Amplify native module access.
- **Polyfill import order.** `import 'react-native-get-random-values'` must be the **first** import,
  before `aws-amplify`. Hermes has no Web Crypto; auth/UUIDs break otherwise.
- **`amplify_outputs.json` is generated & git-ignored.** A fresh clone won't run until you produce it
  with `bunx ampx sandbox` (or `bunx ampx generate outputs`). It is imported via a relative path.
- **No SSR on mobile.** Everything is client-side; there is no `runWithAmplifyServerContext`, no
  cookie store, no RSC. Don't copy web SSR patterns into the mobile app.
- **Social login deep links.** A non-http custom scheme (`mobile://...`) must be in `app.json`
  `scheme` AND in the backend `callbackUrls` / `logoutUrls`, or `signInWithRedirect` fails on iOS.
  External-IdP sessions don't auto-refresh.
- **File uploads = URI → Blob.** Always `fetch(uri).then(r => r.blob())` before `uploadData`. Watch
  the ~1h upload window for large files; use `task.pause/resume/cancel`.
- **NetInfo is required** for Data realtime/connection state — keep
  `@react-native-community/netinfo` installed; removing it breaks subscriptions.
- **Always `unsubscribe()`** from `observeQuery` / `onCreate`-style subscriptions in `useEffect`
  cleanup to avoid leaks and duplicate listeners.
- **Push is not wired yet.** Server push goes through SNS today; Pinpoint mobile push is a follow-up
  needing a custom CDK resource (and note the Pinpoint EOL → End User Messaging migration).
