# Development Command Policy

**CRITICAL / NON-NEGOTIABLE**: Always use **devenv** commands (scripts on PATH or `devenv tasks run <name>`) for development. Direct execution of underlying tools (bun/uv/biome/ruff/tsc/ampx) is **strictly prohibited**.

**Makefile は deprecated**。`make X` は使わない。誤って叩いた場合は案内メッセージのみが出る。

**特に品質チェック（lint, format, type-check, test, build, ci-check）は例外なく devenv のコマンドを使うこと。**

## devenv コマンドの種類

| 種類 | 使い方 | 例 |
|---|---|---|
| **Scripts** (PATH 直結) | コマンド名を直接打つ | `bootstrap`, `lint`, `format`, `type-check-frontend`, `type-check-backend-py`, `unit-test`, `dev-web`, `dev-mobile`, `storybook`, `sandbox`, `sandbox-once`, `sandbox-delete`, `lint-frontend`, `format-backend-py`, `skills-update`, `skills-restore` |
| **Processes** (常駐サービス) | `devenv up [PROCESSES...]` | `devenv up` (dev サーバ群), `devenv up web` |

scripts は devenv shell（direnv 自動アクティベート含む）下で PATH 上に存在する。direnv 未活性のセッションでは `devenv shell -- <command>` 経由で呼び出す。

## Required Commands（品質チェック）

**ALWAYS use** these scripts for the following operations:

| Operation | Command |
|-----------|---------|
| **Linting (all)** | `lint` |
| **Linting (per project)** | `lint-frontend`, `lint-backend-py`, `lint-fsd` |
| **Linting (CI mode)** | `lint-frontend-ci`, `lint-backend-py-ci`（通常は `ci-check` から呼ばれる） |
| **Formatting (all)** | `format` |
| **Formatting (per project)** | `format-frontend`, `format-backend-py` |
| **Format check (CI)** | `format-check`（個別: `format-frontend-check`, `format-backend-py-check`） |
| **Type check (all)** | `type-check` |
| **Type check (per project)** | `type-check-frontend`, `type-check-mobile`, `type-check-backend-py` |
| **Build** | `build-frontend`, `build-storybook`, `build-mobile-ios`, `build-mobile-android` |
| **Tests (unit)** | `unit-test` (all), `test-frontend` (Vitest), `test-backend-py` (pytest) ※ `test` は bash 組み込みと衝突するため `unit-test` |
| **Tests (E2E)** | `e2e`, `e2e-web`, `e2e-mobile` (Maestro) |
| **CI Check (full gate)** | `ci-check` (= `devenv test`、execIfModified キャッシュで incremental) |
| **CI Check (直叩き)** | `devenv test` (`ci:check` aggregator task が `before = devenv:enterTest`) |
| **Amplify backend (sandbox)** | `sandbox` (= `ampx sandbox`), `sandbox-once`, `sandbox-delete` |
| **Services (dev サーバ)** | `dev-web`, `dev-mobile`, `storybook`, または `devenv up <names...>` |
| **Services (devenv 外)** | `frontend` (turbo dev), `mobile-ios`, `mobile-android`, `mobile-web` (Expo TUI) |

## Amplify backend（sandbox / deploy）

データモデル・認可・ストレージ・関数の変更は `frontend/packages/backend/amplify/` を編集し、
`ampx sandbox` で per-dev のクラウド sandbox に反映する（Supabase ローカル Docker の代替）。

| Operation | Command |
|---|---|
| **Sandbox 起動（watch + amplify_outputs.json 生成）** | `sandbox` (= `ampx sandbox`) |
| **Sandbox 1 回デプロイ** | `sandbox-once` |
| **Sandbox 破棄** | `sandbox-delete` |
| **本番/ブランチデプロイ** | Amplify Hosting が `amplify.yml` に従い `ampx pipeline-deploy` を実行（CI） |
| **依存ブートストラップ** | `bootstrap`（frontend: bun / backend-py: uv）。通常は `devenv shell` 進入時に自動 |
| **エージェントスキル更新** | `skills-update`（最新化）/ `skills-restore`（lock から復元）。`devenv shell` 進入時に 1 日 1 回バックグラウンド自動更新（`SKILLS_AUTOUPDATE=0` で無効・`SKILLS_AUTOUPDATE_INTERVAL=<秒>` で間隔変更） |

> ⚠️ `sandbox` / デプロイには AWS 認証情報（プロファイル）が必要。

## Prohibited Direct Commands（品質チェック）

以下のような直接実行は**絶対に禁止**。必ず devenv の scripts / tasks を使うこと：

