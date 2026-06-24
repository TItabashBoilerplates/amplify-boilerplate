# Drizzle ORM PostgreSQL Extensions 調査レポート

## 調査情報
- **調査日**: 2026-02-11
- **調査者**: spec agent

## バージョン情報
- **現在使用中**: drizzle-orm v0.44.7 / drizzle-kit v0.31.6
- **最新安定版**: drizzle-orm v0.45.x / drizzle-kit v0.31.9
- **最新 beta 版**: drizzle-orm v1.0.0-beta.15 (2025-02-05 リリース)

## 調査結果の要約

### 1. Drizzle ORM に extension を定義・管理する機能があるか

**結論: ネイティブの `pgExtension()` 関数は存在しない。**

Drizzle ORM は PostgreSQL の `CREATE EXTENSION` 文をスキーマ定義内で宣言的に管理する機能を**持っていない**。現時点（v0.44.x / v0.45.x / v1.0.0-beta.15）のいずれのバージョンにも `pgExtension` のような API は存在しない。

### 2. 現在サポートされている Extension 関連機能

Drizzle ORM が提供しているのは、extension が**既にインストールされている前提**での型・カラム・インデックスのサポートのみ:

#### a) pgvector (ビルトインサポート)
```typescript
import { vector } from 'drizzle-orm/pg-core'

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  embedding: vector('embedding', { dimensions: 1536 }),
})
```

#### b) PostGIS (ビルトインサポート)
```typescript
import { geometry } from 'drizzle-orm/pg-core'

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  location: geometry('location', { type: 'point' }),
})
```

#### c) その他の Extension (customType で対応)
```typescript
import { customType } from 'drizzle-orm/pg-core'

const citext = customType<{ data: string }>({
  dataType() { return 'citext' },
})
```

#### d) extensionsFilters (drizzle-kit 設定)
extension が作成する内部テーブルをイントロスペクション時にスキップするフィルタ:
```typescript
// drizzle.config.ts
export default defineConfig({
  extensionsFilters: ['postgis'],
})
```

### 3. マイグレーションで CREATE EXTENSION は自動生成されるか

**結論: 自動生成されない。**

`drizzle-kit generate` は `CREATE EXTENSION IF NOT EXISTS ...` を自動生成しない。これは GitHub Issue #2124 で機能リクエストとして提出されており、2026-02-11 時点でも **Open のまま**。

### 4. 公式が推奨する Workaround

#### 方法 A: カスタムマイグレーションファイルの手動作成
```bash
npx drizzle-kit generate --custom
```
生成された空のマイグレーションファイルに手動で `CREATE EXTENSION IF NOT EXISTS ...;` を追記する。

#### 方法 B: マイグレーション前スクリプト（本プロジェクトで採用中）
本プロジェクトでは `drizzle/config/pre-migration/00_extensions.sql` に extension の作成文を配置し、`migrate.ts` の `pre-migration` フェーズで実行する方式を採用している。

### 5. v1 での対応見込み

v1 ロードマップおよび v1.0.0-beta.15 のリリースノートには、extension 管理機能の追加は**明示されていない**。

GitHub Issue #2124 での Drizzle チームのコメント（2025-08-30）では、drizzle-kit の大幅な書き直しが進行中であり、将来的に対応される可能性はあるが、具体的なスケジュールは示されていない。

## 現プロジェクトの管理方法（現状維持推奨）

本プロジェクトでは以下の方法で管理しており、これは Drizzle の制約を考慮した**適切なベストプラクティス**:

```
drizzle/
  config/
    pre-migration/
      00_extensions.sql    # CREATE EXTENSION IF NOT EXISTS vector;
    post-migration/
      00_functions.sql     # トリガー、関数等
  migrate.ts               # pre/post マイグレーションを実行
```

**実行フロー**:
1. `bun run migrate.ts pre-migration` -- extension を有効化
2. `drizzle-kit migrate` -- テーブルマイグレーションを適用
3. `bun run migrate.ts post-migration` -- 関数・トリガーを適用

## 新しい Extension を追加する場合の手順

1. `drizzle/config/pre-migration/00_extensions.sql` に追記:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

2. スキーマで extension の型を使用（customType またはビルトイン）:
   ```typescript
   import { customType } from 'drizzle-orm/pg-core'

   const tsvector = customType<{ data: string }>({
     dataType() { return 'tsvector' },
   })
   ```

3. `make migrate-dev` でマイグレーションを生成・適用

## 参考リンク
- [Drizzle ORM - PostgreSQL extensions 公式ドキュメント](https://orm.drizzle.team/docs/extensions/pg)
- [GitHub Issue #2124: Support CREATE EXTENSION](https://github.com/drizzle-team/drizzle-orm/issues/2124)
- [GitHub Discussion #123: Does it support postgres extensions?](https://github.com/drizzle-team/drizzle-orm/discussions/123)
- [Drizzle ORM v1 Roadmap](https://orm.drizzle.team/roadmap)
- [Drizzle ORM v1.0.0-beta.2 リリースノート](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2)
- [Drizzle ORM Releases](https://github.com/drizzle-team/drizzle-orm/releases)
