---
name: amplify-gen2
description: >-
  AWS Amplify Gen2 guide for this boilerplate (Cognito auth, AppSync + DynamoDB data,
  S3 storage, Lambda incl. the Python/FastAPI custom function, SNS, Amplify Hosting).
  Use when adding or modifying the Amplify backend in `frontend/packages/backend/amplify/`
  (`defineAuth`/`defineData`/`defineStorage`/`defineFunction`/`backend.ts`), defining data
  models with `a.schema` and authorization rules (`allow.owner/groups/authenticated`),
  calling Amplify from the frontend (`getDataClient()`, `aws-amplify/auth`,
  `aws-amplify/storage`), wiring Next.js SSR (`runWithAmplifyServerContext`), managing
  secrets (`ampx sandbox secret`/`secret()`), extending with custom CDK
  (`backend.createStack`/`addOutput`), or running/deploying (`ampx sandbox`,
  `ampx pipeline-deploy`, `amplify.yml`, `amplify_outputs.json`). Triggers: Amplify, Cognito,
  AppSync, DynamoDB, S3, ampx, generateClient, a.model/a.schema, define{Auth,Data,Storage,Function}.
---

# Amplify Gen2 (this boilerplate)

Procedural guide for building on AWS Amplify Gen2 **efficiently and correctly** in this
repo. The backend is code-first TypeScript under one workspace package; the frontend
consumes it through typed clients. Keep FSD + monorepo conventions intact.

> **Research-first**: Amplify's API has version-specific nuances. Before writing a
> non-trivial resource or client call, read the relevant reference file below; if it
> doesn't cover the exact API, fetch the current official doc
> (`https://docs.amplify.aws/nextjs/...`) — do not guess from memory.

## Where everything lives (repo map)

```
frontend/packages/backend/            # @workspace/backend — the ONLY place backend is defined
└── amplify/
    ├── backend.ts                    # defineBackend({ auth, data, storage, api }) + CDK wiring (SNS, Function URL, outputs)
    ├── auth/resource.ts              # defineAuth — Cognito, passwordless Email OTP
    ├── data/resource.ts              # defineData — a.schema(), userPool default authz  (export type Schema)
    ├── storage/resource.ts           # defineStorage — S3, private, path-based
    └── functions/api/resource.ts     # Python Lambda (CDK) running FastAPI (Mangum)

frontend/packages/data-client/        # @workspace/data-client — getDataClient() = generateClient<Schema>()
frontend/packages/auth/               # @workspace/auth — AuthProvider / NativeAuthProvider / useAuthUser
frontend/apps/web/src/shared/lib/amplify/
    ├── server.ts                     # runWithAmplifyServerContext (createServerRunner)
    └── ConfigureAmplifyClientSide.tsx# Amplify.configure(outputs, { ssr: true })
frontend/apps/mobile/src/shared/lib/amplify.ts  # Amplify.configure(outputs) + RN polyfill
amplify.yml                           # Amplify Hosting monorepo build spec (appRoot=frontend)
```

`amplify_outputs.json` is **generated** by `ampx sandbox` / `ampx generate outputs` and is
**git-ignored**. Web imports it via the tsconfig path alias `amplify-outputs`.

## Core workflow

1. **Edit the backend** under `frontend/packages/backend/amplify/` (never define Amplify
   resources elsewhere). Use the correct `define*` API + the reference file below.
2. **Apply it**: run `sandbox` (devenv script = `ampx sandbox`) from a terminal with AWS
   credentials. This provisions a per-developer cloud stack and (re)writes `amplify_outputs.json`.
3. **Consume it from the frontend** using the typed clients — never re-implement config:
   - Data type: `import type { Schema } from '@workspace/backend'`
   - Data client: `import { getDataClient } from '@workspace/data-client'`
   - Auth (client): `aws-amplify/auth`; auth state: `@workspace/auth`
   - Auth (Next.js server): `runWithAmplifyServerContext` + `aws-amplify/auth/server`
   - Storage: `aws-amplify/storage`
4. **Place code per FSD**: cross-app logic in `packages/*`; app-specific data/mutations in
   the app's `entities/` (queries) and `features/` (mutations) `api/` segments. See
   `.claude/rules/frontend.md` / `render-optimization.md`.

## Which reference to read

