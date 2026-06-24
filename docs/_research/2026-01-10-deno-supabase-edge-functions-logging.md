# Deno/Supabase Edge Functions ログ調査レポート

## 調査情報

- **調査日**: 2026-01-10
- **調査者**: spec agent

---

## 1. Deno 推奨ログライブラリ

### @std/log（Deno 標準ライブラリ）

**状態**: 非推奨予定

> "@std/log package is likely to be removed in the future; consider using OpenTelemetry for production systems"

本番環境では OpenTelemetry の使用が推奨されている。ただし、軽量なログ出力目的では引き続き使用可能。

**構造化ログ出力**:
```typescript
import { ConsoleHandler, setup, getLogger } from "@std/log";

await setup({
  handlers: {
    console: new ConsoleHandler("DEBUG", {
      formatter: log.formatters.jsonFormatter,
      useColors: false,
    }),
  },
  loggers: {
    default: {
      level: "DEBUG",
      handlers: ["console"],
    },
  },
});
```

### LogTape（推奨: 2025-2026年のベストプラクティス）

**特徴**:
- ゼロ依存
- 5.3KB の軽量設計
- Node.js, Deno, Bun, Edge Functions で同一コード動作
- 構造化ログ対応
- AsyncLocalStorage によるコンテキスト管理

**インストール**:
```bash
# Deno
deno add jsr:@logtape/logtape

# npm (Edge Functions deno.json で使用可能)
# "logtape": "npm:@logtape/logtape"
```

**基本設定**:
```typescript
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(),
  },
  loggers: [
    { category: "my-app", lowestLevel: "debug", sinks: ["console"] },
  ],
});

const logger = getLogger(["my-app"]);
logger.info`User {userId} logged in`;
```

### console.log/error（最軽量）

Supabase Edge Functions では `console.log`, `console.error`, `console.warn` がそのまま Logs に記録される。依存ライブラリなしで即座に利用可能。

---

## 2. Supabase Edge Functions ログ取得方法

### ダッシュボード

1. Supabase Dashboard > Edge Functions
2. 対象関数を選択
3. 2つのビューから確認:
   - **Invocations**: リクエスト/レスポンスデータ
   - **Logs**: プラットフォームイベント・エラー・カスタムメッセージ

### CLI

```bash
# ログ取得
supabase functions logs <function-name>

# リアルタイム追跡（本番環境）
supabase functions logs <function-name> --follow

# ローカル開発（ターミナルに直接出力）
supabase functions serve <function-name> --debug
```

### ログ種別

| 種別 | 説明 |
|------|------|
| `function_edge_logs` | エッジネットワークログ（リクエスト/レスポンスメタデータ） |
| `function_logs` | 関数内部ログ（console.log 出力） |

### 制限事項

| 項目 | 制限 |
|------|------|
| メッセージサイズ | 最大 10,000 文字 |
| レート制限 | 100 イベント / 10 秒 |
| 自動キャプチャ | 未処理例外、boot/shutdown ログ |

---

## 3. 構造化ログの実装パターン

### パターン A: 素の console.log + JSON.stringify（最軽量）

```typescript
// supabase/functions/shared/logger.ts

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    console.log(JSON.stringify(createLogEntry("debug", message, data)));
  },
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(JSON.stringify(createLogEntry("info", message, data)));
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(JSON.stringify(createLogEntry("warn", message, data)));
  },
  error: (message: string, data?: Record<string, unknown>) => {
    console.error(JSON.stringify(createLogEntry("error", message, data)));
  },
};
```

**使用例**:
```typescript
import { logger } from "../shared/logger.ts";

logger.info("User logged in", { userId: "123", action: "login" });
// 出力: {"timestamp":"2026-01-10T05:00:00.000Z","level":"info","message":"User logged in","userId":"123","action":"login"}
```

### パターン B: LogTape（高機能）

```typescript
// supabase/functions/shared/logger.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { configure, getConsoleSink, getLogger, withContext } from "@logtape/logtape";

// 初期化（アプリケーションエントリーポイントで1回のみ実行）
export async function initLogger() {
  await configure({
    contextLocalStorage: new AsyncLocalStorage(),
    sinks: {
      console: getConsoleSink({
        formatter(record) {
          return [JSON.stringify({
            timestamp: record.timestamp.toISOString(),
            level: record.level,
            category: record.category.join("."),
            message: record.message.join(""),
            ...record.properties,
          })];
        },
      }),
    },
    loggers: [
      { category: ["app"], lowestLevel: "debug", sinks: ["console"] },
    ],
  });
}

export { getLogger, withContext };
```

**リクエストコンテキスト付きログ**:
```typescript
import { getLogger, withContext, initLogger } from "../shared/logger.ts";

await initLogger();

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  return withContext({ requestId }, async () => {
    const logger = getLogger(["app", "webhook"]);

    logger.info`Request received`;
    // 出力: {"timestamp":"...","level":"info","category":"app.webhook","message":"Request received","requestId":"abc-123"}

    // ... 処理

    logger.info`Request completed`;
    return new Response("OK");
  });
});
```

---

## 4. リクエストトレーシングの実装

### 方法 1: 手動 Request ID 付与（軽量）

```typescript
// supabase/functions/shared/request-context.ts

export interface RequestContext {
  requestId: string;
  startTime: number;
}

export function createRequestContext(): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
  };
}

export function logWithContext(
  ctx: RequestContext,
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
) {
  const logFn = level === "error" ? console.error :
                level === "warn" ? console.warn : console.log;

  logFn(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    requestId: ctx.requestId,
    durationMs: Date.now() - ctx.startTime,
    message,
    ...data,
  }));
}
```

