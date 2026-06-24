# Supabase Configuration Management

**IMPORTANT**: Supabase service configurations and database schema management are handled separately.

## Configuration Responsibilities

### 1. Supabase Service Configuration (`supabase/config.toml`)

**Use for**: Infrastructure and service-level configurations

- **Authentication**: OAuth providers, JWT settings, email/SMS, MFA
  - `[auth]`, `[auth.email]`, `[auth.sms]`, `[auth.mfa]`
  - `[auth.external.apple]`, `[auth.external.google]`, etc.
- **Storage**: File size limits, buckets, image transformation
  - `[storage]`, `[storage.buckets.*]`
- **API**: Port, schemas exposed via API, max rows, TLS settings
  - `[api]`
- **Realtime Service**: Enable/disable service, port settings
  - `[realtime]` - Service configuration only
  - **Note**: Actual Realtime publications (which tables support realtime) are managed in Drizzle
- **Studio**: Supabase Studio settings
  - `[studio]`
- **Edge Runtime**: Deno version, policies
  - `[edge_runtime]`
- **Analytics**: Backend configuration
  - `[analytics]`

**Configuration Example**:
```toml
# Enable OAuth provider
[auth.external.google]
enabled = true
client_id = "your-client-id"
secret = "env(GOOGLE_OAUTH_SECRET)"
redirect_uri = "http://127.0.0.1:3000/auth/callback"

# Configure storage limits
[storage]
enabled = true
file_size_limit = "50MiB"

# Add storage bucket
[storage.buckets.avatars]
public = true
file_size_limit = "5MiB"
allowed_mime_types = ["image/png", "image/jpeg"]
```

**When to Edit**: When you need to:
- Add OAuth providers (Google, GitHub, etc.)
- Change JWT expiry time
- Configure email/SMS providers
- Adjust storage limits or add buckets
- Modify API settings (ports, schemas exposed)
- Enable/disable Supabase services

---

## Storage Policy (MANDATORY)

### Default: Private Buckets

**ALWAYS use Private buckets** unless the user explicitly requests Public buckets.

```toml
# supabase/config.toml
[storage.buckets.documents]
public = false  # DEFAULT: Private
file_size_limit = "50MiB"
```

### File Access via createSignedUrl

Private buckets require signed URLs for file access:

```typescript
// ✅ Correct: Use createSignedUrl for private files
const { data } = await supabase.storage
  .from('documents')
  .createSignedUrl('path/to/file.pdf', 60)  // 60秒有効

// ❌ Wrong: getPublicUrl on private bucket (won't work)
const { data } = supabase.storage
  .from('documents')
  .getPublicUrl('path/to/file.pdf')
```

### Path Prefix Convention (RESTful)

Use RESTful hierarchical path structure:

```
{resource}/{id}/{sub-resource}/{filename}
```

Examples:
- `users/{user_id}/avatar.png`
- `users/{user_id}/documents/{doc_id}.pdf`
- `projects/{project_id}/assets/logo.png`

```typescript
// ✅ Correct: RESTful path structure
const path = `users/${userId}/avatar.png`
await supabase.storage.from('files').upload(path, file)

// ✅ Correct: Nested resource
const path = `projects/${projectId}/attachments/${fileId}.pdf`
await supabase.storage.from('files').upload(path, file)

// ❌ Wrong: No resource hierarchy
const path = `avatar.png`
```

### When to Use Public Buckets

Public buckets are allowed **ONLY** when:
1. User explicitly requests it
2. Files are truly public (marketing assets, public blog images)
3. High-performance CDN caching is required

### Prohibited Patterns

**NEVER**:
- Use public buckets for user-uploaded content without explicit approval
- Store sensitive files without RLS policies
- Use `getPublicUrl` for private buckets

---

### 2. Database Schema Management (`drizzle/`)

**Use for**: Database structure and data access rules

- **Tables**: Schema definitions with TypeScript
- **RLS Policies**: Row-level security policies
- **Realtime Publications**: Enable realtime updates for specific tables
- **Functions**: PostgreSQL functions and triggers
- **Extensions**: pgvector, custom extensions
- **Enums**: Database enum types
- **Check Constraints**: Data validation rules

**When to Edit**: When you need to:
- Add/modify database tables
- Change RLS policies
- Enable/configure realtime updates for tables
- Add database functions or triggers
- Modify table relationships

