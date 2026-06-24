# Environment Configuration

Environment files are organized by component in the `env/` directory:

```
env/
├── README.md                  # 構成・方針（canonical）
├── backend/.env.local         # Backend non-secret config (Supabase URL, etc.)
├── frontend/.env.local        # Frontend non-secret config (Next.js public vars)
├── migration/.env.local       # Database migration non-secret config (POSTGRES_URL)
└── .env.secrets               # Legacy secrets (.gitignore, NOT loaded; for doppler-import only)
```

## Environment File Roles

- **Secrets** (API keys, tokens, DB passwords): **Doppler only**. The `.env.secrets` file
  fallback has been removed. Requires `doppler login` + `doppler setup` (CI: `DOPPLER_TOKEN`).
- **`env/<service>/.env.<ENV>`**: non-secret config only (URLs, ports, publishable keys).
- **`env/backend/.env.local`**: Backend non-secret config (Supabase URL, etc.)
- **`env/frontend/.env.local`**: Frontend non-secret config (Next.js public variables)
- **`env/migration/.env.local`**: Database migration non-secret config (POSTGRES_URL for Drizzle)

## Environment Variable Management

Loading is `$ENV`-driven (default `local`): non-secret `env/<service>/.env.$ENV` files are sourced,
and secrets are injected from the matching Doppler config. See `env/README.md` and
`.claude/skills/doppler/SKILL.md`.
