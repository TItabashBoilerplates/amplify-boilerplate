# Langfuse TypeScript/Deno SDK 調査レポート

## 調査情報

- **調査日**: 2026-01-20
- **調査者**: spec agent

---

## 1. Langfuse JavaScript/TypeScript SDK の使用方法

### SDK v4 (現行版) - OpenTelemetry ベース

Langfuse TypeScript SDK v4 は 2025年8月にリリースされ、OpenTelemetry をベースに完全に書き直されました。

#### インストール

```bash
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

#### パッケージ構成

| パッケージ | 用途 | 対応環境 |
|-----------|------|----------|
| `@langfuse/client` | API クライアント（プロンプト管理、スコア等） | Universal JS |
| `@langfuse/tracing` | トレーシング機能 | **Node.js 20+** |
| `@langfuse/otel` | OpenTelemetry エクスポート | **Node.js 20+** |
| `@langfuse/openai` | OpenAI SDK ラッパー | Universal JS |
| `@langfuse/langchain` | LangChain インテグレーション | Universal JS |

#### 基本セットアップ (Node.js)

```typescript
// instrumentation.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

export const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();
```

```typescript
// index.ts
import { sdk } from "./instrumentation";
import { startActiveObservation } from "@langfuse/tracing";

async function main() {
  await startActiveObservation("my-trace", async (span) => {
    span.update({
      input: "Hello, Langfuse!",
      output: "This is my first trace!",
    });
  });
}

main().finally(() => sdk.shutdown());
```

### SDK v3 (レガシー)

v3 SDK は OpenTelemetry なしで使用可能でしたが、v4 への移行が推奨されています。

```typescript
// v3 レガシー（非推奨）
import Langfuse from "langfuse";

const langfuse = new Langfuse();
const trace = langfuse.trace({
  name: "my-trace",
  userId: "user_123",
});
```

---

## 2. Deno での利用可能性

### 結論: 制限あり

| 機能 | Deno 対応 | 備考 |
|------|----------|------|
| `@langfuse/tracing` | **非対応** | Node.js 20+ 必須（OpenTelemetry SDK 依存） |
| `@langfuse/otel` | **非対応** | Node.js 20+ 必須（OpenTelemetry SDK 依存） |
| `@langfuse/client` | 一部対応 | Universal JS だが、Deno での動作は未保証 |
| `@langfuse/openai` | 一部対応 | Universal JS だが、依存関係の問題あり |
| HTTP API 直接呼び出し | **対応** | Fetch API で直接 Ingestion API を使用可能 |

### Deno/Supabase Edge Functions での課題

GitHub Discussion #6150 によると:

1. **OpenTelemetry の問題**: Deno には独自の OpenTelemetry 実装があり、Langfuse の `LangfuseSpanProcessor` との互換性がない
2. **Vercel AI SDK + Langfuse**: Supabase Edge Functions 上での統合は技術的に困難
3. **推奨回避策**: OpenTelemetry 依存のパッケージを避け、HTTP API を直接使用

---

## 3. OpenAI API 呼び出しのトレーシング方法

### 方法 A: observeOpenAI ラッパー (Node.js のみ)

```typescript
import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// OpenTelemetry セットアップ
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});
sdk.start();

// OpenAI クライアントをラップ
const openai = observeOpenAI(new OpenAI(), {
  traceName: "my-openai-trace",
  sessionId: "session-123",
  userId: "user-abc",
  tags: ["openai-integration"],
});

// 通常通り使用 - 自動的にトレースされる
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Tell me a joke." }],
});
```

### 方法 B: HTTP API 直接呼び出し (Deno 対応)

```typescript
// Deno/Edge Functions で使用可能
const LANGFUSE_PUBLIC_KEY = Deno.env.get("LANGFUSE_PUBLIC_KEY")!;
const LANGFUSE_SECRET_KEY = Deno.env.get("LANGFUSE_SECRET_KEY")!;
const LANGFUSE_BASE_URL = Deno.env.get("LANGFUSE_BASE_URL") || "https://cloud.langfuse.com";

