# {Feature Name} - セキュリティ設計

<!--
  出力先: docs/designs/{feature-name}/security.md
  認証基盤の選択、データ分類に基づくアクセス制御、RLS設計を定義する。

  必須参照:
  - .claude/rules/supabase-first.md - Supabase-first ポリシー
  - .claude/skills/supabase/SKILL.md - Supabase 認証
  - .claude/rules/database.md - RLS ポリシー設計
  - .claude/skills/Better Auth Best Practices/ - Better Auth

  RLS ポリシーの正（Single Source of Truth）は data-model.md。
  このファイルではセキュリティ観点からの検証と補完のみ行う。
-->

[< ui-ux.md](./ui-ux.md) | [testing.md >](./testing.md)

## 認証基盤選択

<!--
  認証基盤はケースバイケースで判断する。
  安易にどちらかに決めず、要件を分析して最適な選択を行う。

  Supabase Auth を推奨するケース:
  - Supabase エコシステム（RLS, Realtime, Storage）と深く統合
  - auth.uid() を RLS ポリシーで直接使用
  - OAuth/MFA を Supabase の設定のみで完結
  - シンプルな認証要件

  Better Auth を検討するケース:
  - 組織(Organization)ベースのマルチテナント
  - 複数アプリ間での認証共有
  - カスタム認証フロー（招待制、承認制）
  - Supabase 以外のバックエンドとの認証共有
-->

### 要件分析

| 要件 | Supabase Auth | Better Auth | 備考 |
|------|:---:|:---:|------|
| OAuth (Google/GitHub) | OK | OK | |
| MFA | OK | OK | |
| auth.uid() in RLS | 標準 | カスタム設定必要 | |
| 組織管理 | 自前実装 | プラグイン対応 | |
| 招待制サインアップ | Edge Function | プラグイン対応 | |
| 複数アプリ認証共有 | 困難 | 容易 | |

### 選択結果

**選択**: {Supabase Auth / Better Auth}

**理由**:

{選択理由を3-5文で記述。具体的な要件との対応を示す。}

### Supabase Auth 設定

<!--
  Supabase Auth を選択した場合のみ記述。

  参照: .claude/skills/supabase/SKILL.md
  - getUser() でサーバー認証（getSession は信頼しない）
  - proxy.ts で Middleware 設定（Next.js 16）
  - RLS で auth.uid() を使用
-->

```typescript
// proxy.ts (Next.js 16)
export function proxy(request: NextRequest) {
  return updateSession(request)
}
```

### Better Auth 設定

<!--
  Better Auth を選択した場合のみ記述。
  不要な場合: N/A -- Supabase Auth を選択したため Better Auth は使用しない

  専用スキーマ設計:
  1. PostgreSQL スキーマ: {app}_auth
  2. Better Auth テーブル: {app}_auth.user, {app}_auth.session, etc.
  3. public テーブル: public.{app}_users (アプリ固有のユーザーデータ)
  4. 連携: {app}_auth.user.id -> public.{app}_users.auth_user_id

  RLS 統合:
  - Better Auth の session トークンから user_id を取得
  - カスタム PostgreSQL 関数で auth_user_id を検証
  - RLS ポリシーで使用
-->

#### 専用スキーマ設計

```sql
-- Better Auth 用スキーマ
CREATE SCHEMA IF NOT EXISTS {app}_auth;

-- Better Auth テーブル（{app}_auth スキーマ内）
-- user, session, account, verification テーブルが自動作成される
```

#### public テーブルとの連携

```typescript
// drizzle/schema/schema.ts
export const {app}Users = pgTable('{app}_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: text('auth_user_id').notNull().unique(),
  // ... アプリ固有のフィールド
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
    .notNull().defaultNow(),
}).enableRLS()
```

#### Better Auth 配置場所（モノレポ構成）

<!--
  Better Auth はモノレポ内の専用パッケージとして配置する。
  Web / Mobile / Backend から共通で参照できるようにする。
-->

```
frontend/
├── packages/
│   └── auth/                          # Better Auth 専用パッケージ
│       ├── package.json               # @workspace/auth
│       ├── src/
│       │   ├── auth.ts                # Better Auth インスタンス（サーバー用）
│       │   ├── auth-client.ts         # Better Auth クライアント（フロントエンド用）
│       │   ├── plugins/               # カスタムプラグイン
│       │   └── index.ts              # エクスポート
│       └── tsconfig.json
├── apps/
│   ├── web/
│   │   └── src/
│   │       └── shared/
│   │           └── api/
│   │               └── auth.ts        # @workspace/auth を import して使用
│   └── mobile/
│       └── src/
│           └── shared/
│               └── api/
│                   └── auth.ts        # @workspace/auth を import して使用
```

#### Better Auth 設定

```typescript
// frontend/packages/auth/src/auth.ts
import { betterAuth } from 'better-auth'

export const auth = betterAuth({
  database: {
    provider: 'pg',
    url: process.env.DATABASE_URL,
  },
  user: {
    modelName: '{app}_auth_user',
  },
  session: {
    modelName: '{app}_auth_session',
  },
  // プラグイン
  plugins: [
    // 組織プラグイン（必要な場合）
    // organization(),
  ],
})
```

```typescript
// frontend/packages/auth/src/auth-client.ts
import { createAuthClient } from 'better-auth/client'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
})
```

## マルチテナント設計

<!--
  テナント分離のセキュリティ要件を定義する。
  data-model.md で定義した分離方式のセキュリティ面を補完する。
-->

