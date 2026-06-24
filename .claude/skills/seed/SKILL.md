---
name: seed
description: データベース・ストレージのシードデータ管理ガイダンス。マスターデータ、テストデータ、冪等性、環境別実行についての質問に使用。シードデータの追加・管理の実装支援を提供。
---

# Seed スキル

## 概要

`devenv tasks run seed:all` コマンドでデータベース（Drizzle）とストレージ（Supabase Storage）のシードデータを投入する。

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `devenv tasks run seed:all` | DB + Storage 両方をシード |
| `devenv tasks run seed:db` | データベースのみ |
| `devenv tasks run seed:storage` | ストレージのみ |
| `ENV=staging devenv tasks run seed:all` | staging環境にシード |
| `ENV=production devenv tasks run seed:all` | production環境（確認プロンプト付き） |

## ディレクトリ構成

```
drizzle/seed/
├── index.ts              # エントリポイント
├── master/               # 固定データ（マスターデータ）
│   ├── index.ts          # 集約エクスポート
│   └── organizations.ts  # 例: organizations
└── random/               # ランダムデータ（テストデータ）
    ├── index.ts          # refinement集約
    └── users.ts          # 例: users

supabase/seeds/storage/
└── avatars/              # avatarsバケット用ファイル
    └── .gitkeep
```

---

## データの分類

### マスターデータ（固定データ）

**用途**: 初期設定、デフォルト値、システム必須レコード

**配置**: `drizzle/seed/master/`

**特徴**:
- 全環境で同一の値
- `onConflictDoNothing()` で冪等性を確保
- 例: 初期組織、デフォルトカテゴリ

```typescript
// drizzle/seed/master/organizations.ts
export async function seedOrganizations(db: Database): Promise<void> {
  await db
    .insert(organizations)
    .values([
      { name: 'Default Organization' },
    ])
    .onConflictDoNothing()
}
```

### ランダムデータ（テストデータ）

**用途**: 開発・テスト用のダミーデータ

**配置**: `drizzle/seed/random/`

**特徴**:
- `drizzle-seed` の `refine()` で定義
- deterministic（SEED_NUMBER で再現可能）
- 例: テストユーザー、サンプルメッセージ

```typescript
// drizzle/seed/random/users.ts
export const usersRefinement = (f: GeneratorFunctions) => ({
  users: {
    count: 10,
    columns: {
      displayName: f.fullName(),
      accountName: f.email({ isUnique: true }),
    },
  },
})
```

---

## drizzle-seed の使い方

### 基本構文

```typescript
import { reset, seed } from 'drizzle-seed'
import * as schema from '../schema'

// 1. 全データ削除（CASCADE）
await reset(db, schema)

// 2. ランダムデータ生成
await seed(db, schema, { seed: 12345 }).refine((f) => ({
  tableName: {
    count: 10,
    columns: {
      columnName: f.generatorFunction(),
    },
  },
}))
```

### Generator Functions

| 関数 | 説明 |
|------|------|
| `f.fullName()` | 氏名 |
| `f.firstName()`, `f.lastName()` | 名、姓 |
| `f.email({ isUnique: true })` | メールアドレス |
| `f.phoneNumber({ template: '###-####-####' })` | 電話番号 |
| `f.streetAddress()`, `f.city()`, `f.country()` | 住所 |
| `f.companyName()`, `f.jobTitle()` | 会社名、役職 |
| `f.int({ minValue, maxValue })` | 整数 |
| `f.number({ minValue, maxValue, precision })` | 小数 |
| `f.date({ minDate, maxDate })` | 日付 |
| `f.loremIpsum()` | テキスト |
| `f.valuesFromArray({ values: [...] })` | 配列から選択 |
| `f.weightedRandom([{ weight, value }])` | 重み付きランダム |

### リレーション（with）

```typescript
orders: {
  count: 100,
  with: {
    // 各orderに1-4件のdetailsを関連付け
    details: [
      { weight: 0.6, count: [1, 2] },
      { weight: 0.4, count: [3, 4] },
    ],
  },
},
```

---

## Storage シード

### バケット定義（supabase/config.toml）

```toml
[storage.buckets.avatars]
public = false
file_size_limit = "5MiB"
allowed_mime_types = ["image/png", "image/jpeg", "image/webp"]
objects_path = "./seeds/storage/avatars"
```

### ファイル配置

`supabase/seeds/storage/{bucket_name}/` にファイルを配置すると、`supabase seed buckets` で自動アップロードされる。

### RESTful パス規約（MANDATORY）

ストレージのファイルパスは **RESTful 階層構造** を使用すること。

```
{resource}/{id}/{sub-resource}/{filename}
```

**例**:
- `users/{user_id}/avatar.png`
- `users/{user_id}/documents/{doc_id}.pdf`
- `projects/{project_id}/assets/logo.png`
- `organizations/{org_id}/members/{user_id}/profile.png`

```typescript
// アップロード時
const path = `users/${userId}/avatar.png`
await supabase.storage.from('avatars').upload(path, file)

// 取得時（Private bucket）
const { data } = await supabase.storage
  .from('avatars')
  .createSignedUrl(`users/${userId}/avatar.png`, 60)
```

**禁止パターン**:
```typescript
// リソース階層がない
const path = `avatar.png`

// フラットな構造
const path = `${userId}_avatar.png`
```

---

## 環境別の実行

| ENV | 用途 | 動作 |
|-----|------|------|
| `local`（デフォルト） | ローカル開発 | そのまま実行 |
| `staging` | ステージング | そのまま実行 |
| `production` | 本番 | 確認プロンプト必須 |

### production での実行

```bash
$ ENV=production devenv tasks run seed:all

WARNING: You are about to seed PRODUCTION!

This will:
  - Reset and insert test/sample data
  - Potentially overwrite existing data

Are you sure you want to continue? [y/N]
```

---

## 新しいシードの追加方法

### 1. マスターデータを追加

```bash
# 1. ファイル作成
touch drizzle/seed/master/categories.ts

# 2. 実装
# export async function seedCategories(db) { ... }

# 3. master/index.ts に追加
# await seedCategories(db)
```

### 2. ランダムデータを追加

```bash
# 1. ファイル作成
touch drizzle/seed/random/messages.ts

# 2. refinement 実装
# export const messagesRefinement = (f) => ({ ... })

# 3. random/index.ts に追加
# ...messagesRefinement(f),
```

### 3. ストレージバケットを追加

```toml
# supabase/config.toml
[storage.buckets.documents]
public = false
file_size_limit = "10MiB"
allowed_mime_types = ["application/pdf"]
objects_path = "./seeds/storage/documents"
```

```bash
# ファイル配置
mkdir -p supabase/seeds/storage/documents
cp sample.pdf supabase/seeds/storage/documents/
```

---

## 注意事項

### RLS とシード

- usersテーブルなどRLS付きテーブルは `auth.uid()` が必要
- シードは `DIRECT_URL`（connection pooler経由しない）で実行
- 必要に応じて `service_role` 権限でのシードを検討

### 冪等性

- `reset()` で全データ削除後にシード
- マスターデータは `onConflictDoNothing()` で安全
- 外部キー制約を考慮した削除順序は自動処理

### Deterministic

- `SEED_NUMBER` を固定することで同じデータを再現可能
- テスト環境での再現性を確保

---

## 参照

- [Drizzle Seed Documentation](https://orm.drizzle.team/docs/seed-overview)
- [Supabase CLI: seed buckets](https://supabase.com/docs/reference/cli/supabase-seed-buckets)
