---
name: datetime
description: DateTime handling guidance for Next.js + Supabase. Use for hydration error prevention, timezone conversion, ISO 8601 format, and useEffect patterns.
---

# DateTime Handling

## Core Principle

| Layer | Timezone | Format |
|-------|----------|--------|
| **Database** | UTC | `TIMESTAMP WITH TIME ZONE` |
| **Backend** | UTC | ISO 8601 string |
| **API Request/Response** | UTC | ISO 8601 string |
| **Frontend** | Convert UTC ⇔ Local on I/O | `toISOString()` / `Intl.DateTimeFormat` |

**Frontend is responsible for all timezone conversions.**

## Database Layer (Drizzle)

**MUST**: Specify `withTimezone: true` for all timestamp columns.

```typescript
// CORRECT
timestamp('created_at', { withTimezone: true, precision: 3 })
  .notNull()
  .defaultNow()

// WRONG: Timezone info is lost
timestamp('created_at').notNull().defaultNow()
```

## Backend Layer (Python)

**MUST**: Use `datetime.now(UTC)` with explicit UTC.

```python
from datetime import UTC, datetime

# CORRECT
created_at = datetime.now(UTC)

# WRONG: Local timezone used
created_at = datetime.now()
```

## Frontend - Input (Local → UTC)

**MUST**: Convert to UTC (ISO 8601) before API submission.

```typescript
// CORRECT: Convert local input to UTC for API
const handleSubmit = async (localDateTime: Date) => {
  const utcString = localDateTime.toISOString() // "2025-01-15T10:00:00.000Z"

  await fetch('/api/events', {
    method: 'POST',
    body: JSON.stringify({ scheduled_at: utcString }),
  })
}
```

## Frontend - Output (UTC → Local)

**MUST**: Execute timezone conversion ONLY inside `useEffect` in Client Components.

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

## Prohibited Patterns

**NEVER**:
- Use `toLocaleString()` in Server Components (causes hydration errors)
- Serialize `Date` objects via props
- Use browser timezone APIs outside useEffect
- Use `timestamp` without timezone in Drizzle schema
- Use `datetime.now()` without timezone in Python

## Why UTC?

1. **Data Integrity**: Same moment accurately represented for users in different timezones
2. **Easy Calculations**: Time difference calculations are simple
3. **DST Avoidance**: Prevents daylight saving time confusion
4. **Supabase Default**: Supabase configures all databases in UTC
5. **Clear Responsibility**: Only frontend handles timezone conversion
