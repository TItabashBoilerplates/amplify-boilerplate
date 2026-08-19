# {Feature Name} - セキュリティ設計

<!--
  出力先: docs/designs/{feature-name}/security.md
  認証方式の確定、データ分類に基づくアクセス制御、認可ルールの検証を定義する。

  必須参照:
  - .claude/rules/auth.md          - 認証方式・必須導線・Cognito の落とし穴
  - .claude/rules/data-modeling.md - authorization ルールの設計
  - .claude/rules/env-naming.md    - 秘匿値の置き場所（Amplify secrets / SSM）
  - .claude/skills/amplify-gen2/   - Cognito / AppSync の実装ガイド

  認可ルール（authorization）の正（Single Source of Truth）は data-model.md。
  このファイルではセキュリティ観点からの検証と補完のみ行う。
-->

[< ui-ux.md](./ui-ux.md) | [testing.md >](./testing.md)

## 認証方式の確定（**後から変えられないものを先に決める**）

<!--
  認証基盤は Amazon Cognito（Amplify Auth）で固定（.claude/rules/aws-first.md）。
  ここで決めるのは基盤選択ではなく、**初回デプロイ後に変更できない項目**である。

  ⚠️ Cognito の `loginWith`（サインイン方式）は **immutable**。
  変更するには User Pool の作り直し（＝全ユーザー移行）が要る。
-->

### サインイン方式

| 項目 | 決定 | 根拠 |
|---|---|---|
| モバイルアプリを出す（出す予定がある）か | はい / いいえ | — |
| 主たるログイン手段 | **メール + パスワード** / Email OTP | モバイルがあるなら**パスワード必須**（App Store 2.1(a)。`.claude/rules/auth.md` §0） |
| 併用する手段 | Email OTP / ソーシャル / passkey | — |
| `defineAuth` の設定 | `loginWith: { email: { otpLogin: true } }` | この 1 行で password と Email OTP の両方が first factor になる |

> **MFA とパスワードレス（OTP / passkey）は Cognito の制約で併用不可。**
> `multifactor` を足すと OTP ログインが壊れる。

### 必須導線（**指示を待たずに実装する**）

<!--
  .claude/rules/auth.md §2。これらは「あとで足せばいい機能」ではない。
  入口を失ったユーザーは自力で復帰できず、モバイルではストア審査で落ちる。
-->

| # | 導線 | 置き場所 | この機能での扱い |
|---|---|---|---|
| 1 | メールアドレスの再設定 | 設定 / アカウント画面 | 実装 / 既存を利用 |
| 2 | パスワードを忘れた方 | **ログイン画面**（設定画面ではない） | 実装 / 既存を利用 |
| 3 | パスワードの変更 | 設定 / アカウント画面 | 実装 / 既存を利用 |
| 4 | アカウント削除 | 設定 / アカウント画面（モバイルは必須） | 実装 / 既存を利用 |

### backend の必須設定

```typescript
// frontend/packages/backend/amplify/backend.ts
const { cfnUserPool } = backend.auth.resources.cfnResources

// ⚠️ cfnUserPool.policies = {...} と**代入してはならない**。
// otpLogin: true が設定する Policies.SignInPolicy ごと吹き飛び、OTP が無言で壊れる。
cfnUserPool.addPropertyOverride('Policies.PasswordPolicy.MinimumLength', 12)

// ⚠️ 必須: これが無いと、メール変更の検証完了前に email 属性が置き換わり、
// **旧アドレスでも新アドレスでもログインできなくなる**（＝アカウント喪失）
cfnUserPool.addPropertyOverride(
  'UserAttributeUpdateSettings.AttributesRequireVerificationBeforeUpdate',
  ['email'],
)

// ユーザー列挙の抑止
backend.auth.resources.cfnResources.cfnUserPoolClient.preventUserExistenceErrors = 'ENABLED'
```

### サーバー側の認可

<!--
  ⚠️ Client Component が持っている useAuthUser() の値を
  サーバーの判断根拠にしてはならない（.claude/rules/auth.md §3.7）。
-->

```typescript
// Server Component / Server Action / proxy
import { cookies } from 'next/headers'
import { getCurrentUser } from 'aws-amplify/auth/server'
import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'

const user = await runWithAmplifyServerContext({
  nextServerContext: { cookies },
  operation: (contextSpec) => getCurrentUser(contextSpec),
}).catch(() => null)
if (!user) redirect('/login')
```

## マルチテナント設計

<!--
  テナント分離のセキュリティ要件を定義する。
  data-model.md で定義した分離方式のセキュリティ面を補完する。
-->

### テナント境界

<!--
  ⚠️ **DynamoDB に RLS は無い。** 境界は (a) a.schema の authorization と
  (b) パーティションキーの設計 の 2 つでしか作れない。
  アプリ層の if で代替してはならない（漏れた 1 か所が全部）。
-->

