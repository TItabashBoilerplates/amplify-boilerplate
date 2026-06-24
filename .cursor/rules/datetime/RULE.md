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

## Database (Drizzle)

```typescript
// CORRECT: withTimezone: true
timestamp('created_at', { withTimezone: true })

// WRONG: タイムゾーン情報が失われる
timestamp('created_at')
```

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

