# Amplify Gen2 — Secrets & Environment Variables

How to configure **secrets** (confidential) and **environment variables** (non-confidential)
across the backend, functions, sandbox, branch deployments, and the frontend.

> **Golden rule:** secrets are fetched from SSM Parameter Store **at runtime** and never
> written to build artifacts; environment variables are **plaintext** in the build output.
> Never put an API key, client secret, or token in an environment variable — use `secret()`.

## Table of contents

1. [secrets vs environment variables](#1-secrets-vs-environment-variables)
2. [Backend secrets — `secret('NAME')`](#2-backend-secrets--secretname)
3. [Setting secrets: sandbox vs branch](#3-setting-secrets-sandbox-vs-branch)
4. [Function environment variables](#4-function-environment-variables)
5. [Function secrets](#5-function-secrets)
6. [This repo's Python (FastAPI) Lambda](#6-this-repos-python-fastapi-lambda)
7. [Frontend env vars (NEXT_PUBLIC_*) & amplify_outputs.json](#7-frontend-env-vars-next_public_--amplify_outputsjson)
8. [Local sandbox with .env.local (dotenvx)](#8-local-sandbox-with-envlocal-dotenvx)
9. [Gotchas](#9-gotchas)

---

## 1. secrets vs environment variables

| | Secret (`secret('NAME')`) | Environment variable |
|---|---|---|
| For | API keys, OAuth client secrets, tokens, passwords | log level, feature flags, endpoints, public IDs |
| Stored in | **SSM Parameter Store** (SecureString) | plaintext in the Lambda/build config |
| Visibility | resolved at runtime, in memory | **plaintext in build artifacts** |
| Set with | `ampx sandbox secret set` / Amplify console Secrets | `defineFunction({ environment })` / `addEnvironment` / Hosting env vars |
| Per-branch | yes (shared or branch-specific path) | yes (Hosting console) |

## 2. Backend secrets — `secret('NAME')`

Reference a secret by name in any backend resource definition. The real value lives in SSM,
resolved per environment (sandbox / each branch).

```typescript
// amplify/auth/resource.ts
import { defineAuth, secret } from '@aws-amplify/backend'

export const auth = defineAuth({
  loginWith: {
    email: { otpLogin: true },
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
      },
      callbackUrls: ['http://localhost:3000/'],
      logoutUrls: ['http://localhost:3000/'],
    },
  },
})
```

`secret(...)` is also valid inside `defineData`, `defineStorage`, and a function's
`environment` (§5). The value is **never** committed or printed.

## 3. Setting secrets: sandbox vs branch

**Sandbox (per-developer)** — interactive CLI; values go to SSM, **not** shown in the Amplify
console:

```bash
cd frontend/packages/backend
bunx ampx sandbox secret set GOOGLE_CLIENT_ID     # prompts for the value
bunx ampx sandbox secret list
bunx ampx sandbox secret get GOOGLE_CLIENT_ID
bunx ampx sandbox secret remove GOOGLE_CLIENT_ID
```

**Branch / deployed environments** — set in the Amplify console:
**Hosting → Secrets → Manage secrets** (choose "all branches" or a specific branch). Stored in
SSM Parameter Store at:

- shared across branches: `/amplify/shared/<app-id>/<secret-key>`
- branch-specific: `/amplify/<app-id>/<branchname>-branch-<hash>/<secret-key>`

A branch-specific value overrides the shared one for that branch. Adding/removing a secret a
resource references requires a redeploy of that branch.

## 4. Function environment variables

**Node `defineFunction`** — declare non-secret vars in `environment`; read them at runtime via
the **generated, typed `env` object** (do not use bare `process.env` for your own vars):

```typescript
// amplify/functions/say-hello/resource.ts
import { defineFunction } from '@aws-amplify/backend'

export const sayHello = defineFunction({
  name: 'say-hello',
  environment: {
    NAME: 'World',
    API_ENDPOINT: process.env.API_ENDPOINT ?? '', // build-time value from the deploy env
  },
})
```

```typescript
// amplify/functions/say-hello/handler.ts
import { env } from '$amplify/env/say-hello' // generated: .amplify/generated/env/say-hello.ts

export const handler = async () => `Hello, ${env.NAME}! (${env.API_ENDPOINT})`
```

- Amplify generates `.amplify/generated/env/<function-name>.ts` from the declared names (plus
  Lambda-predefined vars), giving full type-safety. Resolution relies on the `$amplify/*`
  `paths` alias already set in `amplify/tsconfig.json`.
- **Post-composition values** (e.g. an ARN created in `backend.ts`) are injected after the
  fact with `backend.<fn>.resources.lambda.addEnvironment('KEY', value)` — see §6.

## 5. Function secrets

To give a function a secret, put `secret('NAME')` **inside its `environment`**. It is fetched
at runtime and exposed through the same typed `env` object — never written to the build output.

```typescript
import { defineFunction, secret } from '@aws-amplify/backend'

export const sayHello = defineFunction({
  name: 'say-hello',
  environment: {
    API_KEY: secret('MY_API_KEY'), // resolved from SSM at runtime
  },
})
```

```typescript
import { env } from '$amplify/env/say-hello'
const authHeader = `Bearer ${env.API_KEY}` // secret supplied in memory at runtime
```

Register the value with `ampx sandbox secret set MY_API_KEY` (sandbox) or the console (branch).

## 6. This repo's Python (FastAPI) Lambda

The `$amplify/env/<fn>` typed object is a **Node/TS** convenience. The Python custom function
(`functions/api`) reads its environment with `os.getenv(...)`. Env is injected in `backend.ts`
after composition (so it can use values created there):

```typescript
// amplify/backend.ts
const fastapi = backend.api.resources.lambda
const { userPool, userPoolClient } = backend.auth.resources

fastapi.addEnvironment('COGNITO_USER_POOL_ID', userPool.userPoolId)
fastapi.addEnvironment('COGNITO_APP_CLIENT_ID', userPoolClient.userPoolClientId)
fastapi.addEnvironment('SNS_TOPIC_ARN', notificationsTopic.topicArn)
```

```python
# backend-py/.../auth_middleware.py
import os
user_pool_id = os.environ["COGNITO_USER_POOL_ID"]
```

To give the Python Lambda a **secret**, prefer declaring it on the function's `environment`
with `secret('NAME')` in `functions/api/resource.ts`; reading it in Python is then `os.getenv`.

## 7. Frontend env vars (NEXT_PUBLIC_*) & amplify_outputs.json

There are two sources of frontend config — use the right one:

- **Backend metadata** (auth/data/storage endpoints, `custom.*` outputs like `backendApiUrl`):
  read from **`amplify_outputs.json`** (generated by sandbox / `ampx generate outputs`). Web
  imports it via the tsconfig path alias `amplify-outputs`.

  ```typescript
  import outputs from 'amplify-outputs'
  const backendApiUrl = outputs.custom.backendApiUrl
  ```

- **Frontend-only public values** (`NEXT_PUBLIC_*`): set them in **Amplify Hosting → Environment
  variables**, then write them into `.env` during the build in `amplify.yml`, and read with
  `process.env.NEXT_PUBLIC_X`:

  ```yaml
  # amplify.yml (frontend build phase)
  build:
    commands:
      - env | grep -e NEXT_PUBLIC_ >> apps/web/.env.production || true
      - bun run --filter @workspace/web build
  ```

> Do **not** put secrets in `NEXT_PUBLIC_*` — they are inlined into the client bundle.
> `amplify_outputs.json` cannot be overridden via env vars; it is generated from the backend.

## 8. Local sandbox with .env.local (dotenvx)

For non-secret values your backend code reads at **build/synth time** (e.g.
`process.env.API_ENDPOINT` inside a `resource.ts`), load a local `.env.local` when starting the
sandbox:

```bash
bunx dotenvx run --env-file=.env.local -- ampx sandbox
```

Real secrets still go through `ampx sandbox secret set` (SSM), never `.env.local`.

## 9. Gotchas

- **Never store secrets in `environment` as plaintext** — they end up in build artifacts. Use
  `secret('NAME')` and reference it via `environment` only.
- **Sandbox secrets aren't in the console** — they live in SSM under the sandbox identifier;
  branch secrets are managed in Hosting → Secrets.
- **Referencing a not-yet-set secret fails the deploy** — set the secret before (or alongside)
  deploying the resource that uses it.
- **Node env access is the generated `env` object**, not ad-hoc `process.env` (which only has
  build-time + Lambda-predefined vars). Python/custom Lambdas use `os.getenv`.
- **`NEXT_PUBLIC_*` is build-time inlined** into the client bundle — public only, and a rebuild
  is required to change it.
- **`amplify_outputs.json` is generated & git-ignored** — a fresh clone has no env/secret
  context until `ampx sandbox` / `ampx generate outputs` runs.
