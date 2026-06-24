# Vercel AI SDK + Langfuse 統合調査レポート

## 調査情報

- **調査日**: 2026-01-20
- **調査者**: spec agent

## 概要

Vercel AI SDK と Langfuse の統合は、OpenTelemetry を介して実現される。Vercel AI SDK は組み込みの OpenTelemetry テレメトリーを持ち、Langfuse は OpenTelemetry ベースのスパンプロセッサを提供している。

## バージョン情報

| パッケージ | 現在の最新バージョン | 備考 |
|-----------|---------------------|------|
| `ai` (Vercel AI SDK) | 3.3.0+ | テレメトリー機能は `experimental_telemetry` |
| `@langfuse/tracing` | 4.x | SDK v4 (2025年8月GA) |
| `@langfuse/otel` | 4.5.1 | LangfuseSpanProcessor |
| `@opentelemetry/sdk-node` | 最新 | Node.js 20以上推奨 |
| `langfuse-vercel` | - | **非推奨（deprecated）** |

### 重要な変更点

- **2025年8月**: Langfuse TypeScript SDK v4 が GA リリース
- `langfuse-vercel` パッケージは非推奨
- 新しい推奨パッケージ: `@langfuse/tracing` + `@langfuse/otel`

## 公式統合方法

### 1. インストール

```bash
# Vercel AI SDK
npm install ai @ai-sdk/openai

# Langfuse + OpenTelemetry
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

### 2. 環境変数

```env
# Langfuse
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_BASE_URL="https://cloud.langfuse.com"
# US リージョンの場合: https://us.cloud.langfuse.com

# OpenAI (または他のプロバイダー)
OPENAI_API_KEY="sk-proj-..."
```

### 3. OpenTelemetry セットアップ

**Node.js / Next.js の場合 (`instrumentation.ts`):**

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();
```

**注意**: Next.js では `@vercel/otel` の `registerOTel` ではなく、`NodeSDK` を直接使用すること。`@vercel/otel` は OpenTelemetry JS SDK v2 をまだサポートしていない。

### 4. AI SDK でのテレメトリー有効化

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4"),
  prompt: "Your prompt here",
  experimental_telemetry: {
    isEnabled: true,
    functionId: "my-function",  // オプション
    metadata: {                  // オプション
      userId: "user-123",
      sessionId: "session-456",
    },
  },
});
```

## Deno / Edge Functions での利用可能性

### 現状のサポート状況

| 環境 | サポート状況 | 備考 |
|------|-------------|------|
| Node.js | **完全サポート** | 公式推奨 |
| Next.js (Node runtime) | **完全サポート** | `NodeSDK` 使用 |
| Vercel Edge Functions | **限定的** | Pro/Enterprise プランでのみ OTEL Collector 利用可 |
| Deno (ローカル) | **実験的** | `OTEL_DENO=true` で有効化可能 |
| **Supabase Edge Functions** | **未サポート** | edge-runtime が OTEL 未対応 |
| Cloudflare Workers | **未サポート** | 公式実装なし |

### Supabase Edge Functions の制限

**重要**: Supabase Edge Functions は現時点で OpenTelemetry をサポートしていない。

- Supabase の edge-runtime は Deno ベースだが、Deno の `OTEL_DENO=true` フラグは利用できない
- GitHub Discussion #34996 で機能リクエストが上がっているが、未対応のまま
- Langfuse の Discussion #6150 でも同様の要望あり、公式リファレンス実装は存在しない

### Deno ネイティブ OpenTelemetry（参考）

Deno 自体は OpenTelemetry をネイティブサポートしている（Supabase Edge Functions では使用不可）:

```bash
OTEL_DENO=true \
OTEL_EXPORTER_OTLP_ENDPOINT=https://cloud.langfuse.com/api/public/otel \
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic $(echo -n 'pk-lf-...:sk-lf-...' | base64)" \
deno run my_script.ts
```

```typescript
// Deno での npm パッケージインポート
import { NodeSDK } from "npm:@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "npm:@langfuse/otel";
```

## Langfuse OTEL エンドポイント（直接 HTTP 送信）

Langfuse は OTLP HTTP エンドポイントを提供している:

| リージョン | エンドポイント |
|-----------|---------------|
| EU | `https://cloud.langfuse.com/api/public/otel` |
| US | `https://us.cloud.langfuse.com/api/public/otel` |
| セルフホスト (v3.22.0+) | `http://localhost:3000/api/public/otel` |

