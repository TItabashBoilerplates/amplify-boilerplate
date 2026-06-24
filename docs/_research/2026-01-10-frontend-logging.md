# Frontend Logging 調査レポート

## 調査情報

- **調査日**: 2026-01-10
- **調査者**: spec agent

---

## 1. 推奨ログライブラリ比較

### 主要ライブラリ一覧

| ライブラリ | 特徴 | サーバー | ブラウザ | パフォーマンス | TypeScript |
|-----------|------|---------|---------|--------------|------------|
| **Pino** | 高速JSON出力、構造化ログ | Yes | Yes (限定的) | 最高 | Yes |
| **Winston** | 多機能、豊富なトランスポート | Yes | No (fs依存) | 良好 | Yes |
| **loglevel** | 軽量、isomorphic対応 | Yes | Yes | 良好 | Yes (同梱) |
| **LogLayer** | 抽象化レイヤー、複数バックエンド対応 | Yes | Yes | 良好 | Yes |
| **next-logger** | Next.js特化、console自動パッチ | Yes | No | 良好 | Yes |

### Next.js 15/16 での推奨

**推奨構成: Pino + loglevel (Hybrid Approach)**

| 環境 | 推奨ライブラリ | 理由 |
|------|--------------|------|
| **Server (Node.js)** | Pino | 最高のパフォーマンス、JSON出力、OpenTelemetry対応 |
| **Client (Browser)** | loglevel | 軽量(1.4KB)、isomorphic、行番号保持 |

**代替案: LogLayer**
- 統一されたAPI
- サーバー/クライアント両対応
- 複数のトランスポートをサポート

---

## 2. クライアントサイド vs サーバーサイド戦略

### サーバーサイドログ (Server Components, API Routes, Server Actions)

**特徴**:
- Node.js環境で実行
- stdout/stderr に出力
- ファイル出力・外部サービス送信可能
- 構造化JSON形式推奨

**Pinoの推奨設定**:

```typescript
// lib/logger.server.ts
import pino, { type Logger } from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

export const logger: Logger = isProduction
  ? pino({
      level: process.env.LOG_LEVEL || 'info',
      // 本番: JSON出力（ログ管理ツール向け）
    })
  : pino({
      level: process.env.LOG_LEVEL || 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    })
```

**Next.js 16 での設定 (next.config.ts)**:

```typescript
const nextConfig = {
  serverExternalPackages: ['pino', 'pino-pretty'],
}
```

### クライアントサイドログ (Client Components)

**特徴**:
- ブラウザ環境で実行
- `console.*` APIのみ使用可能
- fs、ネットワーク系ライブラリは直接使用不可
- パフォーマンス影響を最小限に

**loglevelの推奨設定**:

```typescript
// lib/logger.client.ts
'use client'

import log from 'loglevel'

// 開発環境: debug以上を表示
// 本番環境: warn以上のみ表示
const level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
log.setLevel(level)

export { log as logger }
```

### ユニバーサルロガー（サーバー/クライアント共通）

```typescript
// lib/logger.ts
import { type Logger as PinoLogger } from 'pino'
import type log from 'loglevel'

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

interface UniversalLogger {
  trace: (msg: string, data?: object) => void
  debug: (msg: string, data?: object) => void
  info: (msg: string, data?: object) => void
  warn: (msg: string, data?: object) => void
  error: (msg: string, data?: object) => void
  child: (context: object) => UniversalLogger
}

const isServer = typeof window === 'undefined'

function createLogger(): UniversalLogger {
  if (isServer) {
    // Server: Pino
    const pino = require('pino')
    const pinoLogger: PinoLogger = process.env.NODE_ENV === 'production'
      ? pino({ level: process.env.LOG_LEVEL || 'info' })
      : pino({
          level: process.env.LOG_LEVEL || 'debug',
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        })

    return {
      trace: (msg, data) => pinoLogger.trace(data || {}, msg),
      debug: (msg, data) => pinoLogger.debug(data || {}, msg),
      info: (msg, data) => pinoLogger.info(data || {}, msg),
      warn: (msg, data) => pinoLogger.warn(data || {}, msg),
      error: (msg, data) => pinoLogger.error(data || {}, msg),
      child: (context) => {
        const childPino = pinoLogger.child(context)
        return {
          trace: (msg, data) => childPino.trace(data || {}, msg),
          debug: (msg, data) => childPino.debug(data || {}, msg),
          info: (msg, data) => childPino.info(data || {}, msg),
          warn: (msg, data) => childPino.warn(data || {}, msg),
          error: (msg, data) => childPino.error(data || {}, msg),
          child: (ctx) => createLogger().child({ ...context, ...ctx }),
        }
      },
    }
  }

  // Client: loglevel
  const loglevel = require('loglevel')
  loglevel.setLevel(process.env.NODE_ENV === 'production' ? 'warn' : 'debug')

  return {
    trace: (msg, data) => loglevel.trace(msg, data),
    debug: (msg, data) => loglevel.debug(msg, data),
    info: (msg, data) => loglevel.info(msg, data),
    warn: (msg, data) => loglevel.warn(msg, data),
    error: (msg, data) => loglevel.error(msg, data),
    child: (context) => {
      // loglevelはchild非対応、contextを毎回付与
      const prefix = JSON.stringify(context)
      return {
        trace: (msg, data) => loglevel.trace(`[${prefix}]`, msg, data),
        debug: (msg, data) => loglevel.debug(`[${prefix}]`, msg, data),
        info: (msg, data) => loglevel.info(`[${prefix}]`, msg, data),
        warn: (msg, data) => loglevel.warn(`[${prefix}]`, msg, data),
        error: (msg, data) => loglevel.error(`[${prefix}]`, msg, data),
        child: (ctx) => createLogger().child({ ...context, ...ctx }),
      }
    },
  }
}

export const logger = createLogger()
```

