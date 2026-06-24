# Supabase Config-as-Code Policy

**CRITICAL / NON-NEGOTIABLE**: Supabase の**サービス設定値はすべて `supabase/config.toml` を single source of truth として Git 管理する**。Dashboard での手動変更は禁止。**唯一の例外は DB（スキーマ / RLS / Realtime publication / migration）で、これは Drizzle が source of truth**。

このルールは `.claude/skills/supabase-config/`（公式 CLI v2 系ドキュメント準拠）と本リポジトリの `scripts/supabase/` 実装に基づく。詳細な全キー一覧・デプロイ手順は同 Skill の `references/` を参照すること。

---

## 1. 責務分担（どこで何を管理するか）

| 対象 | source of truth | 配置 |
|------|----------------|------|
| **Auth**（OAuth / JWT / Email / SMS / MFA / Hooks / Rate limit / **メールテンプレート**） | **`config.toml`** | `[auth.*]` |
| **Storage**（buckets / image transform / S3 protocol / サイズ上限） | **`config.toml`** | `[storage.*]` |
| **API**（PostgREST: port / schemas / max_rows / TLS） | **`config.toml`** | `[api.*]` |
| **Realtime サービス**（有効化 / port / header） | **`config.toml`** | `[realtime]` |
| **Studio / Inbucket / Edge Runtime / Analytics** | **`config.toml`** | 各セクション |
| **Functions のデプロイ設定**（`verify_jwt` / `import_map` / `enabled`） | **`config.toml`** | `[functions.<name>]` |
| **マルチ環境差分**（staging / production） | **`config.toml`** | `[remotes.<project_id>.*]` |
| **── 例外 ──** | | |
| **DB スキーマ / テーブル / 制約** | **Drizzle** | `drizzle/schema/*.ts` |
| **RLS ポリシー** | **Drizzle** | `drizzle/schema/*.ts`（`pgPolicy`） |
| **Realtime publication（どのテーブルを realtime 対象にするか）** | **Drizzle** | `drizzle/config/post-migration/` |
| **Migration** | **Drizzle (drizzle-kit)** | `drizzle/migrations/` |

> **原則**: 「Supabase の設定 = `config.toml`」。DB に属するもの（テーブル・RLS・publication・migration）だけが Drizzle 例外。判断に迷う設定が出たら、それが「GoTrue / Storage / PostgREST / Realtime サービス / Edge Runtime の挙動設定」なら `config.toml`、「Postgres のスキーマ・行レベルの話」なら Drizzle。

---

## 2. メールテンプレート（Auth Email Templates）

**MANDATORY**: 認証メールのテンプレートは `supabase/templates/email/*.html`（Git 管理）に置き、**必ず `config.toml` の `[auth.email.template.<type>]` から `content_path` で配線する**。Dashboard に手書きしない。

### 配線の正規スニペット（config.toml に記載する内容）

本リポジトリには既に以下5テンプレートが存在する（`supabase/templates/email/`）。`config.toml` には次を記載して配線する:

```toml
[auth.email.template.confirmation]
subject = "Confirm Your Signup / サインアップ確認"
content_path = "./supabase/templates/email/confirmation.html"

[auth.email.template.recovery]
subject = "Reset Your Password / パスワードリセット"
content_path = "./supabase/templates/email/recovery.html"

[auth.email.template.magic_link]
subject = "Your Magic Link / マジックリンク"
content_path = "./supabase/templates/email/magic_link.html"

[auth.email.template.invite]
subject = "You have been invited / 招待されました"
content_path = "./supabase/templates/email/invite.html"

[auth.email.template.email_change]
subject = "Confirm Email Change / メールアドレス変更確認"
content_path = "./supabase/templates/email/email_change.html"
```

> 対応テンプレート種別: `invite` / `confirmation` / `recovery` / `magic_link` / `email_change` / `reauthentication`。
> セキュリティ通知（`password_changed` 等）を使う場合は `[auth.email.notification.<type>]`（`enabled = true` + `subject` + `content_path`）。

### テンプレート内で使える変数

`{{ .ConfirmationURL }}` / `{{ .Token }}` / `{{ .TokenHash }}` / `{{ .SiteURL }}` / `{{ .Email }}` / `{{ .Data }}`（`user_metadata`）。

本リポジトリのテンプレートは Go Template の条件分岐で多言語対応している（`{{ if eq .Data.locale "ja" }} ... {{ else }} ... {{ end }}`）。フロント側で認証時に `options.data.locale` を渡すこと（詳細は `docs/deployment/email-templates.md`）。