| Task | Read |
|------|------|
| Data models, relationships, authorization (RLS replacement), CRUD, custom queries/mutations | [references/data.md](references/data.md) |
| **Realtime** — `observeQuery`, `onCreate/Update/Delete`, filters, connection state, custom `a.subscription` pub/sub, TanStack Query integration | [references/realtime.md](references/realtime.md) |
| Cognito auth: `defineAuth`, passwordless Email OTP, social/MFA, client session, Next.js SSR auth | [references/auth.md](references/auth.md) |
| S3 storage: `defineStorage`, access rules, upload/download/getUrl/list/remove | [references/storage.md](references/storage.md) |
| Lambda functions: Node `defineFunction`, env/secrets, triggers, data resolvers, **Python custom function (FastAPI)** | [references/functions.md](references/functions.md) |
| `defineBackend`, custom CDK (`createStack`/`addOutput`), `ampx` commands, `amplify.yml`, hosting | [references/backend-and-deploy.md](references/backend-and-deploy.md) |
| **Secrets & env vars** — `secret()`, `ampx sandbox secret`, branch secrets (SSM), function `environment`/typed `env`, `NEXT_PUBLIC_*`, `amplify_outputs.json` | [references/secrets-and-env.md](references/secrets-and-env.md) |
| **Mobile (Expo / React Native)** — native deps/polyfills, dev client, `Amplify.configure`/AsyncStorage, auth, data+realtime, storage (file URIs), Pinpoint push, monorepo sharing | [references/react-native.md](references/react-native.md) |
| **Wider AWS (SQS / Bedrock / EventBridge / …)** — integrating other AWS services via custom CDK: `createStack`, IAM grants, SQS event sources, Bedrock (AI Kit + Lambda/boto3), `addOutput` | [references/aws-services.md](references/aws-services.md) |

## Always-true conventions

- **Default authorization mode is `userPool`** (Cognito). Add other modes explicitly per
  model/operation; authorization rules in `data/resource.ts` are the **RLS replacement**.
- **Clients don't throw — check `errors` / handle nulls.** Data: `const { data, errors } =
  await getDataClient().models.X.list(); if (errors) { ... }`. Auth: `getCurrentUser()`
  throws only when unauthenticated (expected control flow).
- **Server vs client**: in Next.js Server Components/Actions use the **server** APIs
  (`runWithAmplifyServerContext`, `aws-amplify/auth/server`, cookie-based data client);
  in Client Components use `aws-amplify/auth` and `getDataClient()`. Realtime
  (`observeQuery`) is client-only.
- **One source of truth for config**: `Amplify.configure` happens once
  (`ConfigureAmplifyClientSide` on web, `shared/lib/amplify.ts` on mobile). Never call it
  ad-hoc in features.
- **Datetime** = `a.datetime()` (`AWSDateTime`, UTC ISO 8601). See `.claude/rules/datetime.md`.
- **Secrets** go to Amplify secrets (SSM): `ampx sandbox secret set NAME` →
  `secret('NAME')` in a resource def. Never hardcode or put secrets in `amplify_outputs.json`.
- **Backend compute escalation**: simple CRUD → Amplify Data directly; light glue →
  Node `defineFunction`; heavy/LLM/Python → the FastAPI Lambda (`functions/api`).

## Commands (devenv scripts; need AWS credentials)

```bash
sandbox            # ampx sandbox — provision per-dev stack + watch + generate amplify_outputs.json
sandbox-once       # ampx sandbox --once (CI/verify)
sandbox-delete     # tear down the sandbox
# secrets / outputs (run inside frontend/packages/backend):
npx ampx sandbox secret set NAME
npx ampx generate outputs --branch <b> --app-id <id> --out-dir ../../apps/web
```

Deploy is handled by Amplify Hosting via `amplify.yml` (`ampx pipeline-deploy`), not run
locally. See [references/backend-and-deploy.md](references/backend-and-deploy.md).

## Top gotchas

- A fresh clone won't type-check/build until `amplify_outputs.json` exists — run `sandbox`
  or `ampx generate outputs` first. (It's intentionally git-ignored.)
- Passwordless Email OTP requires the Cognito user pool to send via **Amazon SES**.
- The Python custom function bundles `backend-py` at deploy time — needs `uv` + `python3`
  (or Docker) available where `ampx` runs.
- `custom.*` outputs (e.g. `backendApiUrl`) are loosely typed; access defensively.
- Use the latest APIs — confirm against the official docs when unsure (versions here:
  `aws-amplify@^6.18`, `@aws-amplify/backend@^1.23`, `@aws-amplify/backend-cli@^1.8.3`).
