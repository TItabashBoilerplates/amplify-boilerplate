# Special Notes

## Type Sharing & Generation

- **Frontend**: The Amplify Data schema's `Schema` type is consumed via
  `import type { Schema } from '@workspace/backend'`. The GraphQL client type is provided by
  `getDataClient()` (`@workspace/data-client`, wrapping `generateClient<Schema>()`). Types and the
  client are generated when `ampx sandbox` deploys the backend — no separate type-generation task.
- **Backend Python**: Domain models live in `backend-py/apps/api/src/domain/`. The FastAPI app is
  deployed to AWS Lambda (Mangum handler `api.lambda_handler.handler`).

## AI/ML Features

This project integrates comprehensive AI/ML capabilities (via the FastAPI Lambda backend):

- **LLM Orchestration**: LangChain/LangGraph for complex AI workflow construction
- **LLM Providers**: OpenAI (GPT-4), Anthropic (Claude), Replicate, FAL
- **Image Generation**: Diffusers (Stable Diffusion, etc.), DALL-E
- **Deep Learning**: PyTorch, Transformers (HuggingFace), Accelerate
- **Real-time Communication**: LiveKit (WebRTC audio/video), aiortc
- **Voice Synthesis**: Cartesia API
- **RAG (Retrieval Augmented Generation)**: Vector search + LLM integration
- **Monitoring**: LangSmith (debugging and tracing)

For a detailed list of integrated libraries, see the "AI/ML Integration Details" section in
[`architecture.md`](./architecture.md).

## Authentication

- Amazon Cognito (Amplify Auth) integration — passwordless Email OTP
- Client: `aws-amplify/auth` (`signIn` USER_AUTH + EMAIL_OTP, `confirmSignIn`, `resendSignInCode`, `signOut`)
- Server (Next.js): `runWithAmplifyServerContext` (`@/shared/lib/amplify/server`) +
  `getCurrentUser` / `fetchAuthSession` (`aws-amplify/auth/server`)
- Backend (FastAPI on Lambda): Cognito JWT verification middleware
  (`backend-py/.../middleware/auth_middleware.py`)
- Auth UI/state package: `@workspace/auth` (`AuthProvider` / `NativeAuthProvider`,
  `useAuthUser` / `useIsAuthenticated`)

## Development Workflow

- Use **devenv** scripts for consistency across team (Makefile は deprecated・削除済み)
- Secrets managed via Amplify secrets (SSM Parameter Store): `ampx sandbox secret set NAME` / `secret('NAME')`
- Amplify backend runs as a **per-dev cloud sandbox** (`ampx sandbox`), generating `amplify_outputs.json`
  (replaces local Supabase Docker). FastAPI can also be run locally via the devenv native process manager.
- Branch/production deploys run on AWS Amplify Hosting via `amplify.yml` (`ampx pipeline-deploy`)
- ⚠️ `sandbox` / deploy require AWS credentials (a profile)
