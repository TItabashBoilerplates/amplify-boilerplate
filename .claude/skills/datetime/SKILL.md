---
name: datetime
description: Next.js + Amplify Data での日時処理ガイダンス。ハイドレーションエラー対策、タイムゾーン変換、ISO 8601形式、useEffect パターンについての質問に使用。SSR/CSR での日時表示の実装支援を提供。
---

# 日時処理スキル

Next.js + Amplify Data（AppSync + DynamoDB）での日時処理のベストプラクティスを提供します。

## 基本原則

| 場所 | タイムゾーン | 形式 |
|------|------------|------|
| **データベース（DynamoDB）** | UTC | `AWSDateTime`（ISO 8601 / TZ オフセット必須） |
| **サーバー** | UTC | ISO 8601 文字列 |
| **クライアント表示** | ユーザーのローカル | `Intl.DateTimeFormat` |

## ハイドレーションエラーの原因

1. Server Component でタイムゾーン変換するとサーバー/クライアントで結果が異なる
2. `Date` オブジェクトは props でシリアライズ不可
3. `new Date()` はサーバーとクライアントで異なる結果を返す

## 推奨パターン: useEffect を使用

```typescript
'use client'
import { useEffect, useState } from 'react'

interface DateDisplayProps {
  utcDate: string  // 必ず ISO 文字列で受け取る
  className?: string
}

export function DateDisplay({ utcDate, className }: DateDisplayProps) {
  const [formatted, setFormatted] = useState<string>('')

  useEffect(() => {
    const date = new Date(utcDate)
    const result = new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(date)
    setFormatted(result)
  }, [utcDate])

  if (!formatted) return <time className={className}>読み込み中...</time>

  return (
    <time dateTime={utcDate} className={className}>
      {formatted}
    </time>
  )
}
```

## Server Component からの使用

```typescript
// Server Component
export default async function Page() {
  const eventDate = new Date('2025-01-15T10:30:00Z')

  return (
    <div>
      {/* 必ず ISO 文字列で渡す */}
      <DateDisplay utcDate={eventDate.toISOString()} />
    </div>
  )
}
```

## 代替パターン: Dynamic Import

```typescript
import dynamic from 'next/dynamic'

const DateDisplay = dynamic(() => import('@/components/DateDisplay'), {
  ssr: false,
  loading: () => <time>読み込み中...</time>,
})
```

## Amplify Data へのデータ保存

```typescript
import { getDataClient } from '@workspace/data-client'

// ✅ 正しい: ISO 8601 形式（AWSDateTime）で保存
const saveEvent = async (eventDate: Date) => {
  await getDataClient().models.Event.create({
    eventDate: eventDate.toISOString(),  // "2025-01-15T10:30:00.000Z"
  })
}

// ❌ 間違い: Unix タイムスタンプ（AWSDateTime のバリデーションで弾かれる）
await getDataClient().models.Event.create({
  eventDate: Date.now(),  // 数値は AWSDateTime として不正
})
```

## Amplify Data Schema での定義

日時フィールドは `a.datetime()`（GraphQL の `AWSDateTime`）を使う。`AWSDateTime` は
ISO 8601（タイムゾーンオフセット必須）で保存・検証されるため、常に UTC（`Z`）で統一する。
`createdAt` / `updatedAt` は Amplify Data が自動で UTC ISO 8601 として付与する。

```typescript
// frontend/packages/backend/amplify/data/resource.ts
import { a } from '@aws-amplify/backend'

const schema = a.schema({
  Event: a
    .model({
      eventDate: a.datetime().required(), // AWSDateTime: "2025-01-15T10:30:00.000Z"
      // createdAt / updatedAt は自動付与（UTC ISO 8601）
    })
    .authorization((allow) => [allow.owner()]),
})
```

## 禁止パターン

```typescript
// ❌ Server Component でローカライズ
export function ServerDateDisplay({ utcDate }: { utcDate: string }) {
  const formatted = new Date(utcDate).toLocaleString('ja-JP')
  return <time>{formatted}</time>  // ハイドレーションエラー
}

// ❌ Date オブジェクトを props で渡す
<DateDisplay utcDate={new Date()} />  // シリアライズ不可

// ❌ useEffect 外でブラウザ API を使用
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
```

## next-intl を使用する場合

```typescript
'use client'
import { useFormatter, useNow } from 'next-intl'

export function InternationalizedDateDisplay({ utcDate }: { utcDate: string }) {
  const format = useFormatter()
  const date = new Date(utcDate)

  return (
    <time dateTime={utcDate}>
      {format.dateTime(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </time>
  )
}
```

## チェックリスト

- [ ] Server → Client への props は ISO 文字列（`toISOString()`）
- [ ] タイムゾーン変換は `useEffect` 内で実行
- [ ] 初回レンダリングでは空またはプレースホルダーを表示
- [ ] データベース保存時は `toISOString()` を使用
- [ ] Amplify Data Schema で日時フィールドは `a.datetime()`（AWSDateTime）を使用
