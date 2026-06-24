# drizzle-kit / drizzle-orm v1 RC マイグレーション調査レポート

## 調査情報

- **調査日**: 2026-04-28
- **調査者**: spec agent
- **対象**: `drizzle-kit ^0.31.6` / `drizzle-orm ^0.44.7` → v1 系へのアップグレード可否
- **背景**: `drizzle/drizzle.config.ts` の `out` を `'../supabase/migrations'` から `'./migrations'` に変更し、v3 マイグレーションフォーマットを採用したい

## 推奨バージョン

| パッケージ | 現状 | 最新（安定） | 最新（beta） | 推奨 |
|---|---|---|---|---|
| `drizzle-orm` | `^0.44.7` | 0.44.x 系（v1 はまだ beta） | **`1.0.0-beta.22`**（2026-04-16） | **現状維持（`^0.44.7`）** |
| `drizzle-kit` | `^0.31.6` | 0.31.x 系 | **`1.0.0-beta.22`** | **現状維持（`^0.31.6`）** |

**結論**: v1 は **2026-04-28 時点でも beta（RC 未到達）**。Roadmap の「Upgrade to v1.0 RC」セクションは進行中で、stable 日付は未公表。本番マイグレーションを扱う重要パスのため、**現プロジェクトでは v1 への移行は見送り**、現行 0.31/0.44 系で `out: './migrations'` 変更のみ実施するのが安全。

ただし、ユーザーがあえて beta を使いたい場合は `bun add drizzle-orm@beta && bun add -d drizzle-kit@beta` で beta タグを取得可能。

## v0.31 → v1 の主な破壊的変更（参考）

### 1. マイグレーションフォーマット v3（beta.16 以降）

- `meta/_journal.json` 廃止 → 各マイグレーションが独立フォルダに格納
- フォルダ命名: `<YYYYMMDDHHmmss>_<name>/migration.sql`（**秒精度**、out-of-order を許容）
- `__drizzle_migrations` テーブルが v1 スキーマに更新（`name` / `applied_at` カラム追加、`name` で完全一致照合）
- 既存プロジェクトは `drizzle-kit up` で v3 形式へ自動変換

### 2. CLI 変更

- `drizzle-kit drop` 削除
- `drizzle-kit pull --init` 追加（既存 DB から pull したマイグレーションを「適用済み」としてマーク）
- `drizzle-kit check` がコミュータティビティ検査（DAG ベースの競合検出）に強化
- `schemaFilter` がグロブパターンサポート

### 3. RLS API（重要）

- **`.enableRLS()` が deprecated**。代替:
  ```typescript
  // Before (v0.44)
  export const users = pgTable('users', { ... }).enableRLS()
  // After (v1.0.0-beta.1+)
  export const users = pgTable.withRLS('users', { ... })
  ```
- `pgPolicy` / `pgRole` / `.link(table)` の API は v1 でも継続サポート（本プロジェクトの `drizzle/schema/` 既存パターンと互換）

### 4. バリデーター統合

- `drizzle-zod` / `drizzle-valibot` / `drizzle-arktype` / `drizzle-typebox` → `drizzle-orm/{zod,valibot,arktype,typebox}` に内蔵

### 5. Relational Queries v2 (RQBv2)

- 大規模リライト。v1 のままでも動作可能（部分アップグレード可）

### 6. postgres-js migrator

- `import { migrate } from 'drizzle-orm/postgres-js/migrator'` および `import { drizzle } from 'drizzle-orm/postgres-js'` の I/F は **v1 でも継続互換**（本プロジェクトの `drizzle/migrate.ts` は変更不要）
- `migrate(db, { migrationsFolder: './migrations', migrationsSchema: 'public', migrationsTable: '__drizzle_migrations' })` のシグネチャは v0.44 / v1 共通

## v3 形式を使う drizzle.config.ts 最小設定例（現行 v0.31.6 でも v1 でも有効）

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './schema/index.ts',
  out: './migrations',           // ← 変更ポイント
  dialect: 'postgresql',
  dbCredentials: { url: process.env.POSTGRES_URL ?? '' },
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
  },
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
})
```

> **重要**: drizzle-kit `0.31.x` は **既に v3 フォルダ形式（`<ts>_<name>/migration.sql` + `meta/_journal.json`）で生成**する。`_journal.json` の有無は v3/v4 形式の差異であり、純粋なフォルダ単位構造は 0.31 系で既に標準。v1 の追加変更は journal 廃止と命名規則の秒精度化のみ。

## リスクと注意点

1. **既存 `supabase/migrations/` が空**かつローカル `__drizzle_migrations` 履歴も無いことを MCP で確認してから移行すること（`mcp__supabase__execute_sql` で `SELECT * FROM drizzle.__drizzle_migrations` を確認）
2. `out` 変更後の最初の `drizzle-kit generate` は **全スキーマを 1 マイグレーションとして出力**するため、Supabase 側の migrations と命名・順序がずれる可能性。`migrate.ts` の `pre-migration` / `post-migration` フックの整合性を要確認
3. v1 beta は **頻繁に破壊的変更が入る**（beta.16 → beta.21 でコミュータティビティ周りの修正あり）。本番運用では stable 待ちが推奨
4. **Edge Functions の Deno 側コピー**（`supabase/functions/shared/drizzle/`、`auto-generated.md` 参照）は drizzle-orm を共有しているため、ORM バージョンを上げる場合は Deno 側の互換も同時検証必須
5. RLS の `.link()` は `drizzle-orm/supabase` の `authenticatedRole` 等と組み合わせて利用しているため、v1 移行時は `.enableRLS()` → `.withRLS()` への置換漏れを grep で確認すること

## 推奨アクション

1. **今回のタスク（`out` 変更）は現行 v0.31.6 / v0.44.7 のまま実施**（v1 移行は別タスク）
2. ローカル DB の `__drizzle_migrations` を MCP 経由で確認 → 空なら `out: './migrations'` 変更後に `drizzle-kit generate` を実行
3. v1 stable がリリースされた段階で別途アップグレードタスクを起こす（RLS API 置換 + RQBv2 検証 + Edge Functions 側互換確認を含む）

## 出典

- [Drizzle ORM v1 Upgrade Guide](https://orm.drizzle.team/docs/upgrade-v1)
- [Drizzle ORM v1.0.0-beta.2 リリースノート](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2)
- [GitHub Releases (drizzle-team/drizzle-orm)](https://github.com/drizzle-team/drizzle-orm/releases)
- [Release v1.0.0-beta.16](https://github.com/drizzle-team/drizzle-orm/releases/tag/v1.0.0-beta.16)
- [Row-Level Security (RLS) Docs](https://orm.drizzle.team/docs/rls)
- [Migrations Overview](https://orm.drizzle.team/docs/migrations)
- [postgres-js README (drizzle-orm)](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/postgres-js/README.md)
- [Drizzle v1 Roadmap](https://orm.drizzle.team/roadmap)
