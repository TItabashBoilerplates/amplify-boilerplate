---
name: logger
description: 統一ロギング戦略ガイダンス。Frontend (Pino + loglevel)、Backend-py (structlog)、Edge Functions (軽量実装) での構造化ログについての質問に使用。ログレベル設定、環境変数、child() による階層化ロガーの実装支援を提供。
---

# 統一ロギング戦略スキル

このプロジェクトは3つのドメインで統一されたロギング戦略を実装しています。

## 概要

| ドメイン | ライブラリ | 配置場所 |
|----------|-----------|----------|
| **Frontend (Server)** | Pino | `frontend/packages/logger/server/` |
| **Frontend (Client)** | loglevel | `frontend/packages/logger/client/` |
| **Backend-py** | structlog | `backend-py/app/src/infra/logging.py` |
| **Edge Functions** | 独自実装 | `supabase/functions/shared/logger/` |

## 共通仕様

### ログレベル

全ドメインで共通のログレベルを使用：

| Level | 用途 |
|-------|------|
| `trace` | 最詳細デバッグ（開発時のみ） |
| `debug` | デバッグ情報 |
| `info` | 一般的な情報（デフォルト） |
| `warn` | 警告 |
| `error` | エラー |
| `silent` | ログ出力なし |

### 環境変数

| 環境変数 | ドメイン | 用途 | デフォルト |
|----------|---------|------|-----------
| `LOG_LEVEL` | Backend-py, Edge Functions | ログレベル | `info` |
| `LOG_FORMAT` | Backend-py, Edge Functions | 出力形式 | `pretty`(開発) / `json`(本番) |
| `NEXT_PUBLIC_LOG_LEVEL` | Frontend Client | ログレベル | `warn`(本番) / `debug`(開発) |

### 出力形式

| 環境 | 形式 | 特徴 |
|------|------|------|
| 開発 | Pretty (カラー) | 人間が読みやすい |
| 本番 | JSON | 機械可読、ログ集約対応 |

---

## Frontend Logger

### Server Component / Route Handler

```typescript
import { serverLogger, createRequestLogger, createLogger } from '@workspace/logger/server'

// 基本的な使用
serverLogger.info('Application started')

// リクエストスコープのロガー
const logger = createRequestLogger('req-123', 'user-456')
logger.info('Request started')

// カスタムコンテキスト
const paymentLogger = createLogger({ service: 'payment', traceId: 'abc-123' })
paymentLogger.info('Payment processing')
```

### Client Component

```typescript
import { clientLogger, createLogger, setLevel } from '@workspace/logger/client'

// 基本的な使用
clientLogger.info('Component mounted')

// 子ロガー（コンテキスト継承）
const logger = clientLogger.child({ component: 'UserProfile' })
logger.debug('Profile loaded', { userId: '123' })

// カスタムロガー
const featureLogger = createLogger({ feature: 'checkout' })
featureLogger.info('Checkout started')

// 動的にログレベルを変更（デバッグ時）
setLevel('debug')
```

---

## Backend-py Logger

### 基本的な使用

```python
from infra.logging import get_logger

logger = get_logger(__name__)
logger.info("Processing request", user_id="user_1", action="login")
logger.error("Failed to process", error=str(e))
```

### 初期化（app.py）

```python
from infra.logging import configure_logging

# アプリケーション起動時に設定
configure_logging()
```

### 構造化ログ

```python
logger = get_logger("payment")

# 構造化ログ出力
logger.info(
    "Payment completed",
    order_id="order-123",
    amount=1000,
    currency="JPY",
    processing_time_ms=150,
)
```

---

## Edge Functions Logger

### 基本的な使用

```typescript
import { createFunctionLogger } from "../shared/logger/index.ts"

const logger = createFunctionLogger("onesignal-webhooks")

// 基本的なログ
logger.info("Received webhook", { eventType: "notification.delivered" })
logger.error("Processing failed", { error: errorMessage })
```

### 子ロガー（コンテキスト継承）

```typescript
const logger = createFunctionLogger("polar-webhooks")

// ハンドラーごとに子ロガーを作成
const orderLogger = logger.child({ handler: "order" })
orderLogger.info("Processing order", { orderId: "ord-123" })
```

---

## ベストプラクティス

### 1. 子ロガー（`child()`）でコンテキストを継承

```typescript
// ❌ Bad: コンテキストを毎回指定
logger.info("Started", { userId: "123", feature: "checkout" })
logger.info("Processing", { userId: "123", feature: "checkout" })
logger.info("Completed", { userId: "123", feature: "checkout" })

// ✅ Good: 子ロガーでコンテキストを継承
const checkoutLogger = logger.child({ userId: "123", feature: "checkout" })
checkoutLogger.info("Started")
checkoutLogger.info("Processing")
checkoutLogger.info("Completed")
```

### 2. 適切なログレベルの選択

| シナリオ | レベル |
|---------|--------|
| アプリケーション起動 | `info` |
| リクエスト開始/終了 | `info` |
| 詳細なデバッグ情報 | `debug` |
| 変数の中身の確認 | `trace` |
| 警告（続行可能） | `warn` |
| エラー（要対応） | `error` |

### 3. 構造化ログで検索可能に

```typescript
// ❌ Bad: 文字列連結
logger.error(`Failed to process order ${orderId} for user ${userId}`)

// ✅ Good: 構造化ログ
logger.error("Failed to process order", { orderId, userId, error: err.message })
```

### 4. センシティブ情報をログしない

```typescript
// ❌ Bad: パスワード・トークンをログ
logger.info("User login", { password, accessToken })

// ✅ Good: センシティブ情報を除外
logger.info("User login", { userId, email })
```
