# Error Handling Policy

**MANDATORY**: エラーは適切にエラーとして処理する。不必要なフォールバックは禁止。

## 基本原則

**エラーを握りつぶすな。フォールバックで誤魔化すな。**

フォールバック値を返す = 「このエラーは無視してよい」と宣言すること。
一見動いているように見えるだけの壊れたアプリを作る最大の原因は、エラーのサイレントな無視である。

## 三大ルール

| ルール | 説明 |
|--------|------|
| **Catch したら必ずログ** | catch ブロックに入ったら最低限 `console.error` / `logger.exception` |
| **Catch したら必ずリスロー or 明示的な Result 型** | 握りつぶし禁止 |
| **空の catch ブロック禁止** | `catch {}` や `catch { return null }` は絶対禁止 |

## Boundary で catch、内部では throw

**原則: エラーハンドリングは Boundary 層の責務。内部関数はエラーを伝播させる。**

```
[内部関数] → throw で伝播（catch しない）
  ↓
[Boundary層] → catch でハンドリング（ログ + 適切なレスポンス）
```

### 各技術スタックの Boundary

| 技術 | Boundary | 内部 |
|------|----------|------|
| **Next.js** | `error.tsx`, `global-error.tsx`, Server Action の最外層 | コンポーネント、ユーティリティは throw |
| **FastAPI** | `@app.exception_handler()`, ミドルウェア | UseCase, Gateway は raise |
| **Amplify Data** | 呼び出し元の `if (errors)` チェック | クライアントは `{ data, errors }` を返す（throw しない）設計 |

## フロントエンド (Next.js / TypeScript)

### Server Action / API Route

```typescript
// ✅ CORRECT: エラーを明示的に返す
export async function createPost(formData: FormData) {
  const validated = validateInput(formData) // throws on invalid

  const { data, errors } = await getDataClient().models.Post.create(validated)

  if (errors) {
    console.error('Failed to create post:', errors)
    return { error: errors[0]?.message ?? 'Unknown error' }
  }

  return { data }
}

// ❌ WRONG: エラーを握りつぶして null を返す
export async function createPost(formData: FormData) {
  try {
    const result = await doSomething()
    return result
  } catch {
    return null  // 何が起きたか分からない
  }
}
```

### error.tsx の設置（必須）

```
app/
├── global-error.tsx          # ルートレイアウトのエラー
├── [locale]/
│   ├── error.tsx             # locale 配下の全エラー
│   └── dashboard/
│       └── error.tsx         # 必要に応じてセグメント単位
```

```typescript
// error.tsx: 必ずログ出力する
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Segment error:', error)
  }, [error])

  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Amplify Data の errors チェック（必須）

Amplify Data クライアントは throw せず `{ data, errors }` を返す設計のため、`errors` の明示的チェックが必須。

```typescript
// ✅ CORRECT: errors を必ずチェック
const { data, errors } = await getDataClient().models.Post.list()
if (errors) {
  console.error('Amplify Data query failed:', errors)
  throw new Error(errors[0]?.message ?? 'Query failed')
}

// ❌ WRONG: errors を無視して data を使用
const { data } = await getDataClient().models.Post.list()
return data ?? []  // エラーなのか空なのか区別不能

// ❌ WRONG: errors チェックなしで data を使う
const { data } = await getDataClient().models.Post.list()
return data!  // 型アサーションでごまかさない
```

### catch 内の型安全

```typescript
// ✅ CORRECT: error を unknown として扱う
catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message, { stack: error.stack })
  } else {
    console.error('Unknown error', { error })
  }
  throw error
}

// ❌ WRONG: any で受ける
catch (error: any) {
  console.error(error.message)  // 型安全でない
}
```

## バックエンド (FastAPI / Python)

### ドメイン例外を raise、Boundary で catch

```python
# ✅ CORRECT: UseCase はドメイン例外を raise（個別 catch しない）
class CreatePostUseCase:
    def execute(self, data: PostInput) -> Post:
        if not data.title:
            raise ValidationError("Title is required")
        return self.gateway.create(data)

# ✅ CORRECT: exception_handler で一括処理
@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError):
    logger.warning("Validation error: %s", exc)
    return JSONResponse(status_code=400, content={"detail": str(exc)})

# ❌ WRONG: UseCase 内で catch して握りつぶす
class CreatePostUseCase:
    def execute(self, data: PostInput) -> Post | None:
        try:
            return self.gateway.create(data)
        except Exception:
            return None  # 何が起きたか分からない
```

### ログ出力の必須化

```python
# ✅ CORRECT: logger.exception() でスタックトレース含む
except Exception as e:
    logger.exception("Unexpected error in payment processing")
    raise

# ❌ WRONG: print で済ませる
except Exception as e:
    print(f"error: {e}")
    raise

# ❌ WRONG: ログなしで re-raise
except Exception:
    raise  # 何が起きたかログに残らない
```

## フォールバックの許容条件

フォールバックは**以下の条件をすべて満たす場合のみ**許容:

| 条件 | 説明 |
|------|------|
| **意図的な設計判断** | 「エラーが起きても処理を続行すべき」と明確に判断 |
| **ログ出力済み** | フォールバックした事実がサーバーログに残る |
| **デフォルト値が安全** | データ破損や誤動作を起こさない |
| **付随的な処理** | ユーザーの操作結果に影響がない |

### 許容例

```typescript
// OK: 分析イベント送信の失敗（付随的処理）
try {
  await analytics.track('page_view', { path })
} catch (error) {
  console.error('Analytics tracking failed:', error)
  // 本体の処理に影響しないので続行
}

// OK: オプショナルな設定の読み込み
const { data: preferences, errors } = await getDataClient().models.UserPreferences.get({
  userId,
})

if (errors) {
  console.warn('Failed to load preferences, using defaults:', errors)
  return DEFAULT_PREFERENCES  // 安全なデフォルト
}
```

### 禁止例

```typescript
// NG: 認証エラーを握りつぶす → セキュリティホール
try {
  const user = await getUser(token)
} catch {
  return null
}

// NG: データ保存の失敗を無視 → データ損失
const { errors } = await getDataClient().models.Order.create(order)
if (errors) {
  return { success: true }  // 嘘のレスポンス（errors を無視している）
}

// NG: 決済処理のフォールバック → 金銭的損害
try {
  await processPayment(amount)
} catch {
  return { status: 'free' }  // フォールバックで無料にする???
}
```

## 禁止パターンまとめ

```typescript
// ❌ 空の catch
catch {}

// ❌ null/undefined フォールバック
catch { return null }
catch { return undefined }

// ❌ 空配列フォールバック（エラーと空結果の区別不能）
catch { return [] }

// ❌ ログなしのフォールバック
catch { return defaultValue }

// ❌ デフォルト値で成功を装う
catch { return { success: true, data: defaultData } }

// ❌ optional chaining でエラーを無視
const result = riskyOperation?.()  // エラーが起きても undefined になるだけ
```

## 強制事項

このポリシーは**交渉の余地なし**。

- すべての catch ブロックにはログ出力が必須
- エラーをサーバーログに出力しない実装は許可しない
- フォールバックを入れる場合は許容条件を満たすことを確認
- 「とりあえず動くようにする」ためのフォールバックは禁止
