# Supabase Edge Functions

Deno-based serverless functions with native `Deno.serve` API and Drizzle schema
integration for type safety.

## Overview

Supabase Edge Functions provide serverless compute for backend logic, running on
Deno runtime with TypeScript support. This project integrates Drizzle ORM
schemas for complete type safety across the stack.

### Tech Stack

- **Runtime**: Deno 2.5.6
- **API**: Native `Deno.serve` (no frameworks)
- **Type Safety**: Drizzle schema integration + Supabase types
- **Authentication**: Supabase Auth client
- **Database**: Supabase PostgreSQL client

## Project Structure

```
supabase/functions/
├── helloworld/               # Example Edge Function
│   ├── index.ts              # Function implementation
│   ├── deno.json             # Function-specific dependencies
│   └── deno.lock             # Deno lockfile
├── shared/                   # Shared code across functions
│   ├── db/                   # Database connection utilities
│   │   ├── index.ts          # Export entry point
│   │   ├── url.ts            # DB URL workaround for Deno bug
│   │   └── client.ts         # Drizzle client initialization
│   ├── types/
│   │   └── supabase/
│   │       └── schema.ts     # Supabase generated types (693 lines)
│   └── drizzle/
│       ├── index.ts          # Export entry point
│       ├── schema.ts         # Drizzle table definitions (492 lines)
│       └── types.ts          # Enum definitions
├── .cursorrules              # Development guidelines
└── .vscode/
    └── settings.json         # VS Code Deno configuration
```

## Key Features

### 1. Native Deno.serve API

Edge Functions use Deno's built-in `Deno.serve` for lightweight, efficient
serverless functions.

**Example**:

```typescript
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Your logic here
    return new Response(
      JSON.stringify({ message: "Success" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
```

### 2. Drizzle Schema Integration

Edge Functions can import and use Drizzle schemas directly for type-safe
database operations.

**Type Inference**:

```typescript
import type { InferInsertModel, InferSelectModel } from "npm:drizzle-orm";
import {
  orders,
  subscriptions,
  userProfiles,
  users,
} from "../shared/drizzle/index.ts";

// Infer types from Drizzle schemas
type User = InferSelectModel<typeof users>;
type NewUser = InferInsertModel<typeof users>;
type UserProfile = InferSelectModel<typeof userProfiles>;
type Subscription = InferSelectModel<typeof subscriptions>;
type Order = InferSelectModel<typeof orders>;
```

**Usage with Supabase Client**:

```typescript
import { createClient } from "npm:@supabase/supabase-js@^2";
import type { InferSelectModel } from "npm:drizzle-orm";
import { users } from "../shared/drizzle/index.ts";

type User = InferSelectModel<typeof users>;

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  // Query with Supabase client
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .limit(1)
    .single();

  // Type-safe casting with Drizzle type
  const user: User | undefined = data as User | undefined;

  return new Response(
    JSON.stringify({
      message: `Hello ${user?.displayName ?? "World"}!`,
      user: user
        ? {
          id: user.id,
          displayName: user.displayName,
          accountName: user.accountName,
        }
        : null,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
```

### 3. Drizzle ORM Direct Database Connection (Transaction Support)

For operations requiring transactions, use the Drizzle ORM with direct database
connection instead of the Supabase REST API.

**Setup**:

```typescript
import { createDrizzleClient } from "../shared/db/index.ts";
import { users } from "../shared/drizzle/index.ts";

Deno.serve(async (req: Request) => {
  const db = createDrizzleClient();

  // Simple query
  const allUsers = await db.select().from(users);

  // Transaction example
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: "user-123",
      displayName: "Alice",
      accountName: "alice_001",
      // ...
    });
    // Additional operations within the same transaction
  });

  return new Response(JSON.stringify({ users: allUsers }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Note**: This uses `postgres.js` driver with `prepare: false` option for
Supabase's Transaction pool mode compatibility.

**Local Development Workaround**: The `getDbUrl()` function automatically
handles Deno's DNS resolution bug with underscore-containing hostnames
([#23157](https://github.com/denoland/deno/issues/23157)) by replacing
`supabase_db_*` with `host.docker.internal:54322`.

### 4. npm Package Imports

Edge Functions use `npm:` prefix to import npm packages (JSR and HTTP imports
are discouraged).

**deno.json Configuration**:

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2",
    "drizzle-orm": "npm:drizzle-orm@^0.45.2"
  }
}
```

