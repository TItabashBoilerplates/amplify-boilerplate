# Supabase-First Architecture Policy

**MANDATORY**: Prioritize `supabase-js` / `@supabase/ssr` for all data operations. Backend services should be minimal.

## Decision Hierarchy (REQUIRED)

データ操作・バックエンド処理を実装する前に、必ず以下の順で評価すること:

1. **First**: `supabase-js` / `@supabase/ssr` でフロントエンドから直接実行できないか?
2. **Second（バックエンド処理が必要な場合の既定）**: **Edge Functions で実装できないか?**
   → バックエンド処理が必要になった時点で、まず Edge Functions を第一候補とする。
3. **Last Resort**: Edge Functions で実現困難な場合のみ `backend-py` を使用する。
   → 該当するのは **LLM / エージェント的処理 / 長時間処理 / 複雑な実装** のいずれかに明確に当てはまるケースのみ。

> **原則**: 「バックエンド = backend-py」ではない。**バックエンド処理の既定は Edge Functions**。backend-py は明確な escalation trigger を満たした場合にのみ選択する。

## When to Use Each Layer

### Frontend with supabase-js / @supabase/ssr (DEFAULT)

**USE for**:
- CRUD operations with RLS policies
- Real-time subscriptions
- Authentication flows
- File uploads to Supabase Storage
- Simple data queries and mutations
- Row-level security protected operations

```typescript
// ✅ Preferred: Direct Supabase client usage
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .eq('user_id', userId)
```

### Edge Functions (DEFAULT for backend work)

フロントエンドから直接実行できない処理は、**まず Edge Functions を検討する**。以下のいずれかに該当する場合は原則 Edge Functions で実装する:

**USE for**:
- Webhook handlers (Stripe, external services)
- `service_role` key を必要とする操作
- 外部 API 連携（単発・短時間で完結するもの）
- スケジュールタスク (cron)
- DB 書き込み前の軽量な前処理・バリデーション
- 短時間で完結するビジネスロジック（数秒以内）

```typescript
// ✅ 正: バックエンド処理は Edge Function で実装
const { data } = await supabase.functions.invoke('send-notification', {
  body: { userId, message }
})

// ❌ 誤: Edge Function で足りるのに backend-py にルーティング
const res = await fetch(`${BACKEND_PY_URL}/notify`, { ... })
```

### Backend Python (ESCALATION ONLY)

Edge Functions で実現が困難な、**以下のエスカレーション条件に明確に該当する場合のみ** `backend-py` を使用する:

| Trigger | 具体例 |
|---|---|
| **LLM 処理** | LangChain / LangGraph / Embeddings / RAG / Structured Output |
| **エージェント的処理** | マルチステップ推論、ツール呼び出しループ、HITL、time travel |
| **長時間処理** | Edge Function のタイムアウト（数十秒〜数分）を超える処理、バックグラウンドジョブ |
| **複雑な実装** | 複数テーブルにまたがるアトミックトランザクション、複雑なリトライ/リカバリ、Python 固有ライブラリ（pandas, numpy, ML 系）に依存する処理 |

```typescript
// ✅ 正: LLM エージェントは backend-py へ
const res = await apiClient.POST('/agents/chat', { body: { prompt } })

// ❌ 誤: 単純な CRUD や Webhook を backend-py に置く
// → supabase-js または Edge Functions を使うこと
```

**上記のいずれにも該当しない場合は backend-py を使用してはならない**。判断に迷う場合は勝手に決定せず、**必ずユーザーに判断をあおぐこと**。

## Prohibited Patterns

**NEVER**:
- Create backend endpoints for simple CRUD operations
- Use backend for operations that RLS can secure
- Build API wrappers around basic Supabase queries
- Add unnecessary backend layers "for security" when RLS suffices

```typescript
// ❌ Wrong: Unnecessary backend call for simple query
const response = await fetch('/api/posts')

// ✅ Correct: Direct Supabase query with RLS
const { data } = await supabase.from('posts').select('*')
```

## Justification Required

バックエンド実装を提案する際は、以下を明示すること:

1. なぜ `supabase-js` で実現できないか
2. なぜ Edge Functions で実現できないか（= `backend-py` を選ぶ理由）
3. どのエスカレーション条件（LLM / エージェント / 長時間 / 複雑）に該当するか
4. セキュリティまたはビジネスロジック上の制約

## Benefits of This Approach

- Reduced latency (no extra network hop)
- Lower infrastructure costs
- Simpler deployment and maintenance
- Built-in RLS security
- Real-time capabilities out of the box

---

## Storage Policy (MANDATORY)

### Default: Private Buckets

**ALWAYS use Private buckets** unless the user explicitly requests Public buckets.

```toml
# supabase/config.toml
[storage.buckets.documents]
public = false  # DEFAULT: Private
file_size_limit = "50MiB"
```

### File Access via createSignedUrl

Private buckets require signed URLs for file access:

```typescript
// ✅ Correct: Use createSignedUrl for private files
const { data } = await supabase.storage
  .from('documents')
  .createSignedUrl('path/to/file.pdf', 60)  // 60秒有効

// ❌ Wrong: getPublicUrl on private bucket (won't work)
const { data } = supabase.storage
  .from('documents')
  .getPublicUrl('path/to/file.pdf')
```

### Path Prefix Convention (RESTful)

Use RESTful hierarchical path structure:

```
{resource}/{id}/{sub-resource}/{filename}
```

Examples:
- `users/{user_id}/avatar.png`
- `users/{user_id}/documents/{doc_id}.pdf`
- `projects/{project_id}/assets/logo.png`

```typescript
// ✅ Correct: RESTful path structure
const path = `users/${userId}/avatar.png`
await supabase.storage.from('files').upload(path, file)

// ✅ Correct: Nested resource
const path = `projects/${projectId}/attachments/${fileId}.pdf`
await supabase.storage.from('files').upload(path, file)

// ❌ Wrong: No resource hierarchy
const path = `avatar.png`
```

### When to Use Public Buckets

Public buckets are allowed **ONLY** when:
1. User explicitly requests it
2. Files are truly public (marketing assets, public blog images)
3. High-performance CDN caching is required

### Prohibited Patterns

**NEVER**:
- Use public buckets for user-uploaded content without explicit approval
- Store sensitive files without RLS policies
- Use `getPublicUrl` for private buckets

## Enforcement

This Supabase-first policy is **NON-NEGOTIABLE**. All backend implementations require explicit justification for why supabase-js is insufficient.
