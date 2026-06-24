# Package Management

**Important**: This project uses an **independent monorepo structure without a root package.json**.

## Package Manager Usage Patterns

Each component uses the optimal package manager for its purpose:

### Frontend (`frontend/`): Bun

- Fast JavaScript runtime & package manager
- Fully compatible with Node.js, npm alternative
- Monorepo management with Bun workspace + Turborepo
- Dependencies managed in `frontend/package.json`
- Includes the Amplify backend package `@workspace/backend`
  (`frontend/packages/backend/`), driven by the **`ampx`** Amplify CLI

### Backend Python (`backend-py/`): uv

- Rust-based ultra-fast Python package manager
- Reliable tool from the Ruff (linter) developers
- uv workspace: `apps/api` (FastAPI), `apps/mcp`, `packages/core`
- Dependencies managed per member `pyproject.toml`, single root `uv.lock`

### Amplify CLI: `ampx`

- Used for the Amplify Gen2 backend in `frontend/packages/backend/`
- `ampx sandbox` deploys a per-dev cloud sandbox and generates `amplify_outputs.json`
- `ampx pipeline-deploy` runs on AWS Amplify Hosting (CI) for branch/production deploys
- Invoked through devenv scripts (`sandbox`, `sandbox-once`, `sandbox-delete`), not directly

## Directory Structure

```
/
├── frontend/
│   ├── package.json          # Frontend workspace definition (Bun)
│   ├── node_modules/         # Frontend modules
│   ├── apps/
│   │   ├── web/              # Next.js
│   │   └── mobile/           # Expo
│   └── packages/
│       ├── backend/          # Amplify backend (@workspace/backend, ampx)
│       ├── data-client/      # @workspace/data-client (getDataClient)
│       └── auth/             # @workspace/auth
└── backend-py/
    ├── pyproject.toml        # uv workspace root
    ├── uv.lock               # single root lockfile
    ├── apps/                 # FastAPI (api), mcp
    └── packages/             # core (logger / exceptions / auth utils)
```

This structure allows each component to use optimal tools independently and prevents dependency conflicts.
