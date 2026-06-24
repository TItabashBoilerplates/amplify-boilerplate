# Skills-First Policy

**MANDATORY / NON-NEGOTIABLE**: 調査・実装・レビュー・デバッグ等、**あらゆるタスクを開始する前に、必ず利用可能な Skill を確認**し、該当するものがあれば**そのタスクの最初の行動として `Skill` ツールで起動**すること。

このリポジトリには Next.js / Supabase / Drizzle / FSD / shadcn / gluestack / Better Auth / Stripe / Resend / Maestro / LangChain / TanStack Query 等、**広範な技術スタックに対応した Skill が多数登録されている**。これらを活用せずに推測・記憶ベースで実装を進めることは禁止する。

## いつ Skill を確認するか

以下のすべての場面で、**作業を始める前**に Skill 一覧を確認すること:

| 場面 | 例 |
|---|---|
| 新規実装 | 認証フロー、決済導線、メール送信、UI コンポーネント、API ルート等 |
| 既存コードの改修・リファクタ | パフォーマンス改善、レンダリング最適化、コード整理 |
| 調査タスク | 「〜の使い方を調べて」「〜は何が原因か」 |
| デバッグ | プロセス起動失敗、Supabase 接続エラー、ハイドレーション、型エラー等 |
| 設定・セットアップ | Tailwind / NativeWind、認証プラグイン、CI/CD ワークフロー、テスト設定 |
| レビュー | UI レビュー、セキュリティレビュー、PR レビュー |
| アーキテクチャ判断 | FSD のレイヤー配置、モノレポ構成、状態管理方針 |

## 作業開始前のフロー（必須）

```
1. ユーザー指示を受ける
2. システムプロンプト内の available skills 一覧を確認
3. 該当 / 関連する Skill を特定
   ├─ 完全一致あり    → 最初に Skill ツールで起動
   ├─ 部分一致あり    → 関連 Skill を起動して指針を取り込む
   └─ 該当なし        → CLAUDE.md / .claude/rules/ / .claude/skills/ を参照
4. Skill のガイダンスに従って作業を進める
5. それでも情報が足りなければ Context7 MCP / WebSearch / WebFetch で公式ドキュメントを参照
```

> **注**: Skill 一覧は `system-reminder` でセッション開始時に提示される。一覧の更新があればその時点で再確認する。`find-skills` Skill を使えば特定の用途に合った Skill を検索できる。

## 主要トリガーと対応 Skill（参考表）

ユーザーの指示に以下のキーワードが含まれていたら、**まず対応 Skill を起動**することを検討する。完全な一覧はセッション冒頭の available skills を参照のこと。

| キーワード / 文脈 | 起動候補 Skill |
|---|---|
| Supabase / RLS / Auth / Storage / Edge Functions | `supabase`, `supabase-postgres-best-practices`, `rls`, `supabase-config`, `pgtap` |
| MCP サーバ (Edge Functions) / BYO MCP / Streamable HTTP / Hono MCP | `edge-functions-mcp` |
| Next.js / App Router / Server Components / Cache | `nextjs`, `next-best-practices`, `next-cache-components`, `next-upgrade` |
| Drizzle / スキーマ / マイグレーション | `drizzle` |
| FSD / レイヤー / スライス | `fsd`, `feature-sliced-design` |
| モノレポ / Bun workspace / Turborepo | `monorepo`, `turborepo` |
| Python モノレポ / uv workspace / backend-py の apps・packages / src-layout / MCP サーバ追加 | `python-monorepo` |
| shadcn/ui / TailwindCSS | `shadcn`, `shadcn-ui`, `web-design-guidelines`, `frontend-design` |
| gluestack / NativeWind / Expo / RN | `gluestack-ui-v4`, `tailwind-setup`, `building-ui`, `building-native-ui`, `vercel-react-native-skills`, `use-dom`, `expo-deployment`, `dev-client`, `expo-dev-client`, `upgrading-expo`, `expo-cicd-workflows`, `cicd-workflows`, `expo-tailwind-setup`, `expo-api-routes`, `api-routes` |
| TanStack Query | `tanstack-query` |
| 状態管理 / 取得 (web) | `data-fetching` |
| 状態管理 / 取得 (mobile) | `native-data-fetching` |
| Better Auth | `better-auth-best-practices`, `email-and-password-best-practices`, `two-factor-authentication-best-practices`, `organization-best-practices`, `better-auth-security-best-practices`, `create-auth-skill`, `Better Auth Best Practices` |
| Stripe / 決済 / サブスク | `stripe-integration`, `stripe-best-practices` |
| Resend / メール送信 / Webhook | `resend`, `resend-cli`, `send-email`, `react-email`, `email-best-practices`, `agent-email-inbox` |
| LangChain / LangGraph / LangSmith / エージェント | `langchain` |
| Storybook | `storybook` |
| Maestro / E2E | `maestro` |
| 単体テスト (Python) | `python-testing` |
| FastAPI / backend-py / API ルーティング・Pydantic | `fastapi`, `python-monorepo` |
| 開発チェック / CI 通し | `dev-check` |
| ロギング | `logger` |
| 日時処理 / タイムゾーン | `datetime` |
| シードデータ | `seed` |
| Hey API / OpenAPI クライアント生成 | `hey-api` |
| デバッグ手順 (devenv / Supabase) | `debugging` |
| Doppler / シークレット管理 / secret manager / .env 暗号化 / トークン取り扱い | `doppler` |
| 多言語対応 / next-intl | `i18n` |
| Figma 連携 | `figma:figma-*` |
| UI 一般 / レビュー / アクセシビリティ | `ui-ux-pro-max`, `web-design-guidelines`, `vercel-react-best-practices`, `vercel-composition-patterns` |
| PR レビュー / セキュリティレビュー | `review`, `security-review` |
| シンプル化 | `simplify` |
| Skill / 設定の作成・拡張 | `skill-creator`, `find-skills`, `update-config`, `keybindings-help`, `fewer-permission-prompts` |

