# Amplify Gen2 Auth (Cognito) — Reference

Versions: `aws-amplify@^6.18`, `@aws-amplify/backend@^1.23`, `@aws-amplify/adapter-nextjs@^1.7.3`.

This repo uses **passwordless Email OTP** (`loginWith: { email: { otpLogin: true } }`).
Backend lives in `frontend/packages/backend/amplify/auth/resource.ts`; clients import from
`aws-amplify/auth` (client) and `aws-amplify/auth/server` (SSR). Auth state is shared via
`@workspace/auth`. Always confirm the latest API against the official docs
(https://docs.amplify.aws/nextjs/build-a-backend/auth/) — do not implement from memory.

## Table of Contents

1. [defineAuth basics](#1-defineauth-basics)
2. [Passwordless Email OTP end-to-end (repo default)](#2-passwordless-email-otp-end-to-end-repo-default)
3. [Client session & user](#3-client-session--user)
4. [Next.js server-side auth (SSR)](#4-nextjs-server-side-auth-ssr)
5. [Authorization groups → Data `allow.groups`](#5-authorization-groups--data-allowgroups)
6. [Modify with CDK](#6-modify-with-cdk)
7. [Other client APIs: sign-up, password, attributes, account, guest](#7-other-client-apis-sign-up-password-attributes-account-guest)
8. [Gotchas](#8-gotchas)

---

## 1. defineAuth basics

Amplify Auth is built on **Amazon Cognito** (User Pools = user directory + sign-in;
Identity Pools = AWS-service authorization). `loginWith` is required.

> Immutable after first deploy: the attributes used to **identify** users (email/phone),
> the **sign-in methods**, and **verification methods** cannot be renamed/removed/changed later.

```typescript
import { defineAuth } from '@aws-amplify/backend'

// Minimal: email + password is the default if loginWith is empty.
export const auth = defineAuth({
  loginWith: { email: true },
})
```

`loginWith` accepts `email`, `phone`, and `externalProviders`. Username/phone sign-in and
password policies are configured here (or via CDK overrides — see §6).

### Passwordless (`email.otpLogin`)

```typescript
export const auth = defineAuth({
  loginWith: { email: { otpLogin: true } }, // ← repo default
})
```

> **MFA and passwordless cannot be used together.**

### Social / external providers

`secret('NAME')` reads from Amplify secrets (SSM Parameter Store). `callbackUrls` /
`logoutUrls` are required for the hosted UI redirect flow.

```typescript
import { defineAuth, secret } from '@aws-amplify/backend'

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email'],
        attributeMapping: { email: 'email' },
      },
      signInWithApple: {
        clientId: secret('SIWA_CLIENT_ID'),
        keyId: secret('SIWA_KEY_ID'),
        privateKey: secret('SIWA_PRIVATE_KEY'),
        teamId: secret('SIWA_TEAM_ID'),
      },
      loginWithAmazon: {
        clientId: secret('LOGINWITHAMAZON_CLIENT_ID'),
        clientSecret: secret('LOGINWITHAMAZON_CLIENT_SECRET'),
      },
      facebook: {
        clientId: secret('FACEBOOK_CLIENT_ID'),
        clientSecret: secret('FACEBOOK_CLIENT_SECRET'),
      },
      callbackUrls: ['http://localhost:3000/', 'https://mywebsite.com/'],
      logoutUrls: ['http://localhost:3000/', 'https://mywebsite.com/'],
    },
  },
})
```

### userAttributes, groups, MFA, account recovery

```typescript
export const auth = defineAuth({
  loginWith: { email: true },
  userAttributes: {
    givenName: { mutable: true, required: false },
    familyName: { mutable: true, required: false },
    'custom:display_name': { dataType: 'String', mutable: true, minLen: 1, maxLen: 16 },
    'custom:favorite_number': { dataType: 'Number', mutable: true, min: 1, max: 100 },
    'custom:is_beta_user': { dataType: 'Boolean', mutable: true },
  },
  groups: ['ADMINS', 'EDITORS'],
  // accountRecovery: 'EMAIL_ONLY',
  // multifactor: { mode: 'OPTIONAL', sms: true, totp: true }, // NOT with passwordless
})
```

> Custom attributes use the `custom:` prefix. Data types: `String`, `Number`, `Boolean`,
> `DateTime`. You **cannot** switch an attribute between required and not-required later.

---

## 2. Passwordless Email OTP end-to-end (repo default)

**Backend** — `frontend/packages/backend/amplify/auth/resource.ts`:

```typescript
import { defineAuth } from '@aws-amplify/backend'

export const auth = defineAuth({
  loginWith: { email: { otpLogin: true } },
})
```

> **SES requirement:** for Cognito to send OTP emails, the user pool must be configured to
> use **Amazon SES**. (SMS OTP would instead require Amazon SNS.)

**Client** — request the OTP, then confirm the code. The repo uses the `USER_AUTH` flow with
`preferredChallenge: 'EMAIL_OTP'`:

```typescript
import { signIn, confirmSignIn } from 'aws-amplify/auth'

// Step 1 — start sign-in; Cognito emails a one-time code.
const { nextStep } = await signIn({
  username: email,
  options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' },
})

if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE') {
  // Step 2 — confirm with the 6-digit code the user typed.
  const { nextStep: confirmStep } = await confirmSignIn({ challengeResponse: code })
  if (confirmStep.signInStep === 'DONE') {
    // signed in — Hub fires 'signedIn' (see §3)
  }
}
```

**Resend** the code — the `USER_AUTH` sign-in flow has **no dedicated resend API**
(`resendSignInCode` does **not** exist in `aws-amplify@6`; `resendSignUpCode` is only for
the password sign-**up** flow). Re-invoke `signIn` with the same options to restart the
challenge and send a fresh code:

```typescript
await signIn({
  username: email,
  options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' },
})
```

**Sign out:**

```typescript
import { signOut } from 'aws-amplify/auth'
await signOut() // optional: signOut({ global: true })
```

Relevant `signInStep` values: `CONFIRM_SIGN_IN_WITH_EMAIL_CODE`, `CONFIRM_SIGN_IN_WITH_SMS_CODE`,
`CONFIRM_SIGN_IN_WITH_TOTP_CODE`, `CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION` (when multiple
first factors exist; read `nextStep.availableChallenges`), `DONE`.

---

## 3. Client session & user

All from `aws-amplify/auth`. `@workspace/auth` (`AuthProvider`) subscribes to `Hub` and stores
the `AuthUser` in Zustand; consume via the selector hooks `useAuthUser()` / `useIsAuthenticated()`
rather than calling these directly in components.

```typescript
import { getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth'

// Throws if no authenticated user — guard with try/catch or .catch(() => null).
const { username, userId, signInDetails } = await getCurrentUser()

// Tokens. session.tokens is undefined when signed out.
const session = await fetchAuthSession()
const idToken = session.tokens?.idToken
const accessToken = session.tokens?.accessToken
const jwt = accessToken?.toString() // raw JWT string for Authorization headers
// Force a refresh: await fetchAuthSession({ forceRefresh: true })

// Standard + custom attributes (email, given_name, custom:display_name, ...).
const attributes = await fetchUserAttributes()
```

### Hub auth events

```typescript
import { Hub } from 'aws-amplify/utils'

const stop = Hub.listen('auth', ({ payload }) => {
  switch (payload.event) {
    case 'signedIn':
      break
    case 'signedOut':
      break
    case 'tokenRefresh':
      break
    case 'tokenRefresh_failure':
      break
    case 'signInWithRedirect':
      break
    case 'signInWithRedirect_failure':
      break
    case 'customOAuthState':
      break // payload.data holds the custom state
  }
})

stop() // unsubscribe to avoid leaks (e.g. useEffect cleanup)
```

This is exactly what `AuthProvider` in `@workspace/auth` wraps: on `signedIn`/`tokenRefresh`
it refreshes the stored `AuthUser`; on `signedOut` it clears it.

---

## 4. Next.js server-side auth (SSR)

### Server runner — `frontend/apps/web/src/shared/lib/amplify/server.ts`

```typescript
import { createServerRunner } from '@aws-amplify/adapter-nextjs'
import outputs from 'amplify-outputs'

export const { runWithAmplifyServerContext } = createServerRunner({
  config: outputs,
})
```

### Client config — `ConfigureAmplifyClientSide`

`ssr: true` tells Amplify to store tokens in the browser **cookie** store so the server can read
them.

```typescript
'use client'
import { Amplify } from 'aws-amplify'
import outputs from 'amplify-outputs'

Amplify.configure(outputs, { ssr: true })

export default function ConfigureAmplifyClientSide() {
  return null
}
```

### Server APIs

Import server variants from **`aws-amplify/auth/server`** (`getCurrentUser`, `fetchAuthSession`,
`fetchUserAttributes`) and run them inside `runWithAmplifyServerContext`, passing Next's `cookies`.

### Server Component auth gate (redirect)

```typescript
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from 'aws-amplify/auth/server'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'

export default async function DashboardPage() {
  await cookies() // opt out of caching for user-specific data

  const user = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: (contextSpec) => getCurrentUser(contextSpec),
  }).catch(() => null) // getCurrentUser throws when unauthenticated

  if (!user) redirect('/login')

  return <p>Hello, {user.signInDetails?.loginId}</p>
}
```

To read groups/claims on the server, use `fetchAuthSession(contextSpec)` the same way and inspect
`session.tokens?.accessToken.payload['cognito:groups']`.

---

## 5. Authorization groups → Data `allow.groups`

Groups declared in `defineAuth({ groups: [...] })` surface as the `cognito:groups` claim on both
the ID and access tokens, and pair directly with Amplify Data authorization rules.

```typescript
// amplify/auth/resource.ts
export const auth = defineAuth({
  loginWith: { email: { otpLogin: true } },
  groups: ['ADMINS', 'EDITORS'],
})
```

```typescript
// amplify/data/resource.ts
import { a, defineData, type ClientSchema } from '@aws-amplify/backend'

const schema = a.schema({
  Article: a
    .model({ title: a.string() })
    .authorization((allow) => [allow.groups(['EDITORS']).to(['read', 'update'])]),
})

export type Schema = ClientSchema<typeof schema>
export const data = defineData({ schema })
```

Read group membership client- or server-side via `fetchAuthSession`:

```typescript
const { tokens } = await fetchAuthSession()
const groups = (tokens?.accessToken.payload['cognito:groups'] as string[]) ?? []
```

> Limit: up to 10,000 groups per user pool. Group IAM roles are reachable in CDK via
> `backend.auth.resources.groups['ADMINS'].role`.

---

## 6. Modify with CDK

Access the underlying Cognito constructs through `backend.auth.resources` in
`amplify/backend.ts` for anything `defineAuth` doesn't expose (Lambda triggers, password policy,
L1 overrides).

```typescript
import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'

const backend = defineBackend({ auth, data })

// L2 constructs
const { userPool, userPoolClient } = backend.auth.resources

// L1 (Cfn) constructs for raw property overrides
const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources

cfnUserPool.policies = {
  passwordPolicy: {
    minimumLength: 10,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    requireUppercase: true,
  },
}

// Example: low-level passwordless / USER_AUTH wiring via overrides
cfnUserPool.addPropertyOverride('Policies.SignInPolicy.AllowedFirstAuthFactors', [
  'PASSWORD',
  'EMAIL_OTP',
])
cfnUserPoolClient.explicitAuthFlows = ['ALLOW_REFRESH_TOKEN_AUTH', 'ALLOW_USER_AUTH']
```

Add a Lambda trigger by attaching a `defineFunction` to `auth` (e.g.
`triggers: { preSignUp: defineFunction(...) }` in `defineAuth`), or extend behavior via
`userPool.addTrigger(...)` on the L2 construct. Custom attributes are normally added through
`defineAuth({ userAttributes })` (§1) rather than CDK.

---

## 7. Other client APIs: sign-up, password, attributes, account, guest

This repo's default flow is passwordless Email OTP (§2), but Cognito + `aws-amplify/auth`
also expose the full account lifecycle. Reach for these when adding password login, profile
editing, or self-service account management. Wrap FSD-style: put each call in a
`features/<x>/api/*.ts` (client) module returning `{ success } | { error }`, like §2.

### Password-based sign-up

To allow password registration, keep `loginWith.email: true` (and optionally a password
policy) in `defineAuth`. Client flow:

```ts
import { signUp, confirmSignUp, autoSignIn, resendSignUpCode } from 'aws-amplify/auth'

// 1) register — autoSignIn lets the user be signed in right after confirmation
const { nextStep } = await signUp({
  username: email,
  password,
  options: {
    userAttributes: { email, name },
    autoSignIn: { authFlowType: 'USER_AUTH' },
  },
})
// nextStep.signUpStep: 'CONFIRM_SIGN_UP' | 'COMPLETE_AUTO_SIGN_IN' | 'DONE'

// 2) confirm the emailed code
await confirmSignUp({ username: email, confirmationCode: code })

// 3) finish auto sign-in (when nextStep is COMPLETE_AUTO_SIGN_IN)
await autoSignIn()

// resend the sign-up code
await resendSignUpCode({ username: email })
```

Password sign-in is the same `signIn` as §2 but with `password` (default flow):
`await signIn({ username: email, password })` → may return `nextStep.signInStep`
(`CONFIRM_SIGN_IN_WITH_*`, `RESET_PASSWORD`, `DONE`).

### Password reset & change

```ts
import { resetPassword, confirmResetPassword, updatePassword } from 'aws-amplify/auth'

// forgot password — sends a code
const { nextStep } = await resetPassword({ username: email })
// nextStep.resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' | 'DONE'

await confirmResetPassword({ username: email, confirmationCode: code, newPassword })

// change password for the signed-in user
await updatePassword({ oldPassword, newPassword })
```

### User attributes

```ts
import {
  fetchUserAttributes,
  updateUserAttributes,
  confirmUserAttribute,
  sendUserAttributeVerificationCode,
} from 'aws-amplify/auth'

const attrs = await fetchUserAttributes() // Record<string, string> (email, name, ...)

const { nextStep } = await updateUserAttributes({
  userAttributes: { name: 'New Name', 'custom:plan': 'pro' },
})
// changing email/phone returns nextStep CONFIRM_ATTRIBUTE_WITH_CODE:
await sendUserAttributeVerificationCode({ userAttributeKey: 'email' })
await confirmUserAttribute({ userAttributeKey: 'email', confirmationCode: code })
```

> Custom attributes must first be declared in `defineAuth({ userAttributes: { 'custom:plan': ... } })`.

### Delete account

```ts
import { deleteUser } from 'aws-amplify/auth'
await deleteUser() // permanently deletes the signed-in Cognito user; sign them out after
```

### Guest (unauthenticated) access

Amplify Gen2 provisions a Cognito **identity pool** alongside the user pool. Guest access is
governed by `allow.guest()` rules on Data/Storage resources (which use the identity pool's
unauthenticated role) — there is no separate `allowGuestAccess` flag to flip in `defineAuth`.

```ts
import { fetchAuthSession } from 'aws-amplify/auth'
// Works without a signed-in user; returns guest (unauth) AWS credentials + identityId
const { credentials, identityId } = await fetchAuthSession()
```

Pair with Data `allow.guest()` / Storage `allow.guest().to(['read'])` to expose public data.

---

## 8. Gotchas

- **`getCurrentUser` throws when unauthenticated** — it does not return `null`. Always wrap in
  `.catch(() => null)` (server) or `try/catch` (client) before branching.
- **SSR needs cookies.** Tokens are only readable on the server when the client configured
  `Amplify.configure(outputs, { ssr: true })`; otherwise tokens live in memory/localStorage and
  the server context sees no session.
- **ID token vs access token.** They carry different audiences and claims (`verify_aud` differs).
  Use the **access token** for API authorization; the ID token carries user-profile claims. Both
  include `cognito:groups`.
- **`session.tokens` can be `undefined`** when signed out — optional-chain (`tokens?.idToken`)
  and call `.toString()` only on a present token to get the raw JWT.
- **MFA and passwordless are mutually exclusive** — do not enable both in `defineAuth`.
- **Email OTP requires SES**; SMS OTP requires SNS. Without the messaging service configured,
  the OTP email/SMS never sends.
- **Immutable config.** Sign-in identifiers, sign-in methods, and verification methods are fixed
  at first deploy — plan them up front; changing later means recreating the user pool.
- **Don't trust client-side auth checks for authorization.** Enforce access with Cognito + the
  per-model `allow.*` rules in `amplify/data/resource.ts`.
```