**→ See [Drizzle Schema Management](#drizzle-schema-management) below for details**

---

## Drizzle Schema Management

**IMPORTANT**: This project uses **Drizzle ORM** for database schema management.

### Schema Structure

Schemas are defined in TypeScript in the `drizzle/` directory:

```
drizzle/
├── drizzle.config.ts         # Drizzle Kit configuration file
├── migrate.ts                # Custom SQL execution script (programmatic execution)
├── schema/
│   ├── schema.ts             # Main schema (tables, RLS, check constraints centrally managed)
│   ├── types.ts              # Enum definitions
│   └── index.ts              # Public API (schema exports)
├── config/
│   ├── pre-migration/        # SQL run BEFORE generate/migrate (extensions)
│   └── post-migration/       # SQL run AFTER migrate (functions, triggers, realtime)
└── migrations/               # drizzle-kit output (v3 folder format, git-tracked)
```

**Important**: The `drizzle/` directory is managed as an independent package with its own `package.json` and dependencies. The project root is kept clean.

**Monorepo Structure**:

```
/
├── package.json              # Workspace definition (includes drizzle, frontend)
├── drizzle/
│   ├── package.json          # Drizzle-specific dependencies and scripts
│   ├── node_modules/         # Drizzle-specific dependencies
│   ├── drizzle.config.ts
│   └── ...
└── frontend/
    ├── package.json          # Frontend-specific dependencies and scripts
    └── ...
```

**Important**: Drizzle Kit uses only one database:

- **url database** (localhost:54322): Supabase Local DB
  - Auto-generates migration SQL from schema definitions
  - Applies generated migrations
  - Development data is stored here

### Schema Change Workflow

**Local Development**:

```bash
# 1. Edit schema
vi drizzle/schema/schema.ts

# 2. Generate + apply migration + type generation
devenv tasks run app:migrate-dev

# 3. Review generated migration file
ls drizzle/migrations/
cat drizzle/migrations/<ts>_<name>/migration.sql

# Execute directly in drizzle/ directory
cd drizzle
bun run generate     # Generate migration
bun run migrate      # Apply migration
bun run check        # Validate schema
bun run studio       # Launch Drizzle Studio
bun run migrate:pre  # Run pre-migration SQL (extensions)
bun run migrate:post # Run post-migration SQL (functions/triggers)

# 4. Commit to Git
git add drizzle/migrations/
git commit -m "Add new feature schema"
git push
```

**Remote Environment (CI/CD or Manual)**:

```bash
# 1. Fetch migration files
git pull

# 2. Apply migration
devenv tasks run -P staging db:migrate-deploy
# or production environment
devenv tasks run -P production db:migrate-deploy
```

### RLS (Row Level Security) Declarative Management

**Important**: RLS is fully managed with Drizzle ORM's `pgPolicy` function and placed in **the same file** as table definitions (`schema.ts`).

**Managing Table Definitions and RLS Policies Together**:

```typescript
import { pgTable, uuid, text, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Table definition
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  accountName: text("account_name").notNull().unique(),
  // ... other columns ...
}).enableRLS(); // Enable RLS

// Define RLS policies for this table immediately after
export const selectOwnUser = pgPolicy("select_own_user", {
  for: "select",
  to: ["anon", "authenticated"],
  using: sql`true`,
}).link(users);

export const editPolicyUsers = pgPolicy("edit_policy_users", {
  for: "all",
  to: "authenticated",
  using: sql`(SELECT auth.uid()) = id`,
  withCheck: sql`(SELECT auth.uid()) = id`,
}).link(users);
```

**Policy Parameters**:

- **for**: Operation type (`'select'`, `'insert'`, `'update'`, `'delete'`, `'all'`)
- **to**: Target role(s) (array or string)
- **using**: Condition for viewable/editable rows (`sql` tagged template)
- **withCheck**: Validation condition for inserts/updates (`sql` tagged template)

**Benefits**:

- TypeScript type safety
- Table and its RLS policies visible in the same file
- Lower cognitive load (no need to navigate between files)
- Edit tables and policies together when making changes

### Migration Management

- Drizzle Kit automatically generates migration SQL
- Migration history stored in `drizzle/migrations/` (v3 folder format; Supabase migrations are not used)
- Rollback by manually deleting migration files and re-applying

**Custom SQL (Functions, Triggers, Extensions) Management**:

Custom SQL is split into two phases run by `drizzle/migrate.ts`:
- `drizzle/config/pre-migration/*.sql` — extensions that must exist before any DDL (e.g. `CREATE EXTENSION vector`)
- `drizzle/config/post-migration/*.sql` — functions / triggers / realtime publications that depend on tables generated by `drizzle-kit migrate`

`migrate.ts` reads each `*.sql` file in the target phase directory in alphabetical order and executes them via `drizzle-orm/postgres-js`. If any file fails, the script exits with code 1 (no silent fallbacks).

**Execution Timing**:

- `devenv tasks run db:migrate-dev` (local): `migrate:pre → generate → migrate → migrate:post`
- `devenv tasks run app:migrate-dev` (local + types): adds type regeneration after `migrate:post`
- `devenv tasks run -P <profile> db:migrate-deploy` (remote): `migrate:pre → migrate → migrate:post`

**Benefits**:

- No dependency on CLI tools (`psql`)
- Type-safe execution with TypeScript
- Strict error propagation (no silent failures)
- Simple environment variable management (`POSTGRES_URL` only)

### Realtime Publications Management

Supabase Realtime publications (which tables support realtime updates) are managed in `drizzle/config/post-migration/`:

```sql
-- Enable realtime for specific tables (例: 実プロジェクトで Realtime を必要とするテーブル名)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;

-- Remove table from realtime (if needed)
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.table_name;
```

**Note**: The `[realtime]` section in `supabase/config.toml` is only for enabling the Realtime service and port settings. Which tables support realtime updates is managed in Drizzle.

For more details, refer to the official Drizzle documentation.

**→ For detailed Drizzle ORM documentation, see [`drizzle/README.md`](../../drizzle/README.md)**