### テナント境界

| 境界レベル | 実装方法 | 適用箇所 |
|-----------|---------|---------|
| データ分離 | RLS ポリシー | 全テーブル |
| API分離 | auth.uid() / org_id 検証 | Backend API |
| UI分離 | 認証状態に基づくルーティング | Frontend |

### テナント間アクセス防止

```typescript
// RLS でテナント境界を強制
// B2C パターン: user_id ベース
export const selectPolicy = pgPolicy('select_own_data', {
  for: 'select',
  to: 'authenticated',
  using: sql`(SELECT auth.uid()) = user_id`,
}).link({tableName})

// B2B パターン: org_id ベース（組織メンバーシップ検証）
export const selectPolicy = pgPolicy('select_org_data', {
  for: 'select',
  to: 'authenticated',
  using: sql`
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = {table_name}.org_id
      AND org_members.user_id = (SELECT auth.uid())
    )
  `,
}).link({tableName})
```

## データ分類に基づくアクセス制御

<!--
  data-model.md で定義したデータ分類に基づいて、
  各分類レベルのアクセス制御方法を定義する。
-->

| 分類 | アクセス制御 | RLS パターン | 暗号化 |
|------|------------|-------------|--------|
| **public** | 誰でも読み取り可 | `using: sql\`true\`` | 不要 |
| **internal** | 認証ユーザーのみ | `to: 'authenticated'` | 不要 |
| **confidential** | 本人のみ | `(SELECT auth.uid()) = user_id` | 推奨 |
| **restricted** | service_role のみ | `to: 'service_role'` | 必須 |

## RLS ポリシー検証

<!--
  RLS ポリシーの定義は data-model.md が正（Single Source of Truth）。
  このセクションではセキュリティ観点から以下を検証する:
  - 全テーブル・全操作にポリシーが定義されているか
  - データ分類と RLS パターンが整合しているか
  - 権限昇格の抜け穴がないか

  -> RLS ポリシーの詳細定義は [data-model.md](./data-model.md) を参照
-->

### テーブル別ポリシーマトリクス（検証用）

| テーブル | SELECT | INSERT | UPDATE | DELETE | 備考 |
|---------|--------|--------|--------|--------|------|
| {table1} | authenticated (own) | authenticated (own) | authenticated (own) | authenticated (own) | 自分のデータのみ |
| {table2} | public | service_role | service_role | service_role | 公開読み取り |
| {table3} | authenticated (org) | authenticated (org) | authenticated (org) | - | 組織メンバーのみ |

### セキュリティ検証項目

- [ ] 全テーブルの全操作（SELECT/INSERT/UPDATE/DELETE）にポリシーが定義されているか
- [ ] データ分類と RLS パターンが一致しているか（confidential -> 本人のみ等）
- [ ] service_role ポリシーが必要最小限か
- [ ] supabase_auth_admin は Auth Hook 用途のみか

### 特別なポリシー

<!-- 標準パターン以外の特殊なRLSポリシーがある場合 -->

```typescript
// MFA 必須の操作
export const updateSensitiveData = pgPolicy('update_sensitive_mfa', {
  for: 'update',
  to: 'authenticated',
  using: sql`
    (SELECT auth.uid()) = user_id
    AND (SELECT (auth.jwt()->>'aal')::text) = 'aal2'
  `,
}).link({tableName})
```

## 入力バリデーション

<!--
  各レイヤーでのバリデーション要件を定義する。
-->

### バリデーション階層

| レイヤー | ツール | 対象 |
|---------|--------|------|
| Frontend (Form) | Zod + react-hook-form | フォーム入力 |
| Backend (API) | Pydantic | API リクエスト |
| Database | CHECK 制約 + RLS | データ整合性 |

### バリデーションルール

| フィールド | ルール | エラーメッセージ (en) | エラーメッセージ (ja) |
|-----------|--------|---------------------|---------------------|
| {field1} | 必須、1-100文字 | Required, max 100 characters | 必須、最大100文字 |
| {field2} | メールアドレス形式 | Invalid email address | 無効なメールアドレス |

## 機密データ取り扱い

### 暗号化

| データ | 保存時暗号化 | 通信時暗号化 | 方法 |
|-------|:---:|:---:|------|
| パスワード | 自動 (Supabase Auth) | TLS | bcrypt |
| APIキー | 要 | TLS | pgcrypto |
| PII | 推奨 | TLS | アプリケーション層暗号化 |

### マスキング

<!-- API レスポンスで機密データをマスキングする場合 -->

```typescript
// 例: メールアドレスのマスキング
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local[0]}***@${domain}`
}
```

### データ保持ポリシー

| データ | 保持期間 | 削除方法 |
|-------|---------|---------|
| セッション | 30日 | 自動期限切れ |
| 監査ログ | 1年 | バッチ削除 |
| ユーザーデータ | アカウント削除まで | CASCADE DELETE |

## セキュリティチェックリスト

- [ ] 全テーブルに `.enableRLS()` が設定されている
- [ ] 全操作（SELECT/INSERT/UPDATE/DELETE）に RLS ポリシーが定義されている
- [ ] サーバーサイドで `getUser()` を使用（`getSession()` を信頼しない）
- [ ] 機密データが PII テーブルに分離されている
- [ ] service_role キーが Frontend に露出していない
- [ ] CORS が適切に設定されている
- [ ] 入力バリデーションが全レイヤーで実装されている
- [ ] エラーメッセージに機密情報が含まれていない
- [ ] ログに PII が出力されていない
