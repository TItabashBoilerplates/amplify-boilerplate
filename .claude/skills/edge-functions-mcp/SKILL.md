---
name: edge-functions-mcp
description: Supabase Edge Functions 上に MCP（Model Context Protocol）サーバを構築するためのスキル。公式の "BYO MCP"（https://supabase.com/docs/guides/ai-tools/byo-mcp）と `supabase/supabase` リポジトリの `examples/edge-functions/.../mcp/simple-mcp-server` 実装に準拠。`@modelcontextprotocol/sdk` + `@hono/mcp` の `StreamableHTTPTransport` + Hono + zod を使う標準パターン、本プロジェクトの Edge Functions 規約（`shared/`、`npm:` prefix、`deploy:functions` task、`config.toml` の `verify_jwt` 制御）、CORS / ロガー / Drizzle 連携、MCP Inspector でのデバッグ、ホスティングに伴う注意点をまとめる。
---

# Edge Functions MCP Server スキル

**前提**: 本プロジェクトで MCP サーバを Edge Functions で実装する場合は、必ずこのスキルの構成・依存パッケージ・ファイル配置に従う。Supabase 公式ガイド「BYO MCP」（https://supabase.com/docs/guides/ai-tools/byo-mcp）と公式リファレンス実装（`supabase/supabase` リポジトリの `examples/edge-functions/supabase/functions/mcp/simple-mcp-server`）に準拠する。

---

## いつ使うか

- ユーザーから「MCP サーバを Edge Functions に立てたい」「ツール / リソースを LLM に公開したい」「Claude / Cursor / Codex から呼ばれる MCP エンドポイントを Supabase 上に作りたい」と依頼された
- 既存 Edge Function に MCP プロトコル（`tools/call` / `resources/list` 等の JSON-RPC over Streamable HTTP）を追加する
- BYO MCP 経由で Anthropic / Claude / Cursor などの MCP クライアントから呼べる公開エンドポイントを Supabase に置きたい

**Python の MCP サーバを書く場合は対象外** → `backend-py/apps/mcp/` 配下に書く。`.claude/skills/python-monorepo/` を参照すること。

関連スキル:
- `supabase` — Edge Functions 全般・認証・SSR
- `supabase-config` — `supabase/config.toml`（`[functions.<name>].verify_jwt` 等）
- `debugging` — devenv 経由のローカルログ確認
- `logger` — `shared/logger/` の structured logger 連携

---

## Top 原則（これだけは必ず守る）

| # | 原則 | 理由 |
|---|------|------|
| 1 | **transport は `@hono/mcp` の `StreamableHTTPTransport` を使う** | 公式 `simple-mcp-server` 例の標準パターン。Hono との統合が最も短く、Edge Runtime と相性がよい |
| 2 | **MCP SDK / `@hono/mcp` / `hono` / `zod` は `npm:` prefix で固定バージョンを指定** | `.claude/rules/edge-functions.md` の規約（npm: prefix 必須）に沿う。バージョン固定で Deno のキャッシュを安定させる |
| 3 | **関数名が `mcp` 以外なら `new Hono().basePath('/<function-name>')`** | Supabase Edge Functions は `/<function-name>/...` でルーティングされる。basePath を合わせないと 404 する |
| 4 | **Tool / Resource / Prompt の入力スキーマは zod で定義し、ハンドラ内で再 validate しない** | MCP SDK 側で zod スキーマを使って自動 validate する。手動 validate は冗長 |
| 5 | **`config.toml` の `[functions.<name>].verify_jwt = false` を必ず明示** | MCP クライアントは Bearer トークン以外で叩く（または独自認証）。Supabase の自動 JWT 検証を切らないと 401 で全リクエストが落ちる。**ただし無認証で本番公開はしない**（後述） |
| 6 | **デプロイは `devenv tasks run -P <env> deploy:functions`、`supabase functions deploy` を直叩きしない** | `.claude/rules/commands.md` 準拠 |
| 7 | **session 管理が必要なら `StreamableHTTPTransport` の sessionId 戦略を理解した上で実装** | Edge Functions は短命プロセスなので **stateless モードが既定**。stateful にする場合は外部ストア（KV / Postgres）が必要 |
| 8 | **本番運用では認証層を必ず入れる**（Supabase Auth JWT 検証 / ヘッダー shared secret / Cloudflare Access 等） | 公式ガイドの「auth coming soon」は MCP プロトコルレベルの auth の話。Edge Function 自体には自前で認証を被せる |