async function sendToLangfuse(batch: object[]) {
  const credentials = btoa(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`);

  const response = await fetch(`${LANGFUSE_BASE_URL}/api/public/ingestion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
    body: JSON.stringify({ batch }),
  });

  return response;
}

// OpenAI 呼び出しを手動でトレース
async function tracedOpenAICall(messages: Array<{ role: string; content: string }>) {
  const traceId = crypto.randomUUID();
  const generationId = crypto.randomUUID();
  const startTime = new Date().toISOString();

  // OpenAI API 呼び出し
  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
    }),
  });

  const result = await openaiResponse.json();
  const endTime = new Date().toISOString();

  // Langfuse にトレースを送信
  await sendToLangfuse([
    {
      id: crypto.randomUUID(),
      type: "trace-create",
      timestamp: startTime,
      body: {
        id: traceId,
        name: "openai-chat",
        input: messages,
        output: result.choices?.[0]?.message?.content,
        metadata: { model: "gpt-4o" },
      },
    },
    {
      id: crypto.randomUUID(),
      type: "generation-create",
      timestamp: startTime,
      body: {
        id: generationId,
        traceId: traceId,
        name: "chat-completion",
        model: "gpt-4o",
        input: messages,
        output: result.choices?.[0]?.message?.content,
        startTime: startTime,
        endTime: endTime,
        usage: {
          input: result.usage?.prompt_tokens,
          output: result.usage?.completion_tokens,
          total: result.usage?.total_tokens,
        },
      },
    },
  ]);

  return result;
}
```

---

## 4. 環境変数の設定

### 必須環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `LANGFUSE_PUBLIC_KEY` | プロジェクト公開キー | `pk-lf-...` |
| `LANGFUSE_SECRET_KEY` | プロジェクト秘密キー | `sk-lf-...` |
| `LANGFUSE_BASE_URL` | API エンドポイント | `https://cloud.langfuse.com` |

### リージョン別エンドポイント

| リージョン | URL |
|-----------|-----|
| EU (デフォルト) | `https://cloud.langfuse.com` |
| US | `https://us.cloud.langfuse.com` |
| HIPAA US | `https://hipaa.cloud.langfuse.com` |
| Self-hosted | カスタム URL |

### Supabase Edge Functions での設定

```bash
# シークレットを設定
supabase secrets set LANGFUSE_PUBLIC_KEY=pk-lf-xxx
supabase secrets set LANGFUSE_SECRET_KEY=sk-lf-xxx
supabase secrets set LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

---

## 5. 手動トレーシングの方法

### Ingestion API 形式

Langfuse Ingestion API は `POST /api/public/ingestion` でバッチイベントを受け付けます。

#### イベントタイプ

| タイプ | 用途 |
|--------|------|
| `trace-create` | トレース作成（アップサート） |
| `span-create` | スパン作成 |
| `generation-create` | LLM 生成作成 |
| `event-create` | ポイントインタイムイベント作成 |
| `score-create` | スコア作成 |
| `span-update` | 既存スパン更新 |
| `generation-update` | 既存生成更新 |

#### 完全な例: ネストされたトレース

```typescript
const batch = [
  // 1. トレース作成
  {
    id: crypto.randomUUID(),
    type: "trace-create",
    timestamp: new Date().toISOString(),
    body: {
      id: "trace-001",
      name: "user-request",
      input: { query: "What is the weather?" },
      userId: "user-123",
      sessionId: "session-456",
      tags: ["production", "weather-app"],
    },
  },
  // 2. 親スパン作成
  {
    id: crypto.randomUUID(),
    type: "span-create",
    timestamp: new Date().toISOString(),
    body: {
      id: "span-001",
      traceId: "trace-001",
      name: "process-request",
      startTime: new Date().toISOString(),
    },
  },
  // 3. LLM 生成作成（親スパンの子）
  {
    id: crypto.randomUUID(),
    type: "generation-create",
    timestamp: new Date().toISOString(),
    body: {
      id: "gen-001",
      traceId: "trace-001",
      parentObservationId: "span-001",  // 親スパンを指定
      name: "llm-call",
      model: "gpt-4o",
      input: [{ role: "user", content: "What is the weather?" }],
      output: "I cannot check real-time weather...",
      startTime: "2026-01-20T10:00:00.000Z",
      endTime: "2026-01-20T10:00:02.000Z",
      usage: {
        input: 10,
        output: 50,
        total: 60,
      },
      metadata: {
        temperature: 0.7,
        maxTokens: 1000,
      },
    },
  },
];