**認証**: Basic Auth (`pk-lf-...:sk-lf-...` を Base64 エンコード)

**プロトコル**: `http/protobuf` のみ（gRPC は未サポート）

## Supabase Edge Functions での代替アプローチ

### 方法 1: HTTP 経由での手動トレース送信

OpenTelemetry SDK を使わず、Langfuse REST API で直接トレースを送信:

```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LANGFUSE_API_URL = Deno.env.get("LANGFUSE_BASE_URL") + "/api/public";
const LANGFUSE_PUBLIC_KEY = Deno.env.get("LANGFUSE_PUBLIC_KEY");
const LANGFUSE_SECRET_KEY = Deno.env.get("LANGFUSE_SECRET_KEY");

async function sendTrace(traceData: object) {
  const auth = btoa(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`);

  await fetch(`${LANGFUSE_API_URL}/ingestion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      batch: [traceData],
    }),
  });
}

serve(async (req) => {
  const startTime = new Date().toISOString();
  const traceId = crypto.randomUUID();

  // AI SDK の処理...

  // トレースを Langfuse に送信
  await sendTrace({
    type: "trace-create",
    body: {
      id: traceId,
      name: "edge-function-call",
      timestamp: startTime,
      metadata: { source: "supabase-edge" },
    },
  });

  return new Response("OK");
});
```

### 方法 2: バックエンド経由でのトレーシング

Edge Functions では AI 処理を行わず、`backend-py` (FastAPI) にリクエストを転送し、Python 側で Langfuse トレーシングを実行する。

```typescript
// Edge Function: リクエスト転送のみ
const response = await fetch(`${BACKEND_URL}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody),
});
```

## 推奨構成

### Web アプリ (Next.js) での AI + Langfuse

```
Next.js App (Node Runtime)
    │
    ├─ @ai-sdk/openai (AI SDK)
    ├─ @langfuse/tracing
    ├─ @langfuse/otel
    └─ @opentelemetry/sdk-node
         │
         └─→ Langfuse Cloud (traces)
```

### Supabase Edge Functions での AI

**現時点での推奨**: Edge Functions では AI 処理を避け、`backend-py` で実行する

```
Supabase Edge Function
    │
    └─→ backend-py (FastAPI)
            │
            ├─ LangChain / AI SDK
            ├─ langfuse (Python SDK)
            └─→ Langfuse Cloud (traces)
```

## 結論

| ユースケース | 推奨度 | 実装方法 |
|-------------|--------|---------|
| Next.js + AI SDK + Langfuse | **推奨** | `@langfuse/otel` + `NodeSDK` |
| Node.js バックエンド | **推奨** | 同上 |
| Supabase Edge Functions + AI | **非推奨** | backend-py に移行 |
| Edge Functions (ログのみ) | **制限付き** | HTTP API で手動送信 |

**Supabase Edge Functions で Vercel AI SDK + Langfuse を使用することは、現時点では技術的に困難**。edge-runtime が OpenTelemetry をサポートするまで、AI 処理は Node.js または Python バックエンドで行うことを強く推奨する。

## 参考リンク

- [Langfuse Vercel AI SDK Integration](https://langfuse.com/integrations/frameworks/vercel-ai-sdk)
- [AI SDK Langfuse Provider](https://ai-sdk.dev/providers/observability/langfuse)
- [Langfuse TypeScript SDK v4 Documentation](https://langfuse.com/docs/observability/sdk/typescript/overview)
- [Langfuse TypeScript SDK v4 GA Announcement](https://langfuse.com/changelog/2025-08-28-typescript-sdk-v4-ga)
- [AI SDK Telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)
- [Deno OpenTelemetry](https://docs.deno.com/runtime/fundamentals/open_telemetry/)
- [Langfuse OpenTelemetry Native Integration](https://langfuse.com/integrations/native/opentelemetry)
- [Supabase Edge Functions OTel Discussion #34996](https://github.com/orgs/supabase/discussions/34996)
- [Langfuse Deno Reference Implementation Request #6150](https://github.com/orgs/langfuse/discussions/6150)