### 反映タイミング

- **ローカル / セルフホスト**: `config.toml` の `content_path` がそのまま適用される。**`config.toml` やテンプレート変更後は `supabase stop && supabase start`（= `stop && supabase-start`）で再起動**しないと反映されない。
- **本番（hosted）**: **Supabase の GitHub 連携（config 同期）に委譲**する（本リポジトリ方針）。Dashboard での手動コピペ運用はしない。

> ⚠️ 注意（公式仕様）: 公式ドキュメント上、hosted プロジェクトではメールテンプレート**本文**が `supabase config push` 単体では反映されないケースがある（[customizing-email-templates](https://supabase.com/docs/guides/local-development/customizing-email-templates)）。GitHub 連携で本文が同期されない場合のフォールバックは Management API（`PATCH /v1/projects/{ref}/config/auth` の `mailer_subjects_*` / `mailer_templates_*_content`）または Dashboard。**フォールバックが必要になった場合は勝手に実装せずユーザーに判断をあおぐこと**。

---

## 3. Secrets は必ず `env()`（平文禁止）

```toml
# ❌ 平文 Secret を config.toml に直書き
[auth.external.github]
secret = "ghp_xxxxxxxxxxxx"

# ✅ env() で外部化（env/backend/.env.<profile> から注入）
[auth.external.github]
enabled   = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID)"
secret    = "env(SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET)"
```

- OAuth provider の `secret`、SMTP の `pass`、Auth Hook の `secrets` はすべて `env()`。
- `.env` / `.env.*` は `.gitignore` 済み（`supabase/.gitignore` / root `.gitignore`）。Git に平文 Secret を入れない。
- `site_url` など環境差分が出る値は `[remotes.<project_id>.*]` で上書き（ローカル URL を本番でハードコードしない）。

---

## 4. Dashboard 手動変更の禁止

**NEVER**: Supabase Dashboard で Auth / Storage / API / メールテンプレート等のサービス設定を手動変更する。

- Dashboard 手動変更は **レビュー不能・再現不能・drift の温床**。
- すべて `config.toml` → PR → GitHub 連携（config 同期）で反映する。
- 本番の設定を変えたいときは `config.toml`（または `[remotes.production.*]`）を編集して PR を出す。

---

## 5. 調査・操作時のツール選択（既存ルールとの関係）

| 場面 | 使うもの | 参照ルール |
|------|---------|-----------|
| Supabase インフラの**調査・運用操作**（SQL 実行 / ログ / advisors 等） | `supabase` / `supabase-prod` MCP | `.claude/rules/mcp-supabase.md` |
| `config.toml` の**編集** | このルール（Config-as-Code） | 本ファイル |
| **DB スキーマ / RLS / migration** | Drizzle + `devenv tasks run app:migrate-dev`（本番は承認必須） | `.claude/rules/database.md` |
| ローカル反映 | `stop && supabase-start`（再起動で config 反映） | `.claude/CLAUDE.md` |
| 本番デプロイ | GitHub 連携（config 同期） / `devenv tasks run -P <env> deploy:supabase` | `.claude/skills/supabase-config/` |

> `psql` / `curl` / `supabase` CLI を Bash で直接叩いてインフラを調査・操作するのは `mcp-supabase.md` どおり禁止。`config.toml` の編集は通常のファイル編集として行う。

---

## 6. 禁止パターンまとめ

```toml
# ❌ メールテンプレートを Dashboard に手書き（Git 管理外）
# → 必ず supabase/templates/email/*.html + [auth.email.template.*] で配線

# ❌ content_path を使わずテンプレHTMLを config.toml に直書き
[auth.email.template.confirmation]
content = "<html>...</html>"   # 巨大化・レビュー困難。content_path を使う

# ❌ 平文 Secret
secret = "abc123"

# ❌ Auth/Storage/API 設定を Dashboard で直接いじる（drift）

# ❌ DB スキーマや RLS を config.toml に書こうとする
# → これは Drizzle (drizzle/schema/*.ts) の責務
```

---

## 7. 強制事項

このポリシーは**交渉の余地なし**。

- Supabase のサービス設定は **`config.toml` に集約**（DB のみ Drizzle 例外）。
- メールテンプレートは **`supabase/templates/email/*.html` + `[auth.email.template.*]` の `content_path`** で Git 管理。
- Secret は **`env()`**。Dashboard 手動変更は **禁止**。
- 本番反映は **GitHub 連携（config 同期）**に委譲。フォールバックが必要なときは**ユーザーに判断をあおぐ**。