**使用例**:
```typescript
Deno.serve(async (req: Request) => {
  const ctx = createRequestContext();

  logWithContext(ctx, "info", "Webhook received", {
    method: req.method,
    path: new URL(req.url).pathname,
  });

  try {
    // 処理
    logWithContext(ctx, "info", "Webhook processed successfully");
    return new Response("OK");
  } catch (error) {
    logWithContext(ctx, "error", "Webhook failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("Error", { status: 500 });
  }
});
```

### 方法 2: AsyncLocalStorage + LogTape（高機能）

```typescript
// supabase/functions/shared/tracing.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { configure, getConsoleSink, getLogger, withContext } from "@logtape/logtape";

const requestStorage = new AsyncLocalStorage<{ requestId: string }>();

export async function setupTracing() {
  await configure({
    contextLocalStorage: requestStorage,
    sinks: {
      console: getConsoleSink(),
    },
    loggers: [
      { category: ["app"], lowestLevel: "info", sinks: ["console"] },
    ],
  });
}

export function withRequestId<T>(fn: () => T): T {
  const requestId = crypto.randomUUID();
  return withContext({ requestId }, fn);
}

export { getLogger };
```

**注意**: AsyncLocalStorage は約 20-40% のオーバーヘッドがある。パフォーマンスが重要な場合は手動方式を推奨。

---

## 5. エラーログの適切な出力形式

### 推奨フォーマット

```typescript
interface ErrorLogEntry {
  timestamp: string;
  level: "error";
  requestId?: string;
  message: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
}

function logError(
  error: unknown,
  message: string,
  context?: Record<string, unknown>
) {
  const errorInfo = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    : {
        name: "UnknownError",
        message: String(error),
      };

  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    message,
    error: errorInfo,
    context,
  };

  console.error(JSON.stringify(entry));
}
```

**出力例**:
```json
{
  "timestamp": "2026-01-10T05:00:00.000Z",
  "level": "error",
  "message": "Webhook processing failed",
  "error": {
    "name": "TypeError",
    "message": "Cannot read property 'id' of undefined",
    "stack": "TypeError: Cannot read property 'id' of undefined\n    at handleWebhook..."
  },
  "context": {
    "eventType": "checkout.updated",
    "webhookId": "wh_123"
  }
}
```

### HTTP ステータスコードの使い分け

| ステータス | 用途 |
|-----------|------|
| 400 | 不正なリクエスト（バリデーションエラー） |
| 401 | 認証失敗（署名検証失敗など） |
| 404 | リソースが見つからない |
| 500 | サーバーエラー（予期しない例外） |

---

## 6. このプロジェクトへの推奨実装

### 推奨アプローチ: パターン A（軽量構造化ログ）

**理由**:
- 依存ライブラリ追加不要
- 軽量・高速
- Supabase Logs ダッシュボードで検索可能
- 既存の Edge Functions との互換性

### 実装ファイル構成

```
supabase/functions/
├── shared/
│   ├── logger.ts          # 構造化ログユーティリティ
│   └── request-context.ts # リクエストトレーシング
├── polar-webhooks/
│   └── index.ts           # ログ出力を統一
└── onesignal-webhooks/
    └── index.ts
```

### 既存コードの改善例

**Before** (polar-webhooks/index.ts):
```typescript
console.log("[webhook] Received event:", eventType);
console.error("[webhook] Invalid signature");
```

**After**:
```typescript
import { createRequestContext, logWithContext } from "../shared/request-context.ts";

Deno.serve(async (req: Request) => {
  const ctx = createRequestContext();

  logWithContext(ctx, "info", "Webhook received", {
    eventType,
    webhookId: req.headers.get("webhook-id"),
  });

  // ...

  logWithContext(ctx, "error", "Invalid signature", {
    webhookId: req.headers.get("webhook-id"),
  });
});
```

---

## 参考リンク

### 公式ドキュメント
- [Supabase Edge Functions Logging](https://supabase.com/docs/guides/functions/logging)
- [Supabase Edge Functions Error Handling](https://supabase.com/docs/guides/functions/error-handling)
- [Deno @std/log](https://docs.deno.com/runtime/reference/std/log/)
- [Deno OpenTelemetry](https://docs.deno.com/runtime/fundamentals/open_telemetry/)

### LogTape
- [LogTape 公式サイト](https://logtape.org/)
- [LogTape GitHub](https://github.com/dahlia/logtape)
- [LogTape Structured Logging](https://logtape.org/manual/struct)
- [LogTape Contexts](https://logtape.org/manual/contexts)
- [Logging in Node.js/Deno/Bun/Edge Functions in 2026](https://dev.to/hongminhee/logging-in-nodejs-or-deno-or-bun-or-edge-functions-in-2026-36l2)

### コンテキストログ
- [Deno AsyncLocalStorage](https://docs.deno.com/api/node/async_hooks/~/AsyncLocalStorage)
- [Contextual Logging in Node.js with AsyncLocalStorage](https://www.dash0.com/guides/contextual-logging-in-nodejs)

### その他のログライブラリ
- [deno_structured_logging](https://deno.land/x/deno_structured_logging@0.4.2)
- [@denosaurs/log](https://jsr.io/@denosaurs/log)
