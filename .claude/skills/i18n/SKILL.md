---
name: i18n
description: next-intl による多言語対応ガイダンス。getTranslations/useTranslations の使い方、ICU Message Format、日時フォーマット、メッセージファイル構造についての質問に使用。Server/Client Component での実装支援を提供。
---

# next-intl 多言語対応スキル

このプロジェクトは **next-intl** を使用して多言語対応を実現しています。

## 設定

| 項目 | 値 |
|------|-----|
| **ライブラリ** | next-intl |
| **対応言語** | `en` (English), `ja` (日本語) |
| **デフォルト** | `en` |
| **メッセージ** | `src/shared/config/i18n/messages/{locale}.json` |
| **ルーティング** | `src/shared/config/i18n/routing.ts` |

## Server Component での使用

```typescript
// Server Component（async 関数、'use client' なし）
import { getTranslations } from 'next-intl/server'

export default async function HomePage() {
  const t = await getTranslations('HomePage')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  )
}
```

## Client Component での使用

```typescript
'use client'

import { useTranslations } from 'next-intl'

export function LoginForm() {
  const t = useTranslations('auth')

  return (
    <form>
      <Label>{t('emailLabel')}</Label>
      <Input placeholder={t('emailPlaceholder')} />
      <Button>{t('submitButton')}</Button>
    </form>
  )
}
```

## メッセージファイル構造

名前空間（コンポーネント/機能名）で整理：

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success"
  },
  "navigation": {
    "home": "Home",
    "about": "About",
    "settings": "Settings"
  },
  "HomePage": {
    "title": "Welcome!",
    "description": "Get started by editing the page."
  },
  "auth": {
    "emailLabel": "Email Address",
    "passwordLabel": "Password",
    "submitButton": "Sign In",
    "forgotPassword": "Forgot password?"
  }
}
```

## ICU Message Format

### 変数の埋め込み

```json
{
  "greeting": "Hello, {name}!",
  "welcome": "Welcome back, {userName}. You have {count} notifications."
}
```

```typescript
t('greeting', { name: 'John' })
// → "Hello, John!"

t('welcome', { userName: 'Alice', count: 5 })
// → "Welcome back, Alice. You have 5 notifications."
```

### 複数形（Plural）

```json
{
  "itemCount": "{count, plural, =0 {No items} one {1 item} other {# items}}",
  "messageCount": "{count, plural, =0 {メッセージなし} other {#件のメッセージ}}"
}
```

```typescript
t('itemCount', { count: 0 })  // → "No items"
t('itemCount', { count: 1 })  // → "1 item"
t('itemCount', { count: 5 })  // → "5 items"
```

### 選択（Select）

```json
{
  "locale": "{locale, select, en {English} ja {日本語} other {Unknown}}",
  "gender": "{gender, select, male {He} female {She} other {They}}"
}
```

```typescript
t('locale', { locale: 'ja' })  // → "日本語"
```

## 日時フォーマット

### useFormatter（Client Component）

```typescript
'use client'

import { useFormatter } from 'next-intl'

export function DateDisplay({ date }: { date: string }) {
  const format = useFormatter()
  const dateObj = new Date(date)

  return (
    <time dateTime={date}>
      {format.dateTime(dateObj, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}
    </time>
  )
}
```

### 相対時間

```typescript
const format = useFormatter()

format.relativeTime(new Date('2024-01-01'))
// → "3 months ago" (en) / "3ヶ月前" (ja)
```

### 数値フォーマット

```typescript
const format = useFormatter()

format.number(1234567.89, { style: 'currency', currency: 'JPY' })
// → "¥1,234,568" (ja) / "¥1,234,568" (en)

format.number(0.456, { style: 'percent' })
// → "46%" (en) / "46%" (ja)
```

## ナビゲーション

### Link コンポーネント

```typescript
import { Link } from '@/shared/lib/i18n/navigation'

// 現在のロケールを維持してリンク
<Link href="/about">About</Link>

// ロケールを指定してリンク
<Link href="/" locale="ja">日本語</Link>
```

### useRouter

```typescript
'use client'

import { useRouter } from '@/shared/lib/i18n/navigation'

export function NavigationButton() {
  const router = useRouter()

  const handleClick = () => {
    router.push('/dashboard')
  }

  return <Button onClick={handleClick}>Go to Dashboard</Button>
}
```

## 新規テキスト追加の手順

1. **名前空間を決める**: コンポーネント名または機能名
2. **両言語ファイルに追加**:

```bash
# en.json
{
  "NewFeature": {
    "title": "New Feature",
    "description": "This is a new feature."
  }
}

# ja.json
{
  "NewFeature": {
    "title": "新機能",
    "description": "これは新機能です。"
  }
}
```

3. **コンポーネントで使用**:

```typescript
const t = useTranslations('NewFeature')
// または
const t = await getTranslations('NewFeature')
```

## ベストプラクティス

1. **名前空間の一貫性**: コンポーネント名と合わせる
2. **キー名は説明的に**: `button` より `submitButton`
3. **共通テキストは `common`**: 再利用するテキストは `common` 名前空間
4. **日時は ISO 文字列**: props で渡す日時は `toISOString()` 形式
5. **フォーマッターを使用**: 数値・日時は `useFormatter()` を使う
