# DateTime Handling Policy

**MANDATORY**: すべての日時処理は以下のルールに従う。

## 基本原則

| レイヤー | タイムゾーン | 形式 |
|---------|------------|------|
| **Database (DynamoDB)** | UTC | ISO 8601 文字列（`AWSDateTime`） |
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

## Database Layer (Amplify Data / DynamoDB)

**MUST**: 日時フィールドは `a.datetime()`（GraphQL の `AWSDateTime`）を使う。`AWSDateTime` は
ISO 8601（タイムゾーンオフセット付き）で保存・検証されるため、UTC（`Z`）で統一する。

```typescript
// ✅ CORRECT: a.datetime() を使う（AWSDateTime = ISO 8601 / TZ オフセット必須）
const schema = a.schema({
  Event: a
    .model({
      title: a.string().required(),
      scheduledAt: a.datetime(), // "2025-01-15T10:30:00.000Z"
    })
    .authorization((allow) => [allow.owner()]),
})

// ❌ WRONG: 文字列でタイムゾーンなしの値を保存する
scheduledAt: a.string() // 形式・TZ が検証されずデータ不整合の温床
```

**理由**: `AWSDateTime` はタイムゾーンオフセットを必須とするため、UTC（`Z`）で統一すればデータ損失や
TZ 取り違えを防げる。`createdAt` / `updatedAt` は Amplify Data が自動で UTC ISO 8601 として付与する。

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
- TZ オフセットなしの文字列を `AWSDateTime`（`a.datetime()`）フィールドに保存
- Pythonで `datetime.now()` をタイムゾーン指定なしで使用
- バックエンド/APIでローカルタイムゾーンを使用

## なぜUTCで統一するか

1. **データ整合性**: 異なるタイムゾーンのユーザーでも同じ瞬間を正確に表現
2. **計算の容易さ**: 時間差の計算がシンプル
3. **DST問題の回避**: 夏時間の変更による混乱を防止
4. **AWSDateTime 準拠**: AppSync の `AWSDateTime` は ISO 8601（TZ オフセット必須）であり UTC（`Z`）で統一できる
5. **責務の明確化**: フロントエンドのみがタイムゾーン変換を担当

## 参照

- 詳細な実装例: `.claude/skills/datetime/SKILL.md`
- [AWS AppSync スカラー型（AWSDateTime）](https://docs.aws.amazon.com/appsync/latest/devguide/scalars.html)
- [Amplify Data モデリング](https://docs.amplify.aws/nextjs/build-a-backend/data/data-modeling/)
