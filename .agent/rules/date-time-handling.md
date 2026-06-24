# Date and Time Handling (Supabase + Database Best Practices)

Essential principles and best practices for date and time handling:

## Database Configuration

### 1. Drizzle Schema

- Use `timestamp` with `withTimezone: true` and `precision: 3` for all datetime columns
- Maps to PostgreSQL's `TIMESTAMP WITH TIME ZONE` type
- Millisecond precision (3) is fully compatible with JavaScript `Date` objects

### 2. Supabase/PostgreSQL

- Database timezone is maintained as UTC (Supabase default)
- Data inserted with timezone is internally stored as UTC
- Treat all datetime data as UTC for consistency

## Client Implementation Principles

### 1. Process in Client Components

- Always display and format dates in Client Components (`'use client'`)
- Do not format dates in Next.js Server Components
- Prevents hydration errors from SSR and client timezone mismatches

### 2. When Saving to Database

- Convert JavaScript `Date` objects to ISO 8601 format with `toISOString()`
- Database automatically stores as UTC
- Do not use `Date.now()` (Unix timestamps will error)

### 3. When Displaying to Client

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
  // Convert Date object from DB to ISO string
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

### ✅ Good: Saving to Supabase

```typescript
const saveEvent = async (eventDate: Date) => {
  await supabase.from("events").insert({
    event_date: eventDate.toISOString(), // Save as UTC in ISO 8601 format
  });
};
```

### ✅ Good: Saving from User Input

```typescript
const saveEventFromUserInput = async (
  year: number,
  month: number,
  day: number
) => {
  // Create Date object in user's local timezone
  const userDate = new Date(year, month - 1, day);

  // Convert to UTC with toISOString() and save
  await supabase.from("events").insert({
    event_date: userDate.toISOString(),
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
  await supabase.from("events").insert({
    event_date: Date.now(), // Error: Unix timestamp not accepted
  });
};
```

## Drizzle Schema Example

```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // Event datetime (UTC, millisecond precision)
  eventDate: timestamp("event_date", {
    withTimezone: true,
    precision: 3,
  }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    precision: 3,
  })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});
```

## Key Points

- **Consistency**: DB always UTC, user timezone only when displaying
- **Precision**: `timestamptz(3)` ensures millisecond precision
- **Hydration**: Handle datetime in Client Components
- **ISO 8601**: Convert to standard format with `toISOString()`
- **Type Safety**: Auto-generate types with Supabase CLI

This implementation prevents timezone-related bugs and hydration errors, enabling consistent datetime handling even in global applications.
