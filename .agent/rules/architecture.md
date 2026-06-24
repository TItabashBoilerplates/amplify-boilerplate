# Architecture Overview

This is a full-stack application boilerplate with a multi-platform frontend and AWS-backed backend services. All infrastructure runs on AWS via **AWS Amplify Gen2** (Cognito / AppSync + DynamoDB / S3 / Lambda / SNS / Amplify Hosting).

## Frontend Architecture

- **Framework**: Next.js 16 with App Router
- **UI Library**: shadcn/ui (Radix UI + TailwindCSS 4)
- **Tech Stack**: React 19, TypeScript, Bun package manager
- **Build System**: Turborepo for monorepo management
- **Architecture Pattern**: Feature-Sliced Design (FSD)

**→ For detailed frontend documentation, see [`frontend/README.md`](../../frontend/README.md)**

## Amplify Backend (`frontend/packages/backend/`)

Amplify Gen2 のモノレポ・ベストプラクティスに従い、バックエンド定義は共有ワークスペース
パッケージ `@workspace/backend` に集約する：

```
packages/backend/amplify/
├── backend.ts            # defineBackend({ auth, data, storage, api }) + SNS 配線
├── auth/resource.ts      # Amazon Cognito（Amplify Auth, Email OTP passwordless）
├── data/resource.ts      # AWS AppSync + DynamoDB（a.schema, owner/userPool 認可）
├── storage/resource.ts   # Amazon S3（Amplify Storage, 非公開・path 単位アクセス）
└── functions/api/        # FastAPI を載せた Python Lambda（CDK Function PYTHON_3_13）
```

- **Auth**: Amazon Cognito（Amplify Auth）。クライアントは `aws-amplify/auth` の `signIn`（USER_AUTH +
  EMAIL_OTP）/ `confirmSignIn` / `resendSignInCode` / `signOut`。サーバ（Next.js）は
  `runWithAmplifyServerContext`（`@/shared/lib/amplify/server`）+ `getCurrentUser` / `fetchAuthSession`
  （`aws-amplify/auth/server`）。認証 UI は `@workspace/auth`（`AuthProvider` / `NativeAuthProvider`,
  `useAuthUser` / `useIsAuthenticated`）。
- **Data**: AWS AppSync + DynamoDB（Amplify Data）。スキーマはコードファーストで `amplify/data/resource.ts`
  の `a.schema(...)` / `a.model(...)` に定義。**認可ルールは schema 内で宣言**
  （`.authorization((allow) => [allow.owner()])`）。フロントは `import type { Schema } from '@workspace/backend'`
  で型共有し、`getDataClient()`（`@workspace/data-client`、内部で `generateClient<Schema>()` をラップ）で
  `getDataClient().models.Todo.list()` のようにアクセスする。
- **Storage**: Amazon S3（Amplify Storage, `defineStorage`）。非公開・path ベースのアクセス制御。
- **Notifications**: Amazon SNS。

フロントは `import type { Schema } from '@workspace/backend'` で型共有、
`getDataClient()`（`@workspace/data-client`）でデータアクセス。

## Backend Compute (Python on AWS Lambda)

- **FastAPI on AWS Lambda**: `backend-py/` の FastAPI アプリを Amplify の Python custom function
  （`amplify/functions/api/resource.ts`, CDK Function PYTHON_3_13）として Lambda にデプロイ。
  Mangum ハンドラ `api.lambda_handler.handler` 経由で ASGI を実行する。
- **Auth**: Cognito JWT 検証ミドルウェア（`backend-py/.../middleware/auth_middleware.py`）。
- **uv workspace 構成**: `apps/api`（FastAPI）, `apps/mcp`（MCP サーバ）, `packages/core`
  （logger / exceptions / auth utils）。
- **AI Integration**: LangChain / LangGraph、マルチモーダル AI、ベクトル検索など。

### Backend Clean Architecture Structure

```
backend-py/apps/api/src/
├── controller/       # HTTP request/response handling only
├── usecase/          # Business logic
├── gateway/          # Data access abstraction interfaces
├── domain/           # Entities and models
├── infra/            # External dependencies (API clients, AWS SDK 等)
└── middleware/       # Authentication (Cognito JWT), CORS, logging
```

**Separation of Concerns**:
- Controllers: HTTP layer only, no business logic
- Use Cases: Business logic and orchestration
- Gateways: Data access abstraction (interface definitions)
- Infrastructure: Gateway implementations and external system integration
- Domain: Entities and Value Objects

**→ For detailed Python backend documentation, see [`backend-py/README.md`](../../backend-py/README.md)**

### AI/ML Integration Details

**Implemented AI/ML Libraries**:

- **LLM Orchestration**:
  - LangChain: Complex AI workflow construction
  - LangGraph: Stateful agent implementation
  - LangSmith: Monitoring and debugging
  - Langchainhub: Prompt template management

- **LLM Providers**:
  - OpenAI: GPT-4, DALL-E, Whisper integration
  - Anthropic: Claude integration (via LangChain)
  - Replicate: Open source model API
  - FAL: Fast AI inference API

- **Deep Learning & ML**:
  - Torch: Deep learning framework
  - Diffusers: Image generation (Stable Diffusion, etc.)
  - Transformers: HuggingFace models
  - Accelerate: Model acceleration and distributed training

- **Real-time Communication**:
  - LiveKit: WebRTC/real-time audio and video communication
  - livekit-api: LiveKit API client
  - aiortc: WebRTC implementation

- **Voice & Audio**:
  - Cartesia: Voice synthesis API

## Data Design

- Owner / userPool-based authorization declared in the Amplify Data schema (replaces row-level security)
- Multi-client modeling with corporate users, general users, and virtual users
- Chat system with rooms, messages, and user relationships
- Clean separation between user types and permissions via schema authorization rules
