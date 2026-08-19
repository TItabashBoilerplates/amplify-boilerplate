---
description: "Error handling policy - never swallow errors, no silent fallbacks"
alwaysApply: true
globs: ["**/*.ts", "**/*.tsx", "**/*.py"]
---
# Error Handling Policy

**MANDATORY**: エラーは適切にエラーとして処理する。不必要なフォールバックは禁止。

正本: `/.claude/rules/error-handling.md`

## 三大ルール

| ルール | 説明 |
|---|---|
| **catch したら必ずログ** | 最低限 `console.error` / `logger.exception` |
| **catch したら必ず再送出 or 明示的な Result 型** | 握りつぶし禁止 |
| **空の catch ブロック禁止** | `catch {}` / `catch { return null }` は絶対禁止 |

## Boundary で catch、内部では throw

| 技術 | Boundary |
|---|---|
| Next.js | `error.tsx` / `global-error.tsx` / Server Action の最外層 |
| FastAPI | `@app.exception_handler()` / ミドルウェア |
| Amplify Data | 呼び出し元の `if (errors)` チェック |

## Amplify Data と Amplify Auth は契約が逆

```typescript
// Amplify Data: throw せず { data, errors } を返す → errors のチェックが必須
const { data, errors } = await getDataClient().models.Post.list({ limit: 20 })
if (errors) {
  console.error('Amplify Data query failed:', errors)
  throw new Error(errors[0]?.message ?? 'Query failed')
}

// Amplify Auth: throw する → features/auth/api/* は try/catch で受けて
// { success: true } | { error: string } を返す
```

## 禁止パターン

```typescript
catch {}                                  // ❌ 空
catch { return null }                     // ❌ null フォールバック
catch { return [] }                       // ❌ エラーと空結果が区別できない
catch { return { success: true } }        // ❌ 嘘のレスポンス
const { data } = await client.models.X.list()   // ❌ errors を見ていない
return data ?? []
```

フォールバックは **付随的処理（analytics 等）でログ出力済みの場合のみ**許容。
