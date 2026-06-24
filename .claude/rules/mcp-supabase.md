# Supabase MCP 使用ポリシー

**CRITICAL / NON-NEGOTIABLE**: Supabase 上のインフラ（DB / Storage / Auth / Edge Functions / Logs / Migrations / Advisors / 設定）を**調査・操作**する場合は、必ず **`supabase` MCP**（ローカル）または **`supabase-prod` MCP**（本番、read-only）を使用すること。

直接 `psql` / `curl` / `supabase` CLI / REST API を Bash で叩いて Supabase インフラを調査・操作することは**禁止**する。

> 補足: アプリケーションコードから Supabase を呼び出す場合（`supabase-js` / `@supabase/ssr` / Edge Functions の SDK 利用）は、本ポリシーの対象外。実装方針は `.claude/rules/supabase-first.md` を参照。
> 本ポリシーは **Claude（AI）自身が調査・運用タスクで Supabase に触れるとき**のツール選択についての規定である。

## 対象 MCP

`.mcp.json` で以下の 2 つが定義されている:

| MCP | 用途 | 接続先 | モード |
|---|---|---|---|
| `supabase` | **ローカル開発環境**（Docker 上の Supabase）の調査・操作 | `http://localhost:54321/mcp` | フル操作可（local） |
| `supabase-prod` | **本番環境**の調査 | `https://mcp.supabase.com/mcp` | **read-only**（`read_only=true`） |

`supabase-prod` MCP は read-only で接続されているため、本番環境への書き込み・破壊的操作は MCP 経由でも実行できない設計になっている。**本番への書き込みが必要な場合は、必ずユーザーに判断をあおぐこと**（勝手に read-only を解除する変更を加えてはならない）。

## 必ず MCP を使うべき操作

以下のような Supabase インフラ操作は、Bash や CLI 直叩きではなく **MCP のツール** を使用する:

| 操作 | MCP ツール例 |
|---|---|
| **テーブル一覧** | `mcp__supabase__list_tables` |
| **SQL 実行（調査）** | `mcp__supabase__execute_sql` |
| **マイグレーション一覧** | `mcp__supabase__list_migrations` |
| **拡張機能一覧** | `mcp__supabase__list_extensions` |
| **TypeScript 型生成（調査用）** | `mcp__supabase__generate_typescript_types` |
| **ログ確認** | `mcp__supabase__get_logs` |
| **Advisors（パフォーマンス・セキュリティ）** | `mcp__supabase__get_advisors` |
| **Project URL / Publishable Keys 取得** | `mcp__supabase__get_project_url` / `mcp__supabase__get_publishable_keys` |
| **公式ドキュメント検索** | `mcp__supabase__search_docs` |
| **本番環境の調査（read-only）** | `mcp__supabase-prod__*` |

> 注: マイグレーションの**実行**自体は `.claude/rules/database.md` に従い、**ユーザー承認が必要**（Claude が勝手に実行しない）。MCP の利用はあくまで「事前確認」「調査」「型生成」など、ユーザー承認が不要な範囲のオペレーションに使う。書き込み系の MCP ツールを使う場合もユーザーに事前確認すること。

## ローカル / 本番の使い分け

| ユーザー指示 | 使う MCP |
|---|---|
| 明示なし、または「ローカル」「local」 | `supabase` |
| 「本番」「prod」「production」「stg / staging」※環境を明示 | `supabase-prod`（read-only） |
| 不明な場合 | **ユーザーに確認**（迷ったら聞く / `.claude/CLAUDE.md` のメモリポリシー参照） |

**本番に対する破壊的操作・書き込み操作は、MCP 経由であっても必ずユーザー確認**を取ること。

## 禁止パターン

```bash
# ❌ NG: psql / curl で直接 DB を叩く
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT * FROM auth.users"
curl -X POST http://localhost:54321/rest/v1/users -H "apikey: ..."

# ❌ NG: supabase CLI で本番に対して直接 SQL を流す
supabase db remote query "SELECT ..."

# ❌ NG: Bash 経由で SQL 実行スクリプトを書いて流す
bun run scripts/check-db.ts

# ✅ OK: MCP ツールを使う
# → mcp__supabase__execute_sql / mcp__supabase__list_tables / 等
```

## 例外（本ポリシーの適用外）

以下は **本ポリシーの対象外** であり、従来どおりのコマンド/ツールを使う:

| 操作 | 使うコマンド |
|---|---|
| マイグレーション生成・適用（ローカル開発フロー） | `devenv tasks run app:migrate-dev`（`.claude/rules/commands.md` / `database.md` 参照、ユーザー承認必須） |
| 型生成（生成パイプライン） | `devenv tasks run model:build` 等 |
| Edge Functions のデプロイ | `devenv tasks run deploy:functions` |
| Supabase Docker 起動 / 停止 | `supabase-start` / `supabase-stop` / `stop` |
| アプリコードからの Supabase 呼び出し | `supabase-js` / `@supabase/ssr` / Edge Function SDK |

これらは「devenv のコマンド」または「アプリのランタイム呼び出し」が**正規の経路**であり、MCP に置き換える必要はない。

## なぜこのポリシーが必要か

1. **監査性**: MCP 経由の操作は構造化され、何をしたかが明確に残る
2. **安全性**: `supabase-prod` は read-only として設定済み → 本番への誤った破壊的操作を防げる
3. **再現性**: Bash で組み立てた SQL や HTTP 呼び出しは環境変数・URL の取り扱いがバラつく
4. **権限分離**: MCP に渡されているキー（publishable）と service_role を混同しない
5. **公式サポート**: Supabase 公式が提供する MCP サーバーが最新の API スキーマを反映している

## 強制事項

このポリシーは**交渉の余地なし**。Supabase インフラを調査・操作するときに Bash で直接 `psql` / `curl` / `supabase` CLI を叩く実装・提案は**レビューで却下**する。
