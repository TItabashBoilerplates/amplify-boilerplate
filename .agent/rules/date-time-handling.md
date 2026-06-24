# Date and Time Handling (Amplify Data + Database Best Practices)

Essential principles and best practices for date and time handling:

## Database Configuration

### 1. Amplify Data Schema (AppSync + DynamoDB)

- Use `a.datetime()` for all datetime fields. This maps to the GraphQL `AWSDateTime` scalar.
- `AWSDateTime` is an extended ISO 8601 date-time string with a required timezone offset.
- `createdAt` / `updatedAt` are added automatically by Amplify Data as UTC ISO 8601 strings.

### 2. AWSDateTime / UTC

- Store and validate all datetime values as UTC (`Z`) ISO 8601 strings.
- Because `AWSDateTime` requires a timezone offset, standardizing on UTC prevents timezone mix-ups.
- Treat all datetime data as UTC for consistency across backend, API, and storage.

## Client Implementation Principles

### 1. Process in Client Components

- Always display and format dates in Client Components (`'use client'`)
- Do not format dates in Next.js Server Components
- Prevents hydration errors from SSR and client timezone mismatches

### 2. When Saving to the Database

- Convert JavaScript `Date` objects to ISO 8601 format with `toISOString()`
- The `AWSDateTime` field stores the value as UTC
- Do not use `Date.now()` (Unix timestamps will error against `AWSDateTime`)

### 3. When Displaying to the Client

- Always convert to client's timezone when displaying
- Use `Intl.DateTimeFormat` (respects browser timezone settings)
- Libraries like date-fns or dayjs can also be used

## Next.js SSR/CSR Hydration Strategies

Next.js official documentation states that using time-dependent APIs like the `Date()` constructor can cause hydration errors. Handle this as follows:

### Important Prerequisites

1. **Client Components still execute initial rendering (SSR) on the server**
   - Even with `'use client'`, the first render happens on the server
   - Client-side hydration (re-rendering) occurs afterward
   - Different results between server and client cause hydration errors

2. **Always execute browser API processing inside `useEffect`**
   - Use browser APIs like `Intl.DateTimeFormat().resolvedOptions().timeZone` inside `useEffect`
   - `useEffect` only runs on the client, avoiding SSR mismatches

3. **Server→Client Component props must be serializable values only**
   - `Date` objects are not serializable, so pass ISO strings (`string`)
   - Convert with `toISOString()` before passing

4. **Always perform timezone conversion on the client**
   - Server (UTC) and client (local timezone) produce different results
   - Execute timezone conversion inside `useEffect`

5. **Recommended Pattern: Using `useEffect`** (most reliable)
   - Use semantic `<time>` element
   - Display empty string or placeholder on initial render
   - Update state with client-side timezone conversion in `useEffect`
   - Add `suppressHydrationWarning` only when rendering different content between server and client

6. **Alternative Pattern 1: Dynamic Import with SSR Disabled**:
   ```typescript
   import dynamic from "next/dynamic";

   const DateDisplay = dynamic(() => import("./DateDisplay"), {
     ssr: false,
     loading: () => <time>Loading...</time>,
   });
   ```

7. **Alternative Pattern 2: Using next-intl** (for internationalized apps)
   - `useNow()` / `getNow()` for stable time retrieval
   - Consistent time handling between server and client

8. **Cookie-Based Optimization** (optional)
   - Save timezone in cookie for subsequent visits
   - Use default timezone (UTC or regional default) on first visit

### Important Notes

- `suppressHydrationWarning` may prevent re-rendering in App Router, so mainly use for static datetime attributes
- Prefer `useEffect` pattern for dynamically changing content
- Next.js official documentation: https://nextjs.org/docs/messages/react-hydration-error

## Implementation Examples

### ✅ Good: Recommended Pattern - Client Component with useEffect

```typescript
"use client";

import { useEffect, useState } from "react";

interface DateDisplayProps {
  utcDate: string; // Must receive as ISO string (Date objects are not serializable)
  className?: string;
}

export function DateDisplay({ utcDate, className }: DateDisplayProps) {
  const [formattedDate, setFormattedDate] = useState<string>("");
  const [isoDate, setIsoDate] = useState<string>("");

  useEffect(() => {
    // Execute all datetime processing inside useEffect (uses browser APIs)
    const date = new Date(utcDate);

    // ISO format (for datetime attribute)
    setIsoDate(date.toISOString());

    // Format in user's timezone (uses browser API)
    const formatted = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(date);
    setFormattedDate(formatted);
  }, [utcDate]);

  // Display empty on initial render to prevent hydration errors
  // SSR shows empty string, useEffect runs on client to set value
  if (!formattedDate) {
    return <time className={className}>Loading...</time>;
  }

  return (
    <time dateTime={isoDate} className={className}>
      {formattedDate}
    </time>
  );
}

// Using from Server Component
// app/page.tsx
import { DateDisplay } from "@/components/DateDisplay";

export default async function Page() {
  // Convert Date object from data layer to ISO string
  const eventDate = new Date("2025-01-15T10:30:00Z");

  return (
    <div>
      {/* Must pass as ISO string */}
      <DateDisplay utcDate={eventDate.toISOString()} />
    </div>
  );
}
```

