---
description: "DateTime handling policy: UTC storage and frontend timezone conversion"
alwaysApply: false
globs: ["**/*.ts", "**/*.tsx", "**/*.py"]
---
# DateTime Handling Policy

**MANDATORY**: 日時はUTCで保存し、フロントエンドでタイムゾーン変換。

## 基本原則

| レイヤー | タイムゾーン | 形式 |
|---------|------------|------|
| Database | UTC | `TIMESTAMP WITH TIME ZONE` |
| Backend | UTC | ISO 8601 |
| API | UTC | ISO 8601 |
| Frontend | 表示時にローカル変換 | `Intl.DateTimeFormat` |

## Database (Amplify Data / DynamoDB)

```typescript
// CORRECT: a.datetime() = AWSDateTime（ISO 8601 / TZ オフセット必須）
scheduledAt: a.datetime()

// WRONG: 形式も TZ も検証されずデータ不整合の温床になる
scheduledAt: a.string()
```

`createdAt` / `updatedAt` は Amplify Data が UTC ISO 8601 で自動付与するので定義しない。

## Backend (Python)

```python
# CORRECT
from datetime import UTC, datetime
created_at = datetime.now(UTC)

# WRONG
created_at = datetime.now()
```

## Frontend

- 入力: `toISOString()` でUTC変換
- 出力: `useEffect` 内で `Intl.DateTimeFormat` 使用