---

## ディレクトリ構成

本プロジェクトでは Edge Function 配下に MCP サーバを 1 関数 = 1 MCP サーバとして配置する:

```
supabase/functions/
├── mcp/                          # ← 関数名（= MCP サーバ名）
│   ├── index.ts                  # MCP サーバ実装（Hono + StreamableHTTPTransport）
│   ├── deno.json                 # この関数固有の依存（npm: prefix で固定）
│   ├── deno.lock                 # Deno lockfile（コミット対象）
│   └── tools/                    # ツール実装を分離する場合
│       ├── add.ts
│       └── search.ts
└── shared/                       # 既存の共通コード
    ├── db/                       # postgres.js + Drizzle
    ├── drizzle/                  # Drizzle スキーマ
    ├── logger/                   # createFunctionLogger
    └── types/supabase/
```

> **関数名のルール**: MCP クライアントから見たエンドポイントは `https://<project-ref>.supabase.co/functions/v1/<function-name>` になる。複数の MCP サーバを並走させる場合は `mcp-billing`, `mcp-search` のように関数名で区別する。

---

## deno.json（テンプレート）

公式 `simple-mcp-server` の `deno.json` をベースに、最新版＋本プロジェクトの規約に沿って固定する:

```json
{
  "imports": {
    "@modelcontextprotocol/sdk": "npm:@modelcontextprotocol/sdk@^1.29.0",
    "@hono/mcp": "npm:@hono/mcp@^0.3.0",
    "hono": "npm:hono@^4.9.7",
    "zod": "npm:zod@^4.1.13"
  }
}
```

> バージョンは**スキル更新時点の最新**（`@modelcontextprotocol/sdk@1.29.0` / `@hono/mcp@0.3.0`）。実装時は必ず npm registry で最新版を確認してから固定すること（`.claude/rules/research.md` 準拠）:
>
> ```bash
> curl -s https://registry.npmjs.org/@modelcontextprotocol/sdk/latest | jq .version
> curl -s https://registry.npmjs.org/@hono/mcp/latest | jq .version
> ```

`shared/db` 等を使う場合は `../shared/deno.json` の imports を継承させるため、サブ関数の `deno.json` に必要なものだけ追加する。

---

## index.ts（テンプレート: 最小実装）

公式 `simple-mcp-server/index.ts` をベースに、本プロジェクトのロガー / CORS / `basePath` を組み込んだ最小実装:

```typescript
// supabase/functions/mcp/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { z } from "zod";

import { createFunctionLogger } from "../shared/logger/index.ts";

const logger = createFunctionLogger("mcp");

// 関数名が "mcp" 以外なら basePath を変更
const app = new Hono().basePath("/mcp");

// MCP サーバ本体
const server = new McpServer({
  name: "mcp",
  version: "0.1.0",
});

// --- Tool 登録例 ---
server.registerTool(
  "add",
  {
    title: "Addition Tool",
    description: "Add two numbers together",
    inputSchema: { a: z.number(), b: z.number() },
  },
  ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }],
  }),
);

// --- MCP 経由のすべてのリクエストを Streamable HTTP transport にブリッジ ---
app.all("/", async (c) => {
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

// --- ヘルスチェック（任意・MCP プロトコル外）---
app.get("/health", (c) => c.json({ ok: true }));

Deno.serve(app.fetch);

logger.info("MCP server started", { name: "mcp", version: "0.1.0" });
```

### 重要なポイント

| ポイント | 説明 |
|---|---|
| `app.all("/", ...)` | `basePath("/mcp")` と合わせて `/<function-name>/` 全部に MCP transport をマウントする |
| `transport = new StreamableHTTPTransport()` を**ハンドラ内で毎回 new** | Edge Functions は stateless 想定。リクエストごとに transport を作る（公式実装と同じ） |
| `server.connect(transport)` も毎回呼ぶ | MCP SDK 側で transport を差し替えて handshake する設計のため |
| `Deno.serve(app.fetch)` | プロジェクトの既存 Edge Function と同様。Hono の fetch ハンドラを直接渡す |

---

