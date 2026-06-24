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

## Edge Functions

- Native `Deno.serve` API for lightweight serverless functions
- TypeScript strict mode with proper type annotations
- Proper error handling with type guards (`error instanceof Error`)
- Deno formatting and linting standards
- **Import Management**:
  - Use `npm:` prefix by default (e.g., `npm:@supabase/supabase-js@^2`)
  - Do not use JSR (`jsr:`) unless there's a specific reason
  - Manage dependencies in `deno.json` `imports` field
  - Do not use HTTP imports (`https://deno.land/x/...`)