### ✅ Good: Dynamic Import with SSR Disabled (Alternative Pattern)

```typescript
// app/page.tsx
import dynamic from "next/dynamic";

const DateDisplay = dynamic(() => import("@/components/DateDisplay"), {
  ssr: false,
  loading: () => <time>Loading...</time>,
});

export default function Page() {
  return <DateDisplay utcDate="2025-01-15T10:30:00Z" />;
}
```

### ✅ Good: Using next-intl (for internationalized apps)

```typescript
"use client";

import { useFormatter, useNow } from "next-intl";

export function InternationalizedDateDisplay({ utcDate }: { utcDate: string }) {
  const format = useFormatter();
  const now = useNow(); // Consistent time between server and client
  const date = new Date(utcDate); // Convert ISO string to Date object

  return (
    <time dateTime={utcDate}>
      {format.dateTime(date, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </time>
  );
}
```

### ✅ Good: Saving to Amplify Data

```typescript
import { getDataClient } from "@workspace/data-client";

const saveEvent = async (eventDate: Date) => {
  await getDataClient().models.Event.create({
    // Save as UTC in ISO 8601 format → AWSDateTime
    scheduledAt: eventDate.toISOString(),
  });
};
```

### ✅ Good: Saving from User Input

```typescript
import { getDataClient } from "@workspace/data-client";

const saveEventFromUserInput = async (
  year: number,
  month: number,
  day: number
) => {
  // Create Date object in user's local timezone
  const userDate = new Date(year, month - 1, day);

  // Convert to UTC with toISOString() and save
  await getDataClient().models.Event.create({
    scheduledAt: userDate.toISOString(),
  });
};
```

### ❌ Bad: Passing Date Object as Props (Not Serializable)

```typescript
export default function BadPage() {
  const eventDate = new Date("2025-01-15T10:30:00Z");
  // Date objects cannot be serialized, will error
  return <DateDisplay utcDate={eventDate} />;
}
```

### ❌ Bad: Timezone Conversion in Server Component

```typescript
export function ServerDateDisplay({ utcDate }: { utcDate: string }) {
  // Localizing on server side means different timezone from client
  // Causes hydration errors
  const formatted = new Date(utcDate).toLocaleString("en-US");
  return <time>{formatted}</time>;
}
```

### ❌ Bad: Using Browser API Outside useEffect

```typescript
"use client";
export function BadClientDateDisplay({ utcDate }: { utcDate: string }) {
  // Intl.DateTimeFormat().resolvedOptions() is a browser API
  // May be undefined during SSR
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatted = new Date(utcDate).toLocaleString("en-US", {
    timeZone: timezone,
  });
  return <time>{formatted}</time>;
}
```

### ❌ Bad: Using Date.now()

```typescript
const badSave = async () => {
  await getDataClient().models.Event.create({
    scheduledAt: Date.now(), // Error: Unix timestamp not accepted by AWSDateTime
  });
};
```

## Amplify Data Schema Example

```typescript
// frontend/packages/backend/amplify/data/resource.ts
import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Event: a
    .model({
      title: a.string().required(),
      // Event datetime (UTC ISO 8601 → AWSDateTime)
      scheduledAt: a.datetime(), // "2025-01-15T10:30:00.000Z"
      // createdAt / updatedAt are added automatically as UTC ISO 8601
    })
    .authorization((allow) => [allow.owner()]),
});
```

## Key Points

- **Consistency**: data layer always UTC, user timezone only when displaying
- **AWSDateTime**: `a.datetime()` enforces ISO 8601 with a timezone offset; standardize on UTC (`Z`)
- **Hydration**: Handle datetime in Client Components
- **ISO 8601**: Convert to standard format with `toISOString()`
- **Type Safety**: `Schema` types are generated from the Amplify Data schema

This implementation prevents timezone-related bugs and hydration errors, enabling consistent datetime handling even in global applications.

## References

- [AWS AppSync scalar types (AWSDateTime)](https://docs.aws.amazon.com/appsync/latest/devguide/scalars.html)
- [Amplify Data modeling](https://docs.amplify.aws/nextjs/build-a-backend/data/data-modeling/)
