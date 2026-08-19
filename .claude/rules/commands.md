# Development Command Policy

**CRITICAL / NON-NEGOTIABLE**: Always use **devenv** commands (scripts on PATH) for development. Direct execution of underlying tools (pnpm/uv/biome/ruff/tsc/ampx) is **strictly prohibited**.

**Makefile は deprecated**。`make X` は使わない。誤って叩いた場合は案内メッセージのみが出る。

**特に品質チェック（lint, format, type-check, test, build, ci-check）は例外なく devenv のコマンドを使うこと。**

## devenv コマンドの種類

| 種類 | 使い方 | 例 |
|---|---|---|
| **Scripts** (PATH 直結) | コマンド名を直接打つ | `bootstrap`, `lint`, `format`, `type-check`, `unit-test`, `ci-check`, `dev-web`, `dev-mobile`, `dev-desktop`, `storybook`, `sandbox`, `skills-update` |
| **Processes** (常駐サービス) | `devenv up [PROCESSES...]` | `devenv up`（backend を起動） |
| **Profiles** (opt-in の重い toolchain) | `devenv shell -P <name> -- <command>` | `-P desktop`（Tauri の WebKitGTK）/ `-P store-listing`（chromium + imagemagick） |

**全 script の一覧は `devenv.nix` の `scripts` が正本**（`devenv shell` に入ると
`enterShell` が主要なものを表示する）。

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
| **Build** | `build-frontend`（turbo build: web + desktop）, `build-storybook`, `build-desktop`（要 `-P desktop`） |
| **Storybook の描画検査** | `verify-storybook-render`（`build-storybook` 済みが前提） |
| **Tests (unit)** | `unit-test` (all), `test-frontend` (Vitest), `test-backend-py` (pytest) ※ `test` は bash 組み込みと衝突するため `unit-test` |
| **Tests (E2E)** | `e2e`, `e2e-web`, `e2e-mobile` (Maestro) |
| **CI Check (full gate)** | **`ci-check`**（= `scripts/ci/check.sh`。`frontend` / `backend` を引数で絞れる） |
| **Amplify backend (sandbox)** | `sandbox` (= `ampx sandbox`), `sandbox-once`, `sandbox-delete` |
| **Services (dev サーバ)** | `dev-web`, `dev-mobile`, `dev-desktop`, `storybook` |
| **Services (Expo の対話 TUI)** | `mobile-ios`, `mobile-android`, `mobile-web` |
| **Desktop (Tauri ネイティブ)** | `devenv shell -P desktop -- tauri-desktop` / `-- build-desktop` |
| **モバイルのリリース / ストア反映** | `store-preflight`, `store-status`, `mobile-release-ios`, `mobile-release-android`, `store-*`（`docs/store/release-runbook.md`） |

## Amplify backend（sandbox / deploy）

データモデル・認可・ストレージ・関数の変更は `frontend/packages/backend/amplify/` を編集し、
`ampx sandbox` で per-dev のクラウド sandbox に反映する（Supabase ローカル Docker の代替）。

| Operation | Command |
|---|---|
| **Sandbox 起動（watch + amplify_outputs.json 生成）** | `sandbox` (= `ampx sandbox`) |
| **Sandbox 1 回デプロイ** | `sandbox-once` |
| **Sandbox 破棄** | `sandbox-delete` |
| **本番/ブランチデプロイ** | Amplify Hosting が `amplify.yml` に従い `ampx pipeline-deploy` を実行（CI） |
| **依存ブートストラップ** | `bootstrap`（frontend: pnpm / backend-py: uv）。通常は `devenv shell` 進入時に自動 |
| **エージェントスキル更新** | `skills-update`（最新化）/ `skills-restore`（lock から復元）。`devenv shell` 進入時に 1 日 1 回**同期・ロック付き**で自動更新（更新完了までシェルは待機 → 半端な状態で起動しない。`SKILLS_AUTOUPDATE=0` で無効・`SKILLS_AUTOUPDATE_INTERVAL=<秒>` で間隔変更） |

> ⚠️ `sandbox` / デプロイには AWS 認証情報（プロファイル）が必要。

## Prohibited Direct Commands（品質チェック）

以下のような直接実行は**絶対に禁止**。必ず devenv の scripts / tasks を使うこと：

