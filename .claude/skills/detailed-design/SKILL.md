---
name: detailed-design
description: |
  機能の詳細設計書を生成するスキル。新機能の設計、アーキテクチャ決定、データモデル設計、API設計、セキュリティ設計をGoogle Design Docスタイルで8ファイルに分割出力する。
  /detailed-design で呼び出し、feature名を引数に渡す。設計レビュー、技術仕様書、実装計画の作成にも使用。
argument-hint: <feature-name>
disable-model-invocation: true
effort: max
---

# 詳細設計書生成スキル

機能単位の詳細設計書を `docs/designs/$ARGUMENTS/` に8ファイル分割で生成する。

## 呼び出し方

```
/detailed-design user-management
/detailed-design multi-tenant-billing
```

## ワークフロー

### Phase 1: 要件ヒアリング

$ARGUMENTS が指定された場合、まず以下を確認する:

1. **機能の概要**: 何を実現したいか
2. **対象ユーザー**: B2B / B2C / 内部ツール
3. **スコープ**: 含める機能と含めない機能
4. **制約**: パフォーマンス、セキュリティ、既存システムとの互換性

ユーザーが十分な情報を提供している場合はヒアリングをスキップして Phase 2 へ進む。

### Phase 2: コードベース調査

以下を調査して既存システムとの整合性を確認:

1. **既存スキーマ**: `drizzle/schema/schema.ts`, `drizzle/schema/types.ts`
2. **既存RLS**: 現行のポリシーパターン
3. **既存FSD構造**: `frontend/apps/web/src/` の entities/features/widgets
4. **既存API**: `backend-py/apps/api/src/api/controller/`, `supabase/functions/`
5. **既存i18nキー**: `frontend/apps/web/src/shared/config/i18n/messages/`

### Phase 3: テンプレート読み込みと記入

`${CLAUDE_SKILL_DIR}/references/` にある8つのテンプレートを読み込み、調査結果と要件に基づいて記入する。

### Phase 4: 出力

`docs/designs/$ARGUMENTS/` に以下の8ファイルを出力:

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `README.md` | 概要・動機・ゴール/ノンゴール・目次 |
| 2 | `architecture.md` | システム構成・FSD構造・データフロー |
| 3 | `data-model.md` | ER図・Drizzle定義・RLS・マイグレーション |
| 4 | `api.md` | API設計・Supabase-first判定・エンドポイント |
| 5 | `ui-ux.md` | 画面一覧・コンポーネント設計・i18n |
| 6 | `security.md` | 認証・認可・データ分類・RLS |
| 7 | `testing.md` | TDD計画・Storybook・E2E |
| 8 | `rollout.md` | 実装フェーズ・リスク・代替案 |

## プロジェクトアーキテクチャ参照テーブル

各セクションで参照すべき技術とドキュメント:

| セクション | 技術スタック | 参照ルール/スキル |
|-----------|-------------|------------------|
| Frontend (Web) | Next.js 16, React 19, shadcn/ui, TailwindCSS 4 | `.claude/rules/frontend.md`, `.claude/skills/fsd/` |
| Frontend (Mobile) | Expo 55, React Native, gluestack-ui | `.claude/rules/frontend.md`, `.claude/skills/gluestack/` |
| State | TanStack Query v5 (server), Zustand (global) | `.claude/skills/tanstack-query/` |
| i18n | next-intl (en, ja) | `.claude/skills/i18n/` |
| Database | PostgreSQL, Drizzle ORM, pgvector | `.claude/rules/database.md`, `.claude/skills/drizzle/` |
| Auth (Default) | Supabase Auth | `.claude/skills/supabase/` |
| Auth (Alternative) | Better Auth | `.claude/skills/Better Auth Best Practices/` |
| Backend | FastAPI (Python) | `.claude/rules/backend-py.md` |
| Edge Functions | Deno, Supabase Edge Functions | `.claude/rules/edge-functions.md` |
| UI Testing | Storybook 10 | `.claude/skills/storybook/`, `.claude/rules/ui-testing.md` |
| Unit Testing | Vitest (Frontend), pytest (Backend) | `.claude/rules/tdd.md` |
| RLS Testing | pgTAP (`supabase test db`) | `.claude/skills/pgtap/` |

## 認証基盤選択ガイド

認証基盤はケースバイケースで判断する。安易にどちらかに決めず、要件を分析して最適な選択を行う。

### Supabase Auth を推奨するケース

- Supabase のエコシステム（RLS, Realtime, Storage）と深く統合する場合
- `auth.uid()` をRLSポリシーで直接使用したい場合
- OAuth/MFA を Supabase の設定のみで完結させたい場合
- シンプルな認証要件（サインアップ、ログイン、パスワードリセット）

### Better Auth を検討するケース