---

## 3. 構造化ログ（Structured Logging）の実装パターン

### 構造化ログとは

従来の文字列ログではなく、キーバリュー形式（主にJSON）でログを出力する手法。

**利点**:
- ログ管理ツール（Datadog, ELK, Grafana Loki等）での検索・フィルタリングが容易
- メトリクスへの変換が可能
- 一貫したフォーマット

### Pinoでの構造化ログ

```typescript
// 基本的な構造化ログ
logger.info({ userId: 'user123', action: 'login' }, 'User logged in')

// 出力 (JSON)
// {"level":30,"time":1704844800000,"userId":"user123","action":"login","msg":"User logged in"}

// Child logger によるコンテキスト付加
const requestLogger = logger.child({
  requestId: 'req-abc123',
  path: '/api/users',
})

requestLogger.info({ userId: 'user123' }, 'Processing request')
// {"level":30,"time":...,"requestId":"req-abc123","path":"/api/users","userId":"user123","msg":"Processing request"}
```

### 推奨フィールド

| フィールド | 説明 | 例 |
|-----------|------|-----|
| `requestId` | リクエスト追跡用ID | `"req-abc123"` |
| `userId` | ユーザー識別子 | `"user_123"` |
| `action` | 実行アクション | `"login"`, `"checkout"` |
| `duration` | 処理時間（ms） | `150` |
| `status` | 処理結果 | `"success"`, `"failure"` |
| `error` | エラー情報 | `{ name: "Error", message: "..." }` |
| `module` | モジュール名 | `"auth"`, `"payment"` |

### クライアント側での構造化ログ

```typescript
// loglevelはJSON出力非対応のため、オブジェクトを第2引数で渡す
logger.info('User action', { userId: 'user123', action: 'click', target: 'button' })

// ブラウザコンソール出力:
// [INFO] User action { userId: 'user123', action: 'click', target: 'button' }
```

---

## 4. ログレベルの標準定義

### Pinoのログレベル

| レベル | 数値 | 用途 |
|-------|------|------|
| `trace` | 10 | 最も詳細なデバッグ情報（関数呼び出し等） |
| `debug` | 20 | デバッグ情報（変数値、処理フロー等） |
| `info` | 30 | 通常の運用情報（ユーザーアクション、API呼び出し等） |
| `warn` | 40 | 警告（非推奨API使用、リトライ発生等） |
| `error` | 50 | エラー（例外発生、処理失敗等） |
| `fatal` | 60 | 致命的エラー（アプリ停止を伴う重大エラー） |
| `silent` | Infinity | 全ログ無効化 |

### loglevelのログレベル

| レベル | 数値 | 用途 |
|-------|------|------|
| `trace` | 0 | 最詳細 |
| `debug` | 1 | デバッグ |
| `info` | 2 | 情報 |
| `warn` | 3 | 警告（デフォルト） |
| `error` | 4 | エラー |
| `silent` | 5 | 無効化 |

### ログレベル使い分けガイドライン

```typescript
// TRACE: 非常に詳細なデバッグ（通常は無効化）
logger.trace({ args }, 'Function called')

// DEBUG: 開発時のデバッグ情報
logger.debug({ userId, params }, 'Processing user request')

// INFO: 重要なビジネスイベント
logger.info({ userId, orderId }, 'Order placed successfully')

// WARN: 注意が必要だが処理は継続可能
logger.warn({ retryCount: 3 }, 'API call failed, retrying...')

// ERROR: エラー発生（スタックトレース含む）
logger.error({ err, userId }, 'Failed to process payment')

// FATAL: アプリ停止を伴う重大エラー（サーバーのみ）
logger.fatal({ err }, 'Database connection lost, shutting down')
```

---

## 5. 開発環境と本番環境の違い