```bash
# ❌ 絶対に直接実行しない
cd frontend && pnpm run biome check --write
cd frontend && pnpm run biome format --write
cd frontend && pnpm run tsc --noEmit
cd frontend && pnpm run vitest
cd backend-py && uv run ruff check
cd backend-py && uv run ruff format
cd backend-py && uv run mypy
cd backend-py && uv run pytest
cd frontend/packages/backend && pnpm dlx ampx sandbox
npx tsc --noEmit

# ❌ Makefile は削除済み — `make X` は `make: *** No targets. Stop.` でエラー終了する
make lint
make ci-check

# ✅ 必ず devenv scripts を使用
lint                              # 全体 lint
lint-frontend                     # Frontend lint
lint-backend-py                   # Backend lint
format                            # 全体 format
format-frontend                   # Frontend format
format-backend-py                 # Backend format
type-check                        # 全体型チェック
type-check-frontend               # Frontend 型チェック
type-check-backend-py             # Backend 型チェック
ci-check                          # CI と同一の検査（lint + format + type、auto-fix しない）
sandbox                           # Amplify sandbox 起動 (= ampx sandbox)
```

## Exceptions

Direct command execution is allowed ONLY for:
- **Reading files**: `cat`, `less`, `head`, `tail` (prefer Read tool)
- **Listing files**: `ls`, `find`, `tree` (prefer Glob tool)
- **Git operations**: `git status`, `git diff`, `git log` (read-only)
- **Package info**: `pnpm list`, `npm list`, `uv pip list` (read-only)

## 品質チェック設計

### auto-fix する日常用 / 落とすだけの CI 用

| 用途 | コマンド | 挙動 |
|---|---|---|
| 日常（書きながら直す） | `lint` / `format` | **auto-fix する**（`biome check --write` / `ruff --fix`） |
| CI と同じ検査 | **`ci-check`** | **auto-fix しない**（`biome ci` / `ruff format --check`）。差分があれば落ちる |

**CI で auto-fix してはならない。** 直った状態で緑になり、誰もコミットしないまま
次の CI でまた落ちる（直っていないのに直ったように見える一番たちの悪い状態）。

### 検査の一覧は `scripts/ci/check.sh` が単一の正本

```
ci-check（devenv script）  ─┐
                            ├─→ scripts/ci/check.sh   ← 検査の列挙はここだけ
.github/workflows/ci.yml  ─┘
```

**検査を足すときは必ず `scripts/ci/check.sh` に書く。** ローカルと CI で別々に
列挙すると「CI では見ているのにローカルでは見ていない（逆も）」という drift が起き、
どちらかが必ず腐る。CI の yml に検査を直接足すのは禁止。

`ci-check` が回すもの:

| 対象 | 何を守っているか |
|---|---|
| Biome（`frontend/`） | フォーマットと基本 lint |
| Biome（リポジトリルート: `scripts/` `.maestro/`） | **`frontend/biome.json` とは別設定**。frontend から回す biome はここを見ない |
| ESLint（web / mobile） | Biome が見ない React Hooks / Next / Expo の規則 |
| ESLint FSD boundaries（web / mobile / desktop） | レイヤーの依存方向。**Biome も既定の ESLint severity も見ない** |
| `tsc --noEmit`（turbo） | 型 |
| ruff check / ruff format --check / mypy（backend-py） | Python |

`unit-test`（vitest + pytest）と `build-frontend` / `build-storybook` +
`verify-storybook-render` は **`ci-check` に含めない**（実行時間が桁違いなので分けてある）。
CI ではそれぞれ別 step / 別 job で回す。

### backend-py は `uv run --all-packages` が必須（mypy / pytest）

`backend-py` は uv の **virtual workspace**（root が `package = false`）。素の `uv run` は
root の dependency-group（ruff / mypy / pytest）しか同期せず、member の依存
（fastapi / pydantic / structlog 等）を入れない。その状態では:

- **mypy**: third-party が全部 `Any` に見え、strict の `untyped-decorator` 等が
  **壊れていないコードに対して**誤爆する
- **pytest**: conftest の import が解決できず collection error になる

ruff は import を解決しないので `--all-packages` は不要。

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

ハイフン付きの kebab-case（`lint-frontend`, `format-check`, `ci-check`, `unit-test`, `dev-web` など）は builtin と衝突しないので安全。本リポジトリの既存命名もこれを踏襲している。

## Enforcement

This command usage policy is **CRITICAL and NON-NEGOTIABLE**.

品質チェックを直接コマンドで実行することは、以下の問題を引き起こす：
- 環境依存の差異による不整合
- CI/CD パイプラインとの乖離
- 意図しない副作用（設定差異によるフォーマット崩れ等）
- profile (env) 設定が読み込まれず、本番設定で local 開発するリスク

**違反は一切許容しない。**
