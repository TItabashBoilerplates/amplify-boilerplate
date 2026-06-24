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

## RLS Testing with pgTAP

### MANDATORY: Use pgTAP for RLS and DB-layer validation

RLS policies, DB functions, triggers, and constraints are verified with **pgTAP** via `supabase test db`. All RLS tests live in `supabase/tests/` as `.sql` files and run with:

```bash
test-db   # = supabase test db --local (devenv script)
```

詳細は `.claude/skills/pgtap/SKILL.md` を参照。ここではポリシーだけを示す。

### Why pgTAP (and not supabase-js tests)

- RLS の正しさは **DB 層で完結して検証**するのが最短・最堅牢
- マルチテナント / PII 保護が最重要 → DB 層の境界で絶対に漏らさない
- Supabase 公式が `supabase test db` で直接サポート
- アプリ経由テスト（supabase-js + Vitest）だと「RLS のバグ」と「クエリのバグ」が混ざって切り分け困難

### FSD `api/` segment に対する単体テストは不要

FSD の `api/` セグメント（supabase-js を叩く薄いクエリ関数）には **単体テストを書かない**。理由:

- RLS の正しさは pgTAP で DB 層で保証済み
- supabase-js のクエリビルダーそのものをアプリ側でテストする価値は薄い
- 実ブラウザでのフロー確認は Maestro が担当

代わりに以下のレイヤーでテストを書く:

| レイヤー | テスト手段 | 目的 |
|----------|-----------|------|
| RLS / DB 関数 / 制約 | pgTAP (`test-db` script) | DB 層の境界保証 |
| `model/` のビジネスロジック | Vitest 単体テスト (TDD) | 純粋関数・reducer・state derivation |
| `lib/` ユーティリティ | Vitest 単体テスト (TDD) | 関数の入出力 |
| UI コンポーネント | Storybook | 見た目・状態分岐（単体テスト不要） |
| E2E フロー | Maestro | 画面遷移・認証フロー |

### RLS テストマトリクス（必須カバレッジ）

RLS を設定したテーブルは以下すべてを検証する:

| ロール | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `anon`（未認証・`tests.clear_authentication()`）| ✅ | ✅ | ✅ | ✅ |
| `authenticated`（自テナント/所有者）| ✅ | ✅ | ✅ | ✅ |
| `authenticated`（他テナント/非所有者）| ✅ | ✅ | ✅ | ✅ |

許可ケースは `lives_ok` / `results_eq`、拒否ケースは `throws_ok`（書き込み系）または `is_empty`（読み取り系）で検証する。

### TDD ワークフロー（pgTAP）

1. **Red**: RLS ポリシーが未実装の状態で拒否テストを書き、`test-db` で FAIL することを確認
2. **Green**: `drizzle/schema/` にポリシーを追加 → `devenv tasks run app:migrate-dev` → `test-db` で PASS
3. **Refactor**: ポリシー式を整理。テストは触らない

**NEVER**:
- テストを書き換えて PASS させる（実装側を修正する）
- RLS を disable してテストする
- `authenticate_as_service_role()` のまま RLS 挙動を検証する

### Enforcement

- ❌ RLS ポリシーを追加したのに pgTAP テストを書かない
- ❌ 自テナント/他テナントの両方を検証しない
- ❌ SELECT だけ書いて INSERT/UPDATE/DELETE を省略
- ✅ テストマトリクスをすべて埋める
- ✅ ポジティブ/ネガティブ両方を検証

---

## All Green Policy (MANDATORY)

**作業終了時は必ずすべてのテストが通過（All Green）していること。**

### 作業終了前チェックリスト

1. **全テスト実行**: `test` script を実行
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

## References

- [Supabase: pgTAP Extension](https://supabase.com/docs/guides/database/extensions/pgtap)
- [Supabase: Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase: pgTAP Extended](https://supabase.com/docs/guides/local-development/testing/pgtap-extended)
- [supabase test db CLI](https://supabase.com/docs/reference/cli/supabase-test-db)
- [usebasejump/supabase-test-helpers](https://github.com/usebasejump/supabase-test-helpers) — `tests.authenticate_as()` などのヘルパー
- [pgTAP 本家ドキュメント](https://pgtap.org/documentation.html)
- プロジェクト内詳細: `.claude/skills/pgtap/SKILL.md`
