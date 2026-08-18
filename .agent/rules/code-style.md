# Code Style and Quality

## Frontend

- **Linting & Formatting**: Biome (fast all-in-one toolchain)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: TailwindCSS 4 with CSS variables
- **Code Style**: 2-space indentation, 100-character line width, single quotes, semicolons as needed
- **TypeScript**: Strict mode enabled
- **Import Organization**: Auto-organize imports with type-only import enforcement

## Backend Python

- **Package Manager**: uv (Rust-based, ultra-fast Python package manager)
- **Linting**: Ruff (Rust-based fast linter)
  - Comprehensive ruleset (configured in pyproject.toml)
  - Line length: 88 characters
  - Auto-fix capability
- **Type Checking**: MyPy (strict mode)
  - Type annotations required for all functions
  - Strict type checking
- **Code Style**:
  - Google-style docstrings
  - Async/await for all I/O operations
  - Clean architecture dependency rules enforced
  - Maximum function complexity: 3 (McCabe)
- **Commands** (devenv scripts on PATH。Makefile は削除済み):
  - `lint-backend-py` - Ruff lint (auto-fix)
  - `format-backend-py` - Ruff format (auto-fix)
  - `type-check-backend-py` - MyPy type checking

## Amplify Functions (TypeScript — the default for backend logic)

- Node `defineFunction` under `frontend/packages/backend/amplify/functions/<name>/`
- REST with **Hono** (`hono/aws-lambda`); MCP with `@hono/mcp` + `@modelcontextprotocol/sdk`
- Cross-function logic lives in `@workspace/backend-core` (`frontend/packages/backend-core`)
- TypeScript strict mode with proper type annotations
- Proper error handling with type guards (`error instanceof Error`)
- **Dependencies**: `pnpm add` only. npm / yarn / **bun are prohibited**
  (`ampx` rejects bun with `UnsupportedPackageManagerError`)
- Secrets via Amplify secrets (`secret('NAME')` / `ampx sandbox secret set`), never hardcoded
- Python (`backend-py`) is escalation-only — see `/.claude/rules/backend-architecture.md`
