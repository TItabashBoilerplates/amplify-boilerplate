# Python Monorepo (uv Workspace) Policy

**MANDATORY / NON-NEGOTIABLE**: `backend-py/` 配下に複数の Python サーバ・共有ライブラリを置く場合は、本ドキュメントの構造・命名・コマンドポリシーに厳密に従うこと。

このポリシーは公式 ([uv workspaces docs](https://docs.astral.sh/uv/concepts/projects/workspaces/) / [PyPA src layout](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/) / [pytest Good Integration Practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html)) を出典として導出している。詳細な解説と出典は `.claude/skills/python-monorepo/SKILL.md` を参照。

## 1. ディレクトリ構造（強制）

```
backend-py/
├── pyproject.toml              # workspace root（package = false）
├── uv.lock                     # 単一ルート lockfile（CI でも個別 lock を作らない）
├── .python-version             # ルート 1 か所のみ
├── pyrightconfig.json
├── apps/
│   └── <service>/              # 実行可能サービス（FastAPI / MCP / CLI 等）
│       ├── pyproject.toml      # name=<service>, dependencies に "core" 等の workspace dep を宣言
│       ├── src/<pkg>/          # ← src-layout 必須
│       │   ├── __init__.py
│       │   ├── app.py / main.py 等
│       │   └── ...
│       ├── tests/              # ← __init__.py を**置かない**
│       └── README.md
└── packages/
    └── <lib>/                  # サービス横断で共有するライブラリ（実行可能でない）
        ├── pyproject.toml      # name=<lib>
        ├── src/<lib>/          # ← src-layout 必須
        ├── tests/
        └── README.md
```

**禁止構造**:

- ❌ `apps/<service>/<pkg>/` のような **flat layout**（src/ を省略）
- ❌ `apps/<service>/uv.lock` のような **member 別の lockfile**
- ❌ `apps/<service>/.python-version` のような **member 別の python-version**
- ❌ `apps/<service>/{ruff,mypy,pytest}.toml` のような **member 別の tooling 設定ファイル**（root pyproject.toml に集約）
- ❌ `tests/__init__.py` の配置（`apps/api/tests` と `packages/core/tests` で package 名 `tests.*` が衝突する）

## 2. workspace root の `pyproject.toml`

最低限の MUST 要素:

```toml
[project]
name = "backend-py-workspace"
version = "0.0.0"
requires-python = ">=3.13"

[tool.uv]
package = false                       # root 自体は配布物にしない

[tool.uv.workspace]
members = ["apps/*", "packages/*"]

[tool.uv.sources]
# 各 member を workspace dependency として宣言（member の dependencies に書いた名前と一致させる）
core = { workspace = true }
api  = { workspace = true }
# 新規 member 追加時はここに 1 行追加

[dependency-groups]
dev = ["ruff", "mypy", "pytest", "pytest-asyncio", "pytest-mock", "httpx", "..."]

[tool.ruff]
target-version = "py313"
# ...
[tool.mypy]
mypy_path = "apps/<svc1>/src:packages/<lib1>/src:..."  # 各 member の src を列挙
[tool.pytest.ini_options]
testpaths = ["apps/*/tests", "packages/*/tests"]
addopts = "-ra -q --import-mode=importlib"            # importlib モード必須
# pythonpath は設定しない（editable install で解決）
```

**`pythonpath` を pytest 設定に書くのは禁止**。editable install と冗長で、flat-layout の workaround を持ち込むことになる。

## 3. 各 member の `pyproject.toml`

```toml
[project]
name = "<member-name>"               # 公式 PyPI パッケージと衝突しないこと（後述）
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    "<runtime-deps>",
    "core",                          # workspace dep は `[tool.uv.sources]` で解決される
]

[project.scripts]
# サービスが entrypoint を持つ場合
<service> = "<pkg>.main:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/<pkg>"]             # src-layout 用の必須宣言
```

`<member-name>` (project.name) と `<pkg>` (src/ 配下のディレクトリ名 / import 名) は**別物**で OK。例: project name `mcp-server`、import 名 `mcp_server`。

## 4. 命名規約（PyPI shadow 回避）

**MUST**: `src/<pkg>/` の `<pkg>` 名は、依存している外部 PyPI パッケージと衝突しないこと。

| 状況 | NG | OK |
|---|---|---|
| 公式 MCP SDK (`mcp`) を依存している MCP サーバ | `src/mcp/` | `src/mcp_server/` |
| `openai` を依存している自前 AI ラッパー | `src/openai/` | `src/openai_client/` / `src/llm/` |
| 一般のサービス（外部依存なし） | — | `src/api/`, `src/core/` 等 |

`<pkg>` 名が外部パッケージと一致すると editable install 後の venv 内で **import shadow** が起き、本物の SDK の import が `ModuleNotFoundError` で落ちる。回避は `<pkg>` を別名にするのみ。

## 5. テスト構造

**MUST**:

- 各 member の `tests/` には **`__init__.py` を置かない**
- 全 member の `tests/` を root `[tool.pytest.ini_options].testpaths` で列挙
- `addopts` に `--import-mode=importlib` を必須

**理由**: `__init__.py` を置くと pytest が `tests.test_*` という名前で import しようとし、複数 member の `tests/` が衝突して collection error になる。importlib モードは pytest 公式が "strongly suggested" として推奨。

## 6. 依存関係の追加

**MUST**: `uv add` は **`--package` 必須**。root に直接 dep を追加するのは原則禁止（root は virtual workspace のため）。

```bash
cd backend-py

# member 別の追加
uv add --package api fastapi-pagination
uv add --package core langchain
uv add --package mcp-server mcp[cli]

# root の dev group（テスト・型・lint ツール等）
uv add --dev pytest-xdist
```

## 7. インストール・lock

**MUST**: 必ず **workspace root** から実行。member 個別の `uv sync` は禁止。

```bash
cd backend-py

uv sync --all-packages --all-groups            # 全 member + dev group を editable install
uv sync --all-packages --no-dev                # production
uv lock                                        # 全 member 共通 lockfile を更新
```

これらは devenv 経由（`setup:install-backend` task）で自動化済み。**Bash で直接 `uv sync` を叩くのは `.claude/rules/commands.md` に従い禁止**。

## 8. editable install と src-layout の関係

- uv は workspace member を**デフォルトで editable install** する（`uv` 公式: *"uv uses editable installation for workspace packages by default."*）
- hatchling は `[tool.hatch.build.targets.wheel].packages = ["src/<pkg>"]` の宣言から `_editable_impl_<pkg>.pth` を venv の site-packages に書き込み、その中身は `apps/<svc>/src` の絶対パス 1 行
- このため `import <pkg>` は editable install 後にのみ解決する。flat layout だと editable install 前でも CWD から偶発的に解決してしまい packaging バグを検知できない（src-layout を採用する理由の 1 つ）

## 9. 開発コマンド

`.claude/rules/commands.md` のポリシーが優先される。すべて devenv 経由:

```bash
test-backend-py              # pytest（全 member 横断）
lint-backend-py              # ruff check --fix apps packages
format-backend-py            # ruff format apps packages
type-check-backend-py        # mypy apps packages
```

直接 `cd backend-py/apps/api && uv run pytest` 等は禁止。

## 10. 新規 member の追加手順

1. ディレクトリ作成: `apps/<service>/` または `packages/<lib>/`
2. `pyproject.toml` 作成（上記テンプレート）
3. `src/<pkg>/__init__.py` 作成（空でも可）
4. tests を書く（`tests/__init__.py` は不要）
5. workspace root `pyproject.toml` の `[tool.uv.sources]` に 1 行追加（他 member から参照される場合）
6. root `[tool.mypy].mypy_path` に新 member の `src/` を追記
7. `cd backend-py && uv lock` で lockfile 更新（コミット対象）
8. 必要に応じて `devenv.nix` に process / setup task を追加

## 11. プロセス起動（devenv との連動）

実行可能サービス（`apps/<service>`）は `devenv.nix` で process を宣言する:

```nix
processes.<service-name> = {
  exec = ''
    cd "$DEVENV_ROOT/backend-py"
    uv sync --all-packages --group dev
    exec uv run --package <service> <entrypoint>
  '';
  start.enable = false;            # opt-in にする場合
  ready.http.get = { ... };        # HTTP サービスなら ready probe
};
```

`apps/<service>/pyproject.toml` の `[project.scripts]` に entrypoint を宣言してあれば、`uv run --package <service> <entrypoint>` で起動できる。

## 12. 強制事項

このポリシーは**交渉の余地なし**。違反する PR はレビューで却下する。

判断に迷う場合（既存 PyPI パッケージとの命名衝突、循環依存、core を分割すべきか等）は **`.claude/rules/feedback_ask_user_when_unsure.md` のポリシーに従いユーザーに確認**すること。