> 上の表は静的な参考にすぎない。**正本はセッション冒頭の `system-reminder` に提示される available skills**。表に載っていない Skill が存在する可能性があるため、必ず一覧を直接確認すること。

## 起動方法

```
Skill ツールを呼び出す:
  - skill: Skill 名（available skills に記載されたとおり、`/` を付けない）
  - args:  必要に応じて引数を渡す
```

ユーザーが `/skill-name` 形式で明示的に指定した場合も Skill ツール経由で起動する。**事前に Skill 一覧に含まれていないものを推測で叩いてはならない**。

## 禁止事項

**NEVER**:
- Skill 一覧を確認せずに調査・実装を開始する
- 「自分の知識で十分」「以前似たことをやった」という理由で Skill を飛ばす
- Skill が示すワークフロー・配置規約・チェックリストを無視して独自実装する
- ユーザーの指示に該当 Skill がある状態で、Skill を起動せずに `Bash` / `Edit` / `Write` を先に動かす

```
# ❌ NG: Supabase 関連の作業を Skill 確認なしに始める
ユーザー: 「RLS ポリシーを users テーブルに追加して」
Claude: → いきなり drizzle/schema/users.ts を編集

# ✅ OK: 先に Skill を起動して指針を確認
ユーザー: 「RLS ポリシーを users テーブルに追加して」
Claude: → `rls` Skill を起動 → `supabase` Skill を確認 → ガイダンスに従って drizzle/schema を編集
```

## 既存の Research-First / Command ポリシーとの関係

| ポリシー | 役割 |
|---|---|
| **`skills-first.md`（このファイル）** | **最初**: タスク開始時に該当 Skill を起動 |
| `.claude/rules/research.md` | Skill で足りない部分を Context7 MCP / WebSearch / WebFetch で補完 |
| `.claude/rules/commands.md` | コマンド実行時は devenv の scripts / tasks を使用 |
| `.claude/rules/mcp-supabase.md` | Supabase インフラ操作は `supabase` / `supabase-prod` MCP |
| `.claude/rules/mcp-doppler.md` | Doppler シークレットの読み書きは `doppler` MCP（書込はフェーズ制: 初期構築=full / 本番=prd 承認制・値の露出禁止） |

**起動順は: Skill → Research（公式ドキュメント） → 実装（devenv コマンド / MCP） → All Green 確認**。

## なぜこのポリシーが必要か

1. **整合性**: Skill には本リポジトリのアーキテクチャ・規約（FSD、devenv、Supabase-first、TDD、エラーハンドリング、i18n 等）に揃った最新の指針が組み込まれている
2. **再現性**: 同じタスクを違うセッションでやっても同じ Skill が同じ判断軸を提供する
3. **最新性**: Skill は Context7 などと連携し、ライブラリの最新 API に追従する
4. **重複防止**: 既存 Skill のワークフローを使えば独自実装やコード重複を避けられる
5. **ユーザー意図との整合**: ユーザーがプロジェクトに登録した Skill は「この方針で進めてほしい」というユーザー要望そのもの

## 強制事項

このポリシーは**交渉の余地なし**。Skill を確認せずに作業を開始した実装は**やり直し**となる。