- 組織(Organization)ベースのマルチテナントが必要な場合
- 複数アプリ間での認証共有が必要な場合
- カスタム認証フロー（招待制、承認制）が複雑な場合
- Supabase 以外のバックエンドとも認証を共有する場合

### 判断プロセス

1. 要件を列挙する
2. 各認証基盤で実現可能かマッピングする
3. RLSとの統合コストを比較する
4. `security.md` に判断理由を明記する

## 品質チェックリスト

設計書出力前に以下を確認:

### データモデル
- [ ] PKの方針が正しい（後述の「PK設計ガイド」参照）
- [ ] 全FK に `onDelete: 'cascade'` が設定
- [ ] 全timestamp に `withTimezone: true, precision: 3`（`.claude/rules/datetime.md` 準拠）
- [ ] 同一テーブルへの複数FK参照がない（中間テーブルで解決）
- [ ] PIIカラムが専用テーブルに分離されている
- [ ] pgEnumが `drizzle/schema/types.ts` に定義
- [ ] `.enableRLS()` が全テーブルに設定
- [ ] RLSポリシーが4パターン（直接比較/EXISTS/service_role/public）から適切に選択
- [ ] 命名規約準拠: テーブル名=snake_case複数形、カラム名=snake_case、Drizzle変数=camelCase、Enum=camelCase+Enum、ポリシー名={operation}_policy_{table}、型名=PascalCase

### PK設計ガイド

| ケース | PK 定義 | 理由 |
|--------|---------|------|
| 通常テーブル | `uuid('id').primaryKey().defaultRandom()` | セキュリティ・分散対応 |
| auth.users 連携テーブル（users） | `uuid('id').primaryKey()` (.defaultRandom() なし) | auth.users.id と同一UUIDを外部から受け取るため |
| PII分離テーブル（user_profiles等） | `serial('id').primaryKey()` も許容 | メインテーブルとは userId FK + UNIQUE で1:1連携。連番PKでも外部露出しない |
| 外部ID連携（Polar等） | `text('id').primaryKey()` | 外部サービスのIDをそのまま使用 |

### API
- [ ] Supabase-first 判定が行われている（直接クエリ > Edge Function > Backend）
- [ ] Backend APIには「なぜSupabaseで不十分か」の理由が明記

### Frontend
- [ ] FSDレイヤー配置が適切（shared/entities/features/widgets/views）
- [ ] i18nキーが en/ja 両方で定義
- [ ] コンポーネントに Storybook ストーリーが計画されている

### セキュリティ
- [ ] データ分類（public/internal/confidential/restricted）が完了
- [ ] 認証基盤の選択理由が明記
- [ ] マルチテナント境界がRLSで強制

### テスト
- [ ] ビジネスロジック（model/api/lib）にTDD計画
- [ ] UIコンポーネントにStorybook計画（単体テスト不要）
- [ ] RLSポリシーにpgTAP（`supabase test db`）テスト計画

### 自動生成ファイル
- [ ] 自動生成ファイルを直接編集していないか（`.claude/rules/auto-generated.md` 参照）
- [ ] 型変更が必要な場合、Drizzle スキーマ（`drizzle/schema/`）を編集し `devenv tasks run model:build` で再生成しているか

## 条件付きセクションのルール

不要なセクションは削除せず、以下の形式で「対象外」を明示する:

```markdown
## Backend Python API

N/A -- この機能では Backend Python は使用しない（Supabase-first 判定により supabase-js で完結）
```

**理由**: レビュアーがスコープ検討済みであることを確認でき、意図的な除外と記載漏れを区別できるため。

## 記述ガイドライン

1. **日本語で記述**: 技術用語は英語OK
2. **Mermaid図を活用**: ER図、シーケンス図、コンポーネント図
3. **コード例はプロジェクトのパターンに準拠**: 実際の `schema.ts` のスタイルを踏襲
4. **トレードオフを明記**: 設計判断の理由と代替案
5. **各ファイルは独立して読める**: 他ファイルへのリンクは含めるが依存しない
6. **非ゴールを明確に**: やらないことを明示する（Google Design Doc スタイル）
7. **不要セクションは N/A 表記**: セクションを削除せず「N/A -- {理由}」と記載

## テンプレート

各テンプレートの詳細は以下のファイルを参照:

- [overview-template.md](references/overview-template.md) - 概要
- [architecture-template.md](references/architecture-template.md) - アーキテクチャ
- [data-model-template.md](references/data-model-template.md) - データモデル
- [api-template.md](references/api-template.md) - API設計
- [ui-ux-template.md](references/ui-ux-template.md) - UI/UX設計
- [security-template.md](references/security-template.md) - セキュリティ
- [testing-template.md](references/testing-template.md) - テスト計画
- [rollout-template.md](references/rollout-template.md) - ロールアウト計画