// 送信
await fetch(`${LANGFUSE_BASE_URL}/api/public/ingestion`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Basic ${btoa(`${publicKey}:${secretKey}`)}`,
  },
  body: JSON.stringify({ batch }),
});
```

#### 重要な注意事項

1. **イベント ID**: 各イベントには一意の UUID が必要（重複排除に使用）
2. **親子関係**: 親オブザベーションを先に作成してから子を作成
3. **タイムスタンプ**: ISO 8601 形式を使用
4. **バッチサイズ制限**: 最大 4.5 MB
5. **レスポンス**: HTTP 207 Multi-Status を返す（部分的成功を許可）

---

## 6. Edge Functions (Deno) での推奨実装

### 結論

**SDK の直接使用は推奨しない。HTTP API を直接呼び出す実装を推奨。**

### 推奨アーキテクチャ

```
┌─────────────────────────┐
│   Supabase Edge Func    │
│   (Deno Runtime)        │
├─────────────────────────┤
│  1. OpenAI API 呼び出し │
│  2. レスポンス取得      │
│  3. Langfuse HTTP API   │
│     へ直接 POST         │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│   Langfuse Cloud        │
│   /api/public/ingestion │
└─────────────────────────┘
```

### Deno 用ユーティリティモジュール例

```typescript
// shared/langfuse/client.ts

type LangfuseEvent = {
  id: string;
  type: string;
  timestamp: string;
  body: Record<string, unknown>;
};

export class LangfuseClient {
  private publicKey: string;
  private secretKey: string;
  private baseUrl: string;
  private batch: LangfuseEvent[] = [];

  constructor() {
    this.publicKey = Deno.env.get("LANGFUSE_PUBLIC_KEY")!;
    this.secretKey = Deno.env.get("LANGFUSE_SECRET_KEY")!;
    this.baseUrl = Deno.env.get("LANGFUSE_BASE_URL") || "https://cloud.langfuse.com";
  }

  private getAuthHeader(): string {
    return `Basic ${btoa(`${this.publicKey}:${this.secretKey}`)}`;
  }

  createTrace(params: {
    id?: string;
    name: string;
    input?: unknown;
    output?: unknown;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): string {
    const id = params.id || crypto.randomUUID();
    this.batch.push({
      id: crypto.randomUUID(),
      type: "trace-create",
      timestamp: new Date().toISOString(),
      body: { id, ...params },
    });
    return id;
  }

  createGeneration(params: {
    id?: string;
    traceId: string;
    parentObservationId?: string;
    name: string;
    model: string;
    input?: unknown;
    output?: unknown;
    startTime?: string;
    endTime?: string;
    usage?: {
      input?: number;
      output?: number;
      total?: number;
    };
    metadata?: Record<string, unknown>;
  }): string {
    const id = params.id || crypto.randomUUID();
    this.batch.push({
      id: crypto.randomUUID(),
      type: "generation-create",
      timestamp: new Date().toISOString(),
      body: { id, ...params },
    });
    return id;
  }

  createSpan(params: {
    id?: string;
    traceId: string;
    parentObservationId?: string;
    name: string;
    startTime?: string;
    endTime?: string;
    input?: unknown;
    output?: unknown;
    metadata?: Record<string, unknown>;
  }): string {
    const id = params.id || crypto.randomUUID();
    this.batch.push({
      id: crypto.randomUUID(),
      type: "span-create",
      timestamp: new Date().toISOString(),
      body: { id, ...params },
    });
    return id;
  }

  async flush(): Promise<Response> {
    if (this.batch.length === 0) {
      return new Response(JSON.stringify({ message: "No events to flush" }), {
        status: 200,
      });
    }

    const response = await fetch(`${this.baseUrl}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.getAuthHeader(),
      },
      body: JSON.stringify({ batch: this.batch }),
    });

    this.batch = [];
    return response;
  }
}
```

### 使用例

```typescript
// edge-function/index.ts
import { LangfuseClient } from "../shared/langfuse/client.ts";