**Forbidden**:

- ❌ JSR imports (`jsr:@package/name`)
- ❌ HTTP imports (`https://deno.land/x/...`)
- ❌ Old frameworks (Oak, etc.)

## Creating a New Function

### Step 1: Create Function Directory

```bash
cd supabase/functions
mkdir my-function
cd my-function
```

### Step 2: Create index.ts

```typescript
// supabase/functions/my-function/index.ts
import { createClient } from "npm:@supabase/supabase-js@^2";
import type { InferSelectModel } from "npm:drizzle-orm";
import { users } from "../shared/drizzle/index.ts";

type User = InferSelectModel<typeof users>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Your business logic here
    const result = { message: "Success", userId: user.id };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
```

### Step 3: Create deno.json

```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2",
    "drizzle-orm": "npm:drizzle-orm@^0.45.2"
  }
}
```

### Step 4: Test Locally

> **NOTE**: 以下の `supabase functions serve` は **local 動作確認 / デバッグ用**
> の Supabase CLI 直叩きです。本リポジトリでの**デプロイの正規経路は
> `devenv tasks run -P <profile> deploy:functions`** で、CLI
> を直接呼んではいけません（`/.claude/rules/commands.md`）。

```bash
# Serve function locally (local debug only)
supabase functions serve my-function

# In another terminal, test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/my-function' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

### Step 5: Deploy

> **正規経路**: 以下は背景理解のための CLI 例。**実際のデプロイは必ず devenv
> tasks 経由で行うこと**（`scripts/supabase/deploy.sh` が config push / buckets
> / functions / secrets を順序実行する）:
>
> ```bash
> devenv tasks run -P staging    deploy:functions   # ステージング
> devenv tasks run -P production deploy:functions   # 本番
> ```

```bash
# (Reference only — equivalent CLI calls executed by the devenv task)
supabase functions deploy my-function

# Or deploy all functions
supabase functions deploy
```

## Development Guidelines

### CORS Handling

Always handle CORS preflight requests:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ... rest of your code
});
```

### Error Handling

Always use type guards for error handling:

```typescript
try {
  // Your code
} catch (error) {
  // ✅ Good: Type guard
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return new Response(
    JSON.stringify({ error: errorMessage }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
```

**Forbidden**:

```typescript
// ❌ Bad: No type guard
catch (error) {
  return new Response(JSON.stringify({ error: error.message }), { status: 500 });
}
```

### Authentication

Use Supabase Auth client for authentication:

```typescript
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
);

const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  throw new Error("Unauthorized");
}
```

### Type Safety with Drizzle

Leverage Drizzle schemas for complete type safety:

```typescript
import type { InferInsertModel, InferSelectModel } from "npm:drizzle-orm";
import { orders, subscriptions } from "../shared/drizzle/index.ts";

type Order = InferSelectModel<typeof orders>;
type NewOrder = InferInsertModel<typeof orders>;

// Use types with Supabase operations
const { data } = await supabase
  .from("orders")
  .select("*")
  .eq("user_id", userId);

const typedOrders: Order[] = data as Order[];
```

## Shared Code

### Drizzle Schemas

Located in `shared/drizzle/`, automatically copied from `drizzle/schema/` during
type generation:

```bash
# Generate types and copy Drizzle schemas
devenv tasks run model:functions
```

**Generated Files**:

- `shared/drizzle/index.ts` - Export entry point
- `shared/drizzle/schema.ts` - All table definitions
- `shared/drizzle/types.ts` - Enum definitions

**Available Tables** (boilerplate baseline):

- users, userProfiles
- subscriptions, orders (Polar.sh)

> プロジェクト固有のドメインテーブルを追加した場合は drizzle/schema/ を編集 →
> `devenv tasks run model:functions` でコピー先も更新される。

### Supabase Types

Located in `shared/types/supabase/schema.ts`, generated by Supabase CLI:

```bash
# Generate Supabase types
supabase gen types typescript --local > functions/shared/types/supabase/schema.ts
```

**Usage**:

```typescript
import type { Database } from "../shared/types/supabase/schema.ts";

type Tables = Database["public"]["Tables"];
type User = Tables["users"]["Row"];
```

## Environment Variables

Edge Functions access environment variables via `Deno.env.get()`.

