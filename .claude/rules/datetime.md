# DateTime Handling Policy

**MANDATORY**: すべての日時処理は以下のルールに従う。

## 基本原則

| レイヤー | タイムゾーン | 形式 |
|---------|------------|------|
| **Database** | UTC | `TIMESTAMP WITH TIME ZONE` |
| **Backend** | UTC | ISO 8601 文字列 |
| **API Request/Response** | UTC | ISO 8601 文字列 |
| **Frontend** | 入出力時にUTC⇔ローカル変換 | `Date.toISOString()` / `Intl.DateTimeFormat` |

## タイムゾーン変換の責務

**フロントエンドが全責務を持つ**

```
【入力フロー】
ユーザー入力(ローカルTZ) → フロントでUTC変換 → API送信(UTC) → DB保存(UTC)

【出力フロー】
DB取得(UTC) → API応答(UTC) → フロントでローカルTZ変換 → 表示
```

## Database Layer (Drizzle)

**MUST**: すべてのタイムスタンプ列に `withTimezone: true` を指定。

```typescript
// ✅ CORRECT
timestamp('created_at', { withTimezone: true, precision: 3 })
  .notNull()
  .defaultNow()

// ❌ WRONG: タイムゾーン情報が失われる
timestamp('created_at').notNull().defaultNow()
```

**理由**: `timestamp`（without timezone）はタイムゾーン情報を破棄し、データ損失が発生する。

## Backend Layer (Python)

**MUST**: `datetime.now(UTC)` を使用し、明示的にUTCを指定。

```python
from datetime import UTC, datetime

# ✅ CORRECT
created_at = datetime.now(UTC)

# ❌ WRONG: ローカルタイムゾーンが使用される
created_at = datetime.now()
```

## API Response

**MUST**: ISO 8601形式のUTC文字列で返却。

```json
{
  "created_at": "2025-01-15T10:30:00.000Z"
}
```

## Frontend Layer

### 入力時: ローカル → UTC変換

**MUST**: API送信前にUTC（ISO 8601形式）に変換。

```typescript
// ✅ CORRECT: ローカル入力をUTCに変換してAPI送信
const handleSubmit = async (localDateTime: Date) => {
  const utcString = localDateTime.toISOString() // "2025-01-15T10:00:00.000Z"

  await fetch('/api/events', {
    method: 'POST',
    body: JSON.stringify({ scheduled_at: utcString }),
  })
}

// DatePickerからの入力例
const onDateSelect = (date: Date) => {
  // DatePickerはローカルタイムゾーンのDateを返す
  // toISOString()で自動的にUTCに変換される
  setScheduledAt(date.toISOString())
}
```

### 出力時: UTC → ローカル変換

**MUST**: Client Componentの `useEffect` 内でのみタイムゾーン変換を実行。

```typescript
'use client'

export function DateDisplay({ utcDate }: { utcDate: string }) {
  const [formatted, setFormatted] = useState('')

  useEffect(() => {
    const date = new Date(utcDate)
    setFormatted(
      new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).format(date)
    )
  }, [utcDate])

  if (!formatted) return <time>Loading...</time>
  return <time dateTime={utcDate}>{formatted}</time>
}
```

## 禁止事項

**NEVER**:
- Server Componentで `toLocaleString()` を使用（ハイドレーションエラーの原因）
- `Date` オブジェクトをprops経由でシリアライズ
- useEffect外でブラウザのタイムゾーンAPIを使用
- `timestamp`（without timezone）をDrizzleスキーマで使用
- Pythonで `datetime.now()` をタイムゾーン指定なしで使用
- バックエンド/APIでローカルタイムゾーンを使用

## なぜUTCで統一するか

1. **データ整合性**: 異なるタイムゾーンのユーザーでも同じ瞬間を正確に表現
2. **計算の容易さ**: 時間差の計算がシンプル
3. **DST問題の回避**: 夏時間の変更による混乱を防止
4. **Supabaseデフォルト**: Supabaseは全データベースをUTCで設定
5. **責務の明確化**: フロントエンドのみがタイムゾーン変換を担当

## 参照

- 詳細な実装例: `.claude/skills/datetime/SKILL.md`
- [PostgreSQL Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [Supabase Database Configuration](https://supabase.com/docs/guides/database/postgres/configuration)