Deno.serve(async (req: Request) => {
  const langfuse = new LangfuseClient();

  try {
    const { messages } = await req.json();
    const startTime = new Date().toISOString();

    // トレース作成
    const traceId = langfuse.createTrace({
      name: "chat-completion",
      input: messages,
      userId: req.headers.get("x-user-id") || undefined,
    });

    // OpenAI 呼び出し
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({ model: "gpt-4o", messages }),
    });

    const result = await openaiResponse.json();
    const endTime = new Date().toISOString();

    // 生成をトレースに追加
    langfuse.createGeneration({
      traceId,
      name: "gpt-4o-completion",
      model: "gpt-4o",
      input: messages,
      output: result.choices?.[0]?.message?.content,
      startTime,
      endTime,
      usage: {
        input: result.usage?.prompt_tokens,
        output: result.usage?.completion_tokens,
        total: result.usage?.total_tokens,
      },
    });

    // Langfuse にフラッシュ（非同期で OK）
    langfuse.flush().catch(console.error);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
```

---

## 7. バージョン互換性

| コンポーネント | 要件 |
|---------------|------|
| Langfuse Platform (self-hosted) | >= 3.95.0 (SDK v4 対応) |
| Node.js | >= 20.0.0 |
| TypeScript SDK | v4.x (現行) |
| OpenTelemetry SDK | 最新版推奨 |

---

## 8. 参考リンク

- [TypeScript SDK Overview](https://langfuse.com/docs/observability/sdk/typescript/overview)
- [TypeScript SDK Setup](https://langfuse.com/docs/observability/sdk/typescript/setup)
- [OpenAI Integration (JS/TS)](https://langfuse.com/guides/cookbook/js_integration_openai)
- [SDK Upgrade Path (v3 to v4)](https://langfuse.com/docs/observability/sdk/upgrade-path)
- [GitHub: langfuse-js](https://github.com/langfuse/langfuse-js)
- [Deno/Edge Functions Discussion](https://github.com/orgs/langfuse/discussions/6150)
- [Ingestion API DeepWiki](https://deepwiki.com/langfuse/langfuse/6.2-ingestion-api)
- [Public API Documentation](https://langfuse.com/docs/api-and-data-platform/features/public-api)
- [API Reference](https://api.reference.langfuse.com/)

---

## 9. まとめ

### Edge Functions (Deno) での使用

| 方法 | 推奨度 | 理由 |
|------|--------|------|
| HTTP API 直接呼び出し | **推奨** | Deno 完全対応、依存関係なし |
| SDK v4 (`@langfuse/tracing`) | 非対応 | Node.js 20+ / OpenTelemetry 依存 |
| SDK v3 (レガシー) | 非推奨 | メンテナンス終了予定 |

### 実装方針

1. **Supabase Edge Functions では HTTP API を直接使用**
2. **共通ユーティリティを `shared/langfuse/` に作成**
3. **環境変数で認証情報を管理**
4. **バッチ送信で効率化**
5. **flush() は非同期で実行可能（レスポンスを待たない）**
