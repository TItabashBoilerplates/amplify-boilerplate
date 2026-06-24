# supabase/tests/

pgTAP による RLS・DB 関数・制約のテストを配置するディレクトリ。

## 実行

devenv の **script** (PATH 直結)。Makefile は **deprecated**（削除済み）。

```bash
test-db          # = supabase test db --local
```

## ファイル配置

- `000-setup-tests-hooks.sql` — pgtap 拡張 + supabase-test-helpers をロード
- `{table}_rls.sql` — 各テーブルの RLS ポリシーテスト
- `{function}_test.sql` — DB 関数・トリガーのテスト

**フラット構成**。サブディレクトリは作らない（`supabase test db` の探索を単純に保つため）。

`supabase test db` はアルファベット順でファイルを評価するので、setup は `000-` プレフィックスで先頭実行される。

## ガイダンス

詳細は `.claude/skills/pgtap/SKILL.md` を参照。
