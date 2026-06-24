# Testing Guidelines

## CRITICAL: Test-Driven Development (TDD) Requirement

**MANDATORY**: All frontend development MUST follow Test-Driven Development (TDD) practices.

### UI Components Exception

**UI コンポーネントは単体テスト不要。代わりに Storybook で品質担保。**

詳細は **[UI Testing Policy](./ui-testing.md)** を参照。

| 対象 | テスト方法 |
|------|-----------|
| UI コンポーネント | Storybook（単体テスト不要） |
| ビジネスロジック | 単体テスト（TDD 必須） |
| API / データ取得 | 単体テスト（TDD 必須） |

### TDD Principles

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Improve code while keeping tests green

**This is NON-NEGOTIABLE**. Do not write implementation code before writing tests.

---

## Authorization Testing (Amplify Data)

### MANDATORY: Declare authorization rules in the schema, verify via sandbox

Authorization is **not** tested at a database layer. In Amplify Data, access control is declared
in the schema with `.authorization((allow) => [...])` in
`frontend/packages/backend/amplify/data/resource.ts` (this replaces row-level security / RLS).
Correctness is verified against a deployed **per-dev cloud sandbox** (`ampx sandbox`) through
integration / E2E tests, not via standalone DB-layer SQL tests.

```typescript
// frontend/packages/backend/amplify/data/resource.ts
const schema = a.schema({
  Todo: a
    .model({ content: a.string() })
    .authorization((allow) => [allow.owner()]),
});
```

### Why authorization is verified via sandbox integration / E2E

- 認可ルールは **schema にコードファーストで宣言**され、AppSync の resolver として強制される
- 正しさは実際にデプロイした sandbox（Cognito + AppSync + DynamoDB）に対してクライアント越しに検証するのが最も実態に近い
- マルチテナント / PII 保護は「所有者・userPool 認可」をルールとして宣言し、別ユーザー文脈での拒否を確認する
- 実ブラウザ / 実機でのフロー確認は Maestro が担当

### FSD `api/` segment に対する単体テストは不要

FSD の `api/` セグメント（`getDataClient()` を叩く薄いクエリ関数）には **単体テストを書かない**。理由:

- 認可の正しさは schema の `.authorization(...)` 宣言と sandbox に対する検証で保証される
- データクライアント（`generateClient<Schema>()` ラッパー）そのものをアプリ側でテストする価値は薄い
- 実ブラウザでのフロー確認は Maestro が担当

代わりに以下のレイヤーでテストを書く:

| レイヤー | テスト手段 | 目的 |
|----------|-----------|------|
| 認可ルール / データアクセス | sandbox に対する integration / E2E | デプロイ済み AppSync の境界保証 |
| `model/` のビジネスロジック | Vitest 単体テスト (TDD) | 純粋関数・reducer・state derivation |
| `lib/` ユーティリティ | Vitest 単体テスト (TDD) | 関数の入出力 |
| UI コンポーネント | Storybook | 見た目・状態分岐（単体テスト不要） |
| E2E フロー | Maestro | 画面遷移・認証フロー |

### 認可検証マトリクス（必須カバレッジ）

認可ルールを設定したモデルは、最低限以下の文脈を検証する:

| 文脈 | read (list/get) | create | update | delete |
|------|------|------|------|------|
| 未認証（サインアウト状態）| ✅ | ✅ | ✅ | ✅ |
| 認証済み（所有者 / 自テナント）| ✅ | ✅ | ✅ | ✅ |
| 認証済み（非所有者 / 他テナント）| ✅ | ✅ | ✅ | ✅ |

許可ケースは操作が成功すること、拒否ケースはエラー（権限不足）または空結果になることを検証する。

### TDD ワークフロー（認可ルール）

1. **Red**: ルール未設定 / 不十分な状態で拒否を期待するテストを書き、FAIL することを確認
2. **Green**: `amplify/data/resource.ts` に `.authorization(...)` を追加 → `sandbox` でデプロイ → PASS
3. **Refactor**: ルールを整理。テストは触らない

**NEVER**:
- テストを書き換えて PASS させる（実装側＝ schema を修正する）
- 認可ルールを無効化して検証する
- 管理者 / バイパス文脈のまま一般ユーザーの認可挙動を検証する

### Enforcement

- ❌ 認可ルールを追加したのに検証テストを書かない
- ❌ 所有者 / 非所有者の両方を検証しない
- ❌ read だけ書いて create/update/delete を省略
- ✅ 検証マトリクスをすべて埋める
- ✅ ポジティブ/ネガティブ両方を検証

---

## All Green Policy (MANDATORY)

**作業終了時は必ずすべてのテストが通過（All Green）していること。**

### 作業終了前チェックリスト

1. **全テスト実行**: `unit-test` を実行（個別に `test-frontend` / `test-backend-py`）
2. **失敗テストの対応**:
   - 原因分析を実施
   - 実装の修正（テストは変更しない）
   - 再度テスト実行
3. **All Green確認**: すべてのテストがパスするまで繰り返す

### 失敗テストへの対応

| 状況 | 対応 |
|------|------|
| 実装バグ | 実装を修正 |
| テスト環境問題 | 環境を修正し再実行 |
| 既存テストの破壊 | リグレッションを修正 |
| フレーキーテスト | 根本原因を特定し安定化 |

### 禁止事項

**NEVER**:
- 失敗テストを放置して作業を終了
- テストをスキップ（`skip`/`xfail`）して回避
- 失敗テストを削除して対処
- 「後で直す」として先送り

---

## Test Commands

| Operation | Command |
|-----------|---------|
| **Frontend Tests** | `test-frontend` (Vitest) |
| **Backend Tests** | `test-backend-py` (pytest) |
| **All Unit Tests** | `unit-test` |
| **E2E (Maestro)** | `e2e` / `e2e-web` / `e2e-mobile` |

---

## References

- [Amplify Data — Customize authorization rules](https://docs.amplify.aws/nextjs/build-a-backend/data/customize-authz/)
- [Amplify Data modeling](https://docs.amplify.aws/nextjs/build-a-backend/data/data-modeling/)
- [Amplify sandbox (ampx sandbox)](https://docs.amplify.aws/nextjs/deploy-and-host/sandbox-environments/setup/)
- [Maestro E2E](https://maestro.mobile.dev/)