### Required Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:postgres@db.xxx.supabase.co:5432/postgres
```

**Note**: `SUPABASE_DB_URL` is required for Drizzle ORM direct database
connection. Use "Transaction pooler" connection string from Supabase Dashboard.

### Setting Environment Variables

```bash
# Local development (.env.local)
echo "MY_SECRET=value" >> supabase/.env.local

# Production (Supabase Dashboard)
# Go to Project Settings > Edge Functions > Add secret
```

## Testing

### Local Testing

```bash
# Start Supabase local environment
supabase start

# Serve function locally
supabase functions serve my-function --no-verify-jwt

# Test with curl
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/my-function' \
  --header 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"test": "data"}'
```

### Unit Testing (with Deno)

Create `my-function/index.test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("should return success message", async () => {
  const req = new Request("http://localhost/", {
    method: "POST",
    body: JSON.stringify({ test: "data" }),
  });

  // Your test logic here
  assertEquals(1 + 1, 2);
});
```

Run tests:

```bash
deno test --allow-env --allow-net
```

## Deployment

> **正規経路**: 本リポジトリでは **必ず devenv tasks
> 経由でデプロイする**。`scripts/supabase/deploy.sh` が link / config push /
> buckets / functions / secrets の順序を保証する。Supabase CLI 直叩き
> (`supabase functions deploy`) は禁止 (`/.claude/rules/commands.md`)。
>
> ```bash
> devenv tasks run -P staging    deploy:functions   # 単発 functions のみデプロイ (staging)
> devenv tasks run -P production deploy:functions   # 単発 functions のみデプロイ (production)
> devenv tasks run -P production deploy:supabase    # config + buckets + functions + secrets フルデプロイ
> ```
>
> 以下の `supabase functions deploy` 例は背景理解のための **reference only**。

### Deploy Single Function (reference)

```bash
# Equivalent CLI call wrapped by `deploy:functions` task
supabase functions deploy my-function
```

### Deploy All Functions (reference)

```bash
supabase functions deploy
```

### Deploy with Environment Variables (reference)

```bash
# Set secrets before deploying
supabase secrets set MY_SECRET=value

# Then deploy
supabase functions deploy my-function
```

## Monitoring and Logs

### View Logs (Local)

```bash
# Watch function logs
supabase functions serve my-function --debug
```

### View Logs (Production)

```bash
# Fetch recent logs
supabase functions logs my-function

# Follow logs in real-time
supabase functions logs my-function --follow
```

## Best Practices

### Code Organization

1. **Keep functions small** - Single responsibility per function
2. **Use shared code** - Place reusable code in `shared/`
3. **Type safety** - Always use Drizzle types
4. **Error handling** - Use type guards for errors

### Performance

1. **Cold starts** - Keep dependencies minimal
2. **Database connections** - Use Supabase client connection pooling
3. **Async operations** - Use `await` for all I/O
4. **Caching** - Cache expensive operations when appropriate

### Security

1. **Authentication** - Always verify user with `getUser()`
2. **Authorization** - Check user permissions before operations
3. **Input validation** - Validate all request data
4. **Secrets** - Use environment variables for sensitive data

### Type Safety

1. **Drizzle types** - Import from `shared/drizzle/`
2. **Type inference** - Use `InferSelectModel` and `InferInsertModel`
3. **Type guards** - Use `instanceof Error` for error handling
4. **Strict mode** - Enable TypeScript strict mode

## Troubleshooting

### Function Not Found

```bash
# Ensure function is deployed
supabase functions list

# Redeploy if needed
supabase functions deploy my-function
```

### Import Errors

```bash
# Check deno.json imports
cat supabase/functions/my-function/deno.json

# Ensure using npm: prefix
# ✅ "npm:@supabase/supabase-js@^2"
# ❌ "jsr:@supabase/supabase-js"
```

### Type Errors with Drizzle

```bash
# Regenerate types and schemas
devenv tasks run model:functions

# Check shared/drizzle/ was updated
ls -la supabase/functions/shared/drizzle/
```

### Authentication Errors

```bash
# Check environment variables
supabase secrets list

# Verify JWT token is valid
# Use Supabase Dashboard > Authentication > Users to get valid token
```

## VS Code Configuration

`.vscode/settings.json`:

```json
{
  "deno.enable": true,
  "deno.lint": true,
  "deno.unstable": false,
  "deno.path": "/opt/homebrew/bin/deno"
}
```

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)

For project-specific guidelines, see `/CLAUDE.md` in the project root.
