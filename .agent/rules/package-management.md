# Package Management

**Important**: This project uses an **independent monorepo structure without a root package.json**.

## Package Manager Usage Patterns

Each component uses the optimal package manager for its purpose:

### Frontend (`frontend/`): Bun 1.2.8

- Fast JavaScript runtime & package manager
- Fully compatible with Node.js, npm alternative
- Monorepo management with Bun workspace
- Dependencies managed in `frontend/package.json`

### Backend Python (`backend-py/`): uv

- Rust-based ultra-fast Python package manager
- Reliable tool from Ruff (linter) developers
- Dependencies managed in `backend-py/app/pyproject.toml`

### Drizzle (`drizzle/`): Bun

- Uses Bun like the frontend
- Managed as an independent package
- `drizzle/package.json` + `drizzle/node_modules/`

### Edge Functions (`supabase/functions/`): Deno

- Built-in package manager in Deno runtime
- Import npm packages with `npm:` prefix
- Import map management in each function's `deno.json`

## Directory Structure

```
/
├── drizzle/
│   ├── package.json          # Drizzle-specific dependencies
│   └── node_modules/         # Drizzle-specific modules
├── frontend/
│   ├── package.json          # Frontend workspace definition
│   └── node_modules/         # Frontend modules
└── backend-py/
    └── app/
        ├── pyproject.toml    # Python dependencies (uv managed)
        └── .venv/            # Python virtual environment
```

This structure allows each component to use optimal tools independently and prevents dependency conflicts.