```bash
# ❌ 絶対に直接実行しない
cd frontend && bun run biome check --write
cd frontend && bun run biome format --write
cd frontend && bun run tsc --noEmit
cd frontend && bun run vitest
cd backend-py && uv run ruff check
cd backend-py && uv run ruff format
cd backend-py && uv run mypy
cd backend-py && uv run pytest
cd frontend/packages/backend && bunx ampx sandbox
npx tsc --noEmit

# ❌ Makefile は削除済み — `make X` は `make: *** No targets. Stop.` でエラー終了する
make lint
make ci-check
make migrate-dev

# ✅ 必ず devenv scripts または tasks を使用
lint                              # 全体 lint
lint-frontend                     # Frontend lint
lint-backend-py                   # Backend lint
format                            # 全体 format
format-frontend                   # Frontend format
format-backend-py                 # Backend format
type-check                        # 全体型チェック
type-check-frontend               # Frontend 型チェック
type-check-backend-py             # Backend 型チェック
ci-check                          # CI チェック (lint + format + type)
sandbox                           # Amplify sandbox 起動 (= ampx sandbox)
```

## Exceptions

Direct command execution is allowed ONLY for:
- **Reading files**: `cat`, `less`, `head`, `tail` (prefer Read tool)
- **Listing files**: `ls`, `find`, `tree` (prefer Glob tool)
- **Git operations**: `git status`, `git diff`, `git log` (read-only)
- **Package info**: `bun list`, `npm list`, `uv pip list` (read-only)

## 品質チェック設計（2 段階構成）

公式 devenv の推奨パターンに従い、品質チェックは **役割を分けた 2 段階構成**:

### 段階 1: コミット時の差分チェック (git-hooks)

`.pre-commit-config.yaml` は `git-hooks.nix` ビルトインを使う:

| Hook | 対象 |
|---|---|
| `biome` | JS/TS/JSON (lint + format、auto-fix、`pass_filenames=true` で変更ファイルのみ) |
| `ruff` | Python lint (`pass_filenames=true`) |
| `ruff-format` | Python format |
| `mypy` | Python type check |

`prek` (Rust 実装) が pre-commit を駆動。**コミット 1 回 < 200ms** が普通。

### 段階 2: CI / 手動 verify (devenv test)

`devenv test` を叩くと `ci:check` aggregator task が起動し、配下の verify task が並列・キャッシュ実行される:

```
devenv test
└── ci:check (before = [devenv:enterTest])
    ├── lint-ci:frontend / backend-py / fsd      (execIfModified)
    ├── format-check:frontend / backend-py        (execIfModified)
    └── type-check:frontend / mobile / backend-py (execIfModified)
```

- `execIfModified` で **mtime + content hash** チェック → 変更なしならスキップ
- キャッシュ: `.devenv/` 配下、`devenv-tasks` Rust binary が管理
- 何も変更してなければ全 task キャッシュヒット → 数秒で完了
- **ローカル**: `devenv test` (= `ci:check` aggregator、`before = devenv:enterTest` で processes も整える) を主に使う
- **CI** (`.github/workflows/ci.yml`): Storybook 等の常駐 process を毎回起動したくないため、`devenv test` ではなく **配下の verify task (`lint-ci:* / format-check:* / type-check:*`) を直接列挙**して呼ぶ。verify ロジック（execIfModified キャッシュ含む）は同一だが process phase をスキップする

> **使い分け**: 日常の auto-fix は `lint` / `format` script (シンプル sequential、execIfModified なし → 副作用ループ回避)。CI 相当の verify はローカルでは `ci-check` または `devenv test`、CI では verify task の直接列挙。

## devenv script 命名規則（MANDATORY）

devenv の `scripts.<name>` で新規 script を定義する際は、**bash 組み込みコマンドと衝突する名前を使用してはならない**。

| 禁止例（bash builtin 衝突） | 安全な代替 |
|---|---|
| `test` | `unit-test`, `test-frontend` |
| `time` | `bench`, `time-it` |
| `kill`, `printf`, `read`, `true`, `false`, `let`, `local`, `set`, `trap`, `wait`, `exec`, `eval`, `command`, `type`, `hash`, `exit`, `echo` 等 | ハイフン付きの具体的な名前 |

**理由**: bash は **builtin を PATH より優先**するため、衝突する名前で script を定義しても CI の `run: <script>` で**builtin が呼ばれて意図と違う挙動になる**。`test` の場合は引数なしで exit 1 が返って `-e` で即落ちした事故が実際に起きている（`.claude/skills/devenv-cicd/SKILL.md` 「過去の事故と教訓」参照）。

**確認方法**: 新規 script を `devenv.nix` に追加する前に必ず `type <name>` で組み込みでないことを確認する。

```bash
type test           # → test is a shell builtin   ❌ 使用不可
type unit-test      # → unit-test not found       ✅ 使用可（または既存 script なら PATH のパス表示）
```

ハイフン付きの kebab-case（`lint-frontend`, `format-check`, `test-db`, `unit-test`, `dev-web` など）は builtin と衝突しないので安全。本リポジトリの既存命名もこれを踏襲している。

## Enforcement

This command usage policy is **CRITICAL and NON-NEGOTIABLE**.

品質チェックを直接コマンドで実行することは、以下の問題を引き起こす：
- 環境依存の差異による不整合
- CI/CD パイプラインとの乖離
- 意図しない副作用（設定差異によるフォーマット崩れ等）
- profile (env) 設定が読み込まれず、本番設定で local 開発するリスク

**違反は一切許容しない。**