### 設定比較

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| **ログレベル** | `debug` または `trace` | `info` または `warn` |
| **出力形式** | Pretty print（人間可読） | JSON（機械可読） |
| **色付け** | あり | なし |
| **タイムスタンプ形式** | ローカル時刻 | ISO 8601 (UTC) |
| **出力先** | stdout/console | stdout + ログ収集サービス |
| **パフォーマンス考慮** | 低 | 高 |

### 環境別設定例

```typescript
// lib/logger.config.ts
import type { LoggerOptions } from 'pino'

type Environment = 'development' | 'production' | 'test'

const configs: Record<Environment, LoggerOptions> = {
  development: {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  },
  production: {
    level: process.env.LOG_LEVEL || 'info',
    // JSON出力（pino-pretty不使用）
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  },
  test: {
    level: 'silent', // テスト時はログ無効化
  },
}

export function getLoggerConfig(): LoggerOptions {
  const env = (process.env.NODE_ENV || 'development') as Environment
  return configs[env] || configs.development
}
```

### クライアント側の環境別設定

```typescript
// lib/logger.client.ts
'use client'

import log from 'loglevel'

function initializeLogger() {
  if (process.env.NODE_ENV === 'production') {
    // 本番: 警告以上のみ表示
    log.setLevel('warn')
  } else if (process.env.NODE_ENV === 'test') {
    // テスト: 無効化
    log.setLevel('silent')
  } else {
    // 開発: すべて表示
    log.setLevel('trace')
  }

  return log
}

export const logger = initializeLogger()
```

---

## 6. 実装推奨事項

### パッケージ選定

```bash
# サーバー用
bun add pino
bun add -D pino-pretty

# クライアント用（isomorphic対応）
bun add loglevel
```

### ディレクトリ構成 (FSD準拠)

```
frontend/apps/web/src/
├── shared/
│   └── lib/
│       └── logger/
│           ├── index.ts          # 公開API（エクスポート）
│           ├── logger.server.ts  # サーバー用Pinoロガー
│           ├── logger.client.ts  # クライアント用loglevelロガー
│           ├── logger.ts         # ユニバーサルロガー
│           └── config.ts         # 環境別設定
```

### Next.js Instrumentation (optional)

`next-logger` を使用してNext.js内部ログもJSON形式にする場合:

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('pino')
    await import('next-logger')
  }
}
```

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  serverExternalPackages: ['pino', 'pino-pretty'],
}
```

### セキュリティ考慮事項

1. **機密情報のマスキング**:
   ```typescript
   const logger = pino({
     redact: ['password', 'token', 'authorization', 'cookie'],
   })
   ```

2. **クライアントログの制限**:
   - 本番環境では`warn`以上のみ
   - 機密情報をログに含めない
   - ユーザーIDは可（セッション/トークンは不可）

3. **エラーオブジェクトの処理**:
   ```typescript
   // スタックトレースを含むエラーをシリアライズ
   import { serializeError } from 'serialize-error'
   logger.error({ err: serializeError(error) }, 'Error occurred')
   ```

---

## 7. 代替案: LogLayerによる統一実装

LogLayerを使用することで、サーバー/クライアントで統一されたAPIを提供できる。

### インストール

```bash
bun add loglayer @loglayer/transport-pino pino serialize-error
bun add -D pino-pretty
```

### 統一ロガー実装

```typescript
// lib/logger.ts
import { LogLayer } from 'loglayer'
import { PinoTransport } from '@loglayer/transport-pino'
import { serializeError } from 'serialize-error'
import pino from 'pino'

const isServer = typeof window === 'undefined'
const isDevelopment = process.env.NODE_ENV === 'development'

const pinoLogger = pino({
  level: 'trace',
  ...(isDevelopment && isServer
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : {}),
})

export const logger = new LogLayer({
  errorSerializer: serializeError,
  transport: [
    new PinoTransport({
      logger: pinoLogger,
      enabled: isServer || !isDevelopment,
    }),
  ],
})
```

---

## 参考リンク

- [Pino - Official Documentation](https://getpino.io/)
- [Pino GitHub - Browser API](https://github.com/pinojs/pino/blob/main/docs/browser.md)
- [pino-pretty GitHub](https://github.com/pinojs/pino-pretty)
- [loglevel GitHub](https://github.com/pimterry/loglevel)
- [LogLayer - Next.js Integration](https://loglayer.dev/example-integrations/nextjs.html)
- [Structured Logging for Next.js - Arcjet Blog](https://blog.arcjet.com/structured-logging-in-json-for-next-js/)
- [Pino Logger Guide 2026 - SigNoz](https://signoz.io/guides/pino-logger/)
- [Better Stack - Pino Complete Guide](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/)
- [Next.js Discussions - Logging](https://github.com/vercel/next.js/discussions/13214)
- [Vercel Pino Logging Template](https://vercel.com/templates/next.js/pino-logging)
- [npm: next-logger](https://www.npmjs.com/package/next-logger)