## ツール / リソース / プロンプトの登録パターン

MCP SDK v1.29 の登録 API はすべて `McpServer` インスタンスメソッドで提供される。zod スキーマで input を宣言する:

### Tool（LLM が呼び出せる関数）

```typescript
server.registerTool(
  "list_recent_orders",
  {
    title: "List Recent Orders",
    description: "Get the most recent N orders for a user",
    inputSchema: {
      userId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(20),
    },
  },
  async ({ userId, limit }) => {
    const orders = await fetchOrders(userId, limit);  // 自前実装
    return {
      content: [
        { type: "text", text: JSON.stringify(orders, null, 2) },
      ],
    };
  },
);
```

### Resource（LLM が読み取れる URI ベースのリソース）

```typescript
server.registerResource(
  "user-profile",
  "supabase://users/{userId}",
  {
    title: "User Profile",
    description: "Read a user's profile by ID",
    mimeType: "application/json",
  },
  async (uri, { userId }) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(await fetchUserProfile(userId)),
      },
    ],
  }),
);
```

### Prompt（LLM が再利用できるテンプレートプロンプト）

```typescript
server.registerPrompt(
  "summarize-order",
  {
    title: "Summarize Order",
    description: "Generate a customer-facing summary of an order",
    argsSchema: { orderId: z.string().uuid() },
  },
  async ({ orderId }) => {
    const order = await fetchOrder(orderId);
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Summarize this order in 1 paragraph:\n${JSON.stringify(order)}`,
          },
        },
      ],
    };
  },
);
```

### エラーハンドリング

`.claude/rules/error-handling.md` 準拠。ハンドラ内で catch したら**必ずログ出力 + 再 throw** にする（MCP SDK が JSON-RPC error にラップする）:

```typescript
server.registerTool("risky-op", { /* schema */ }, async (args) => {
  try {
    return await doWork(args);
  } catch (error) {
    logger.error("risky-op failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    throw error;  // MCP SDK が JSON-RPC error にする
  }
});
```

**禁止**: `catch { return { content: [{ type: "text", text: "" }] } }` のような握りつぶし。

---

## supabase/config.toml の必須設定

MCP クライアントは Supabase が自動付与する JWT を持っていないため、**Edge Function 側の `verify_jwt = false` を明示**する:

```toml
# supabase/config.toml
[functions.mcp]
verify_jwt = false
# import_map / entrypoint は通常通り
```

**ただし** `verify_jwt = false` は「Supabase の自動 JWT 検証を切る」というだけで「無認証で誰でも叩ける」を意味する。本番では Edge Function 内で自前の認証層を必ず追加する（後述「認証・本番運用」）。

---

## ローカル開発

```bash
# 1) Supabase ローカル起動（プロジェクト規約に沿って devenv 経由）
supabase-start

# 2) Edge Functions を serve
#    - 一括: 全関数を一度に
supabase functions serve --no-verify-jwt
#    - 個別: mcp のみ
supabase functions serve --no-verify-jwt mcp
```

> `--no-verify-jwt` は **CLI フラグの方**で、すべての関数に対して Supabase の JWT 検証をスキップする。`config.toml` の `verify_jwt` と二重に効くので、ローカルではどちらでも OK。

エンドポイント: `http://127.0.0.1:54321/functions/v1/mcp`

### MCP Inspector でのインタラクティブテスト

```bash
npx -y @modelcontextprotocol/inspector
```

ブラウザで UI が開いたら:
1. Transport: `Streamable HTTP`
2. URL: `http://127.0.0.1:54321/functions/v1/mcp`
3. `Connect` → `tools/list` / `tools/call` を試す

### curl での直接テスト

MCP Streamable HTTP は `Accept: application/json, text/event-stream` ヘッダー必須:

```bash
curl -X POST 'http://127.0.0.1:54321/functions/v1/mcp' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": { "name": "add", "arguments": { "a": 5, "b": 3 } }
  }'
```

レスポンスは SSE フレーム:

```
event: message
data: {"result":{"content":[{"type":"text","text":"8"}]},"jsonrpc":"2.0","id":1}
```

---

## デプロイ（本プロジェクトのルール）

`.claude/rules/commands.md` 準拠。`supabase functions deploy` を Bash で直叩きしない:

```bash
# Staging
devenv tasks run -P staging deploy:functions
# Production
devenv tasks run -P production deploy:functions
```

`deploy:functions` task は内部で `supabase functions deploy --no-verify-jwt <name>` 相当のことを行う想定（`config.toml` の `verify_jwt` 設定が同期される）。タスク定義は `devenv.nix` を確認すること。

本番 URL: `https://<project-ref>.supabase.co/functions/v1/mcp`

---

## 認証・本番運用（重要）

公式ガイドは「auth coming soon」と書いてあるが、これは **MCP プロトコル仕様の OAuth フロー統合**の話。**Edge Function 自体に自前の認証層を入れることは可能であり、本番ではほぼ必須**。

### パターン A: Supabase Auth JWT を MCP クライアント側で持たせる

クライアントが `Authorization: Bearer <user_jwt>` を送る運用にして、Edge Function 側で検証:

```typescript
// config.toml: verify_jwt = false（自前で検証するため）

import { createClient } from "npm:@supabase/supabase-js@^2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
);

app.use("/*", async (c, next) => {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const { data, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !data.user) {
    logger.warn("auth failed", { err: error?.message });
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("userId", data.user.id);
  await next();
});
```

ツール内では `c.get("userId")` を使う。Hono のコンテキスト経由で MCP ハンドラには伝播しないため、**closure or module-level マップ**で `sessionId → userId` をブリッジする必要がある（後述 stateful 化を参照）。

### パターン B: shared secret（簡易）

専用クライアントだけが叩く場合:

```typescript
app.use("/*", async (c, next) => {
  const expected = Deno.env.get("MCP_SHARED_SECRET");
  if (!expected || c.req.header("x-mcp-secret") !== expected) {
    return c.json({ error: "forbidden" }, 403);
  }
  await next();
});
```

シークレットは `supabase secrets set MCP_SHARED_SECRET=...` で登録。`supabase-config` スキルの dotenvx 運用も参照。

### パターン C: 上流 reverse proxy（Cloudflare Access / IP allowlist 等）

Edge Function URL を Cloudflare Workers / Access の背後に置く。Edge Function は内部接続のみ受ける。最も堅牢だが構成は複雑。

**結論**: 公開 MCP エンドポイントを作る場合は **最低でも shared secret**、ユーザー単位の権限が要るなら **Supabase Auth JWT 検証** をかけること。`verify_jwt = false` だけで公開してはいけない。

---

## stateful セッションが必要な場合

`StreamableHTTPTransport` は同じ `mcp-session-id` ヘッダーを受け取ったときに session を維持する設計だが、**Edge Function は短命プロセス**で in-memory なセッションマップを共有できない。

stateful 化する場合の選択肢:

| 戦略 | 内容 | 適用場面 |
|---|---|---|
| **stateless モード**（既定） | リクエストごとに `new StreamableHTTPTransport()` | tool 呼び出しが自己完結する大多数のケース |
| **外部ストア + sessionId** | session state を Postgres / KV に永続化 | 長期チャットコンテキストを MCP server 側で保持したい場合 |
| **upstream で session を持つ** | クライアント側 / 別プロセスでチャット履歴を持ち、MCP は stateless にする | 多くの場合これで十分 |

**推奨**: まず stateless で作り、本当に必要になったら外部ストアを足す。最初から stateful にしない。

---

## CORS（フロントエンドから直接叩く場合）

ブラウザから MCP エンドポイントを叩く場合は CORS が必要。Hono の `cors` middleware で:

```typescript
import { cors } from "npm:hono@^4.9.7/cors";

app.use(
  "/*",
  cors({
    origin: ["https://app.example.com"],  // ワイルドカードは本番禁止
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "mcp-session-id",
      "mcp-protocol-version",
    ],
  }),
);
```

MCP 仕様の `mcp-session-id` / `mcp-protocol-version` ヘッダーを `allowHeaders` に含めること。

---

## ロギング

`shared/logger/` の `createFunctionLogger` を使う（`.claude/skills/logger/SKILL.md` 参照）:

```typescript
const logger = createFunctionLogger("mcp");

server.registerTool("op", { /* schema */ }, async (args) => {
  logger.info("tool invoked", { tool: "op", args });
  const result = await doWork(args);
  logger.info("tool succeeded", { tool: "op" });
  return result;
});
```

PII や生のシークレットをログに出さないこと（`.claude/rules/error-handling.md` 準拠）。

---

## Drizzle / Supabase クライアントとの連携

MCP ツール内で DB アクセスする場合の標準パターン:

```typescript
// supabase/functions/mcp/index.ts
import { db } from "../shared/db/index.ts";
import { orders } from "../shared/drizzle/index.ts";
import { eq, desc } from "npm:drizzle-orm";

server.registerTool(
  "list_recent_orders",
  {
    title: "List Recent Orders",
    description: "Get the most recent orders for a user",
    inputSchema: {
      userId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(20),
    },
  },
  async ({ userId, limit }) => {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
    };
  },
);
```

RLS を効かせたい場合は `supabase-js` 経由（ユーザー JWT を `Authorization` ヘッダーから伝搬）にする。RLS 不要なシステム操作のみ Drizzle + service role を使う。詳細は `rls` スキル / `supabase` スキルを参照。

---

## デバッグ手順

| 症状 | 確認 |
|---|---|
| 全リクエストが 401 | `config.toml` の `[functions.<name>].verify_jwt = false` を確認 / `supabase functions serve --no-verify-jwt` を確認 |
| 全リクエストが 404 | `basePath` と関数名が一致しているか確認（`/mcp` 関数なら `basePath("/mcp")`） |
| `tools/list` は通るが `tools/call` で 406 | `Accept: application/json, text/event-stream` ヘッダーが付いているか確認 |
| Inspector で繋がるが何も返ってこない | Edge Function のログを `devenv up` の TUI または `supabase functions logs mcp` で確認 |
| `Cannot find module @hono/mcp` | `deno.json` の `imports` に `@hono/mcp` が入っているか、`npm:` prefix が付いているか確認 |

ローカル Edge Function のログは **devenv 2.0 native process manager の TUI** で確認する（`.claude/skills/debugging/SKILL.md` 準拠）。

---

## チェックリスト（PR レビュー時）

- [ ] `deno.json` の `@modelcontextprotocol/sdk` / `@hono/mcp` / `hono` / `zod` のバージョンを npm registry の最新版に固定したか
- [ ] `index.ts` の `basePath` が関数名と一致しているか
- [ ] `app.all("/", ...)` で transport を毎回 `new` しているか（stateless モード）
- [ ] すべての Tool / Resource / Prompt に zod スキーマが定義されているか
- [ ] catch ブロックは `logger.error` + 再 throw になっているか（握りつぶし禁止）
- [ ] `config.toml` の `[functions.<name>].verify_jwt` が明示的に設定されているか
- [ ] 本番 / staging で何らかの認証層（JWT / shared secret / 上流 proxy）が入っているか
- [ ] PII / シークレットがログに出ていないか
- [ ] CORS が必要な場合、`mcp-session-id` / `mcp-protocol-version` が allowHeaders に入っているか
- [ ] デプロイは `devenv tasks run -P <env> deploy:functions` 経由か（直叩き禁止）

---

## 参考

- 公式ガイド: [Build Your Own MCP Server with Supabase Edge Functions](https://supabase.com/docs/guides/ai-tools/byo-mcp)
- 公式リファレンス実装: [`supabase/supabase` examples/edge-functions/.../mcp/simple-mcp-server](https://github.com/supabase/supabase/tree/master/examples/edge-functions/supabase/functions/mcp/simple-mcp-server)
- MCP TypeScript SDK: [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)
- Hono MCP middleware: [`@hono/mcp`](https://github.com/honojs/middleware/tree/main/packages/mcp)
- 関連ルール: `.claude/rules/edge-functions.md` / `.claude/rules/commands.md` / `.claude/rules/error-handling.md` / `.claude/rules/mcp-supabase.md`
- 関連スキル: `supabase` / `supabase-config` / `logger` / `debugging` / `python-monorepo`（Python MCP の場合）

---

## 強制事項

このスキルは Edge Functions 上の MCP サーバ実装の**正本**。違反する PR はレビューで却下する。判断に迷うケース（認証方式の選択、stateful 化の要否、関数の分割粒度等）は**勝手に決定せず、ユーザーに判断をあおぐこと**（`.claude/rules/feedback_ask_user_when_unsure.md` 準拠）。