| 境界レベル | 実装方法 | 適用箇所 |
|---|---|---|
| データ分離 | `authorization` ルール（AppSync が適用） | 全モデル |
| キー設計 | パーティションキーにテナント ID を含める | 一覧を返す全モデル |
| API 分離 | Function 内でも呼び出し元の identity を検証 | Amplify Functions / backend-py |
| UI 分離 | サーバー側の認証結果に基づくルーティング | Frontend |

### テナント間アクセス防止

```typescript
// B2C: 本人のみ（owner フィールドに Cognito の sub が入る）
.authorization((allow) => [allow.owner()])

// B2B: レコードの organizationId を Cognito グループ名として扱う
.authorization((allow) => [
  allow.groupDefinedIn('organizationId'),
  allow.groups(['admin']),
])

// ⚠️ 認可条件に使う属性は**インデックスのキーにも含める**。
// 含めないと「認可で落ちた分だけページが薄くなる」挙動になり、
// nextToken を見ないページングが確実に壊れる。
```

## データ分類に基づくアクセス制御

<!--
  data-model.md で定義したデータ分類に基づいて、
  各分類レベルのアクセス制御方法を定義する。
-->

<!--
  ⚠️ **DynamoDB では「列単位の認可」ができない**。認可の単位はモデルである。
  1 つのモデルに public と confidential を混ぜた時点で、そのモデル全体を
  confidential として扱うしかなくなる（-> data-model.md の PII 分離）。
-->

| 分類 | アクセス制御 | `authorization` | 置き場所 |
|---|---|---|---|
| **public** | 誰でも読み取り可 | `allow.guest().to(['read'])` | 公開モデル |
| **internal** | 認証ユーザーのみ | `allow.authenticated().to(['read'])` | 公開モデル |
| **confidential** | 本人のみ | `allow.owner()` | **PII 分離モデル** |
| **restricted** | サーバーのみ | `allow.resource(fn)`（IAM） | 専用モデル。クライアントに露出させない |

## 認可ルールの検証

<!--
  authorization の定義は data-model.md が正（Single Source of Truth）。
  ここではセキュリティ観点で以下を検証する:
  - 全モデル・全操作にルールがあるか
  - データ分類とルールが整合しているか
  - 権限昇格の抜け穴がないか

  -> ルールの詳細定義は [data-model.md](./data-model.md) を参照
-->

### モデル別の認可マトリクス（検証用）

| モデル | read | create | update | delete | 備考 |
|---|---|---|---|---|---|
| {Model1} | owner | owner | owner | owner | 本人のデータのみ |
| {Model2} | authenticated | resource(fn) | resource(fn) | — | 読み取り公開・書き込みはサーバーのみ |
| {Model3} | groupDefinedIn(orgId) | 同左 | 同左 | admin | 組織メンバーのみ |

### セキュリティ検証項目

- [ ] **すべてのモデルに `authorization` があるか**（書き忘れは事故に直結する）
- [ ] データ分類とルールが一致しているか（confidential -> `allow.owner()` かつ PII 分離モデル）
- [ ] サーバー専用の書き込みが `allow.resource()`（IAM）になっているか（owner で代替していないか）
- [ ] 一覧が返すフィールドに、その相手に見せてはいけないものが混ざっていないか
      （**モデル単位でしか絞れない**ため、混ぜた時点で漏れる）
- [ ] 削除の連鎖を自前で実装しているか（DynamoDB に CASCADE は無い）

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
|---|:---:|:---:|---|
| パスワード | 自動（Cognito が保持。アプリは触らない） | TLS | Cognito |
| API キー・署名鍵 | 要 | TLS | **Amplify secrets（SSM Parameter Store）**。env に置かない |
| DynamoDB のデータ | 既定で保存時暗号化（AWS 管理キー） | TLS | 顧客管理キーが要るなら KMS を明記 |
| S3 のオブジェクト | 既定で保存時暗号化 | TLS | 非公開バケット + 署名 URL |

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
| ユーザーデータ | アカウント削除まで | **削除フローで明示的に削除**（`deleteUser()` は Cognito ユーザーしか消さない） |

## セキュリティチェックリスト

- [ ] 全モデルに `authorization` が設定されている
- [ ] サーバー側の認可が `runWithAmplifyServerContext` + `aws-amplify/auth/server` を通っている
      （Client の `useAuthUser()` を根拠にしていない）
- [ ] 機密データが PII 分離モデルに切り出されている（モデル単位でしか絞れないため）
- [ ] `AttributesRequireVerificationBeforeUpdate: ['email']` を設定している
- [ ] 秘匿値が **Amplify secrets（SSM）** にあり、env（とくに `NEXT_PUBLIC_` / `EXPO_PUBLIC_`）に無い
- [ ] `amplify_outputs.json` の値を env に複製していない
- [ ] CORS が適切に設定されている
- [ ] 入力バリデーションが全レイヤーで実装されている
- [ ] エラーメッセージに機密情報が含まれていない（`UserNotFoundException` をそのまま出していない）
- [ ] ログに PII が出力されていない
