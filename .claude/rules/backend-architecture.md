# Backend Architecture Policy

**MANDATORY / NON-NEGOTIABLE**: バックエンドの既定は **Amplify のベストプラクティス構成**
（TypeScript の Amplify Functions）。Python バックエンドは**特殊要件があるときだけ**用意する。

## 1. 既定: TypeScript（Amplify Functions / Node）

新規のバックエンド処理は、原則この順で検討する:

1. **まず Amplify Data（AppSync + DynamoDB）で直接できないか**（CRUD・認可・リアルタイムは関数不要）。
2. バックエンド処理が必要なら **Node `defineFunction`（TypeScript）** で実装する。
   - 置き場所: `frontend/packages/backend/amplify/functions/<name>/`。
   - REST は **Hono**（`hono/aws-lambda`）、MCP は **`@hono/mcp` + `@modelcontextprotocol/sdk`**。
   - 共有ロジックは **`@workspace/backend-core`**（`frontend/packages/backend-core`）。
   - 既存の `functions/rest-api` / `functions/mcp` を雛形にする。
3. AppSync のカスタムロジックは `a.query` / `a.mutation` + `a.handler.function`（TS）も第一候補。

`defineFunction` は Amplify ネイティブ（型・バンドル・env/secret・トリガー連携が一級）。**理由なく Python を選ばない。**

## 2. Python を選ぶ条件（escalation only）

以下に**明確に該当する場合のみ** `backend-py`（FastAPI on Lambda / Python MCP）を使う:

| Trigger | 例 |
|---|---|
| **LLM / エージェント** | LangChain / LangGraph / RAG / 構造化出力（`.claude/rules/backend-py.md` の LLM ポリシー） |
| **長時間・重い処理** | Function URL（同期・最大 15 分）を超える、バッチ、重い数値計算 |
| **Python 固有ライブラリ** | pandas / numpy / ML 系 / Python だけにある SDK |
| **既存 Python 資産** | 既に Python で書かれた資産の再利用 |

いずれにも該当しなければ Python を使わない。**判断に迷う場合はユーザーに確認**する
（`.claude/rules/feedback_ask_user_when_unsure.md`）。

## 3. パッケージマネージャ（厳守）

| 対象 | マネージャ | コマンド |
|---|---|---|
| **TypeScript / Node**（`frontend/` 全体・Amplify Functions の依存） | **bun** | `bun add <pkg>` / `bun install` |
| **Python**（`backend-py/`） | **uv** | `uv add --package <member> <pkg>` / `uv sync` |
| **CLI runner** | **bunx** | `bunx ampx ...`（npx は使わない）。Amplify backend は devenv script（`sandbox` 等）優先 |

- **npm / pnpm / yarn は使わない**（TS 側は bun に統一。`frontend/package.json` は `packageManager: bun`）。
- 例外: Amplify Hosting のビルドイメージに bun が無いため `amplify.yml` の **bootstrap だけ** `npm install -g bun`
  を許容する（その後は `bun install` / `bunx ampx`）。

## 4. 強制事項

- バックエンドの新規実装で**正当な escalation 理由なく Python を選んだ場合はやり直し**。
- TS 依存追加に `npm`/`pnpm`/`yarn` を使った場合もやり直し（`bun` を使う）。
- 関連: `.claude/rules/backend-py.md`（Python 規約）/ `.claude/skills/amplify-gen2`（実装ガイド）/
  `.claude/rules/commands.md`（devenv コマンド）。
