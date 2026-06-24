---
name: seed
description: データベース・ストレージのシードデータ管理ガイダンス。マスターデータ、テストデータ、冪等性、環境別実行についての質問に使用。シードデータの追加・管理の実装支援を提供。
---

# Seed スキル

## 概要

`devenv tasks run seed:all` でデータベース（Drizzle）とストレージ（Supabase Storage）のシードデータを投入する。Makefile は **deprecated**（削除済み）。

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `devenv tasks run seed:all` | DB + Storage 両方をシード |
| `devenv tasks run seed:db` | データベースのみ |
| `devenv tasks run seed:storage` | ストレージのみ |
| `devenv tasks run -P staging    seed:all` | staging 環境にシード |
| `devenv tasks run -P production seed:all` | production 環境（要ユーザー承認） |

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

---

## 環境別の実行

| ENV | 用途 | 動作 |
|-----|------|------|
| `local`（デフォルト） | ローカル開発 | そのまま実行 |
| `staging` | ステージング | そのまま実行 |
| `production` | 本番 | 確認プロンプト必須 |

### production での実行

```bash
$ devenv tasks run -P production seed:all

WARNING: You are about to seed PRODUCTION!

This will:
  - Reset and insert test/sample data
  - Potentially overwrite existing data

Are you sure you want to continue? [y/N]
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
