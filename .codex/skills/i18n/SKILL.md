---
name: i18n
description: next-intl internationalization guidance. Use for getTranslations/useTranslations usage, ICU Message Format, datetime formatting, and message file structure.
---

# Internationalization (next-intl)

**MANDATORY**: All user-facing text MUST be internationalized.

## Core Rules

### 1. No Hardcoded Text

```typescript
// PROHIBITED
<Button>Save</Button>
<p>Welcome to our app</p>

// REQUIRED
<Button>{t('common.save')}</Button>
<p>{t('HomePage.welcome')}</p>
```

### 2. Both Languages Required

When adding new text, you MUST add to **BOTH** files:
- `src/shared/config/i18n/messages/en.json`
- `src/shared/config/i18n/messages/ja.json`

## Translation Functions

| Component Type | Function | Import |
|----------------|----------|--------|
| Server Component | `getTranslations()` | `next-intl/server` |
| Client Component | `useTranslations()` | `next-intl` |

### Server Component Example

```typescript
import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('HomePage')
  return <h1>{t('title')}</h1>
}
```

### Client Component Example

```typescript
'use client'
import { useTranslations } from 'next-intl'

export function Button() {
  const t = useTranslations('common')
  return <button>{t('save')}</button>
}
```

## Message File Structure

```json
// en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "HomePage": {
    "title": "Welcome",
    "description": "Your dashboard"
  }
}

// ja.json
{
  "common": {
    "save": "保存",
    "cancel": "キャンセル"
  },
  "HomePage": {
    "title": "ようこそ",
    "description": "ダッシュボード"
  }
}
```

## ICU Message Format

### Interpolation

```json
{
  "greeting": "Hello, {name}!"
}
```

```typescript
t('greeting', { name: 'John' }) // "Hello, John!"
```

### Pluralization

```json
{
  "items": "{count, plural, =0 {No items} one {# item} other {# items}}"
}
```

```typescript
t('items', { count: 0 })  // "No items"
t('items', { count: 1 })  // "1 item"
t('items', { count: 5 })  // "5 items"
```

## DateTime Formatting

```typescript
import { useFormatter } from 'next-intl'

function DateDisplay({ date }: { date: Date }) {
  const format = useFormatter()

  return (
    <time>
      {format.dateTime(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </time>
  )
}
```

## Enforcement

**DO NOT merge code with hardcoded user-facing text.**

- NO hardcoded strings in UI components
- NO adding text to only one language file
- ALWAYS use translation functions
- ALWAYS add to both en.json and ja.json
