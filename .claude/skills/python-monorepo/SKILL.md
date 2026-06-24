---
name: python-monorepo
description: Python uv workspace モノレポ（backend-py）ガイダンス。apps/ + packages/ 構成、src-layout、複数サーバ（API + MCP 等）追加、共有 packages の切り出し、tests 衝突回避、IDE 設定、Hatchling pyproject、editable install、--import-mode=importlib についての質問に使用。新規 member 追加・命名衝突回避・workspace 全体の lint/format/type-check/pytest 実行の実装支援を提供。
---

# Python Monorepo (uv Workspace) Skill

`backend-py/` は **uv workspace** で構成される Python モノレポ。複数のサーバ（FastAPI API / MCP server / 将来の追加サーバ）と共有ライブラリ（`packages/core` 等）を 1 つの venv・1 つの lockfile で運用する。

**強制ポリシーは `.claude/rules/python-monorepo.md` を必ず先に参照すること**。本スキルは「公式準拠の実装ワークフロー」と「出典・根拠」を提供する。

---

## 1. 現状の構造（snapshot）

```
backend-py/
├── pyproject.toml                  # workspace root（package = false）
├── uv.lock                         # 単一ルート lockfile
├── .python-version                 # 3.13
├── pyrightconfig.json
├── README.md / AGENTS.md
├── apps/
│   ├── api/                        # FastAPI サーバ（AWS Lambda 上で Mangum 経由）
│   │   ├── pyproject.toml          # name="api", [project.scripts] api = "api.main:main"
│   │   ├── README.md
│   │   ├── src/api/
│   │   │   ├── app.py              # FastAPI()
│   │   │   ├── main.py             # uvicorn entrypoint（ローカル開発用）
│   │   │   ├── lambda_handler.py   # handler = Mangum(app)（Amplify が呼ぶ handler）
│   │   │   ├── controller/
│   │   │   ├── usecase/
│   │   │   ├── gateway/
│   │   │   ├── domain/
│   │   │   │   └── exceptions.py   # ResourceNotFoundError + core re-export
│   │   │   ├── infra/
│   │   │   │   └── aws_clients.py  # boto3（DynamoDB / S3）クライアント
│   │   │   └── middleware/
│   │   │       └── auth_middleware.py  # Cognito JWT 検証
│   │   └── tests/                  # __init__.py なし
│   └── mcp/                        # MCP server skeleton（実装は未着手の雛形）
│       ├── pyproject.toml          # name="mcp-server", dependencies = ["mcp[cli]", "core"]
│       ├── README.md
│       └── src/mcp_server/         # ← `mcp_server` 名で公式 mcp PyPI と shadow 回避
│           └── __init__.py
└── packages/
    └── core/                       # 共有: logger / 共通例外 / 認証ユーティリティ
        ├── pyproject.toml
        ├── README.md
        ├── src/core/
        │   ├── logging.py          # structlog setup（Lambda では CloudWatch に出力）
        │   ├── exceptions.py       # AuthenticationError, ConfigurationError
        │   └── auth.py             # Cognito JWT 検証ユーティリティ（JWKS 検証ヘルパ）
        └── tests/
            └── test_logging.py
```

---

## 2. なぜこの構造か（出典付き）

### 2.1 `apps/` + `packages/` + `src/<pkg>/`

**uv 公式 albatross example** ([uv workspaces docs](https://docs.astral.sh/uv/concepts/projects/workspaces/)) の verbatim:

```
albatross
├── packages
│   ├── bird-feeder
│   │   ├── pyproject.toml
│   │   └── src
│   │       └── bird_feeder
│   │           ├── __init__.py
│   │           └── foo.py
│   └── seeds
│       ├── pyproject.toml
│       └── src
│           └── seeds
│               ├── __init__.py
│               └── bar.py
├── pyproject.toml
├── README.md
├── uv.lock
└── src
    └── albatross
        └── main.py
```

本リポジトリは `apps/` を追加して実行可能サービスと共有ライブラリを区別している（公式パターンの自然な拡張）。

### 2.2 src-layout を採用する理由

[PyPA src vs flat layout](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/) が文書化する 3 つの利点（verbatim）:

1. "The src layout requires installation of the project to be able to run its code, and the flat layout does not."
2. "The src layout helps prevent accidental usage of the in-development copy of the code."
3. "The src layout helps enforce that an editable installation is only able to import files that were meant to be importable."

[pytest 公式](https://docs.pytest.org/en/stable/explanation/goodpractices.html) の "Tests outside application code" セクションでも：

> "Generally, but especially if you use the default import mode `prepend`, it is **strongly suggested** to use a `src` layout."

**主要 SDK の実例**（hatchling + src-layout）:

- [Anthropic SDK pyproject.toml](https://github.com/anthropics/anthropic-sdk-python/blob/main/pyproject.toml): `packages = ["src/anthropic"]`
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk): `src/mcp/`
- [PyPA Hatch 本体](https://github.com/pypa/hatch): `src/hatch/`

### 2.3 単一 `uv.lock`

[uv workspaces docs](https://docs.astral.sh/uv/concepts/projects/workspaces/) verbatim:

> "In a workspace, each package defines its own `pyproject.toml`, but the workspace shares a single lockfile, ensuring that the workspace operates with a consistent set of dependencies."

### 2.4 editable install と `.pth` link

[uv editable installs docs](https://docs.astral.sh/uv/concepts/projects/dependencies/#editable-installs) verbatim:

> "Editable installations solve this problem by adding a link to the project within the virtual environment (a `.pth` file), which instructs the interpreter to include the source files directly."
>
> "uv uses editable installation for workspace packages by default."

実態確認:

```bash
$ cat .devenv/state/venv/lib/python3.13/site-packages/_editable_impl_api.pth
/Users/.../backend-py/apps/api/src
```

### 2.5 PEP 660

[PEP 660 – Editable installs](https://peps.python.org/pep-0660/) の Abstract:

> "This document describes a PEP 517 style method for the installation of packages in editable mode."

Hatchling のデフォルト editable mode は PEP 660 準拠で、上記の `.pth` 形式を出力する。

---

## 3. 新規 service 追加のワークフロー

### 3.1 例: 新しい FastAPI バックエンド `apps/worker/` を追加

```bash
# 1. ディレクトリとファイル作成
mkdir -p backend-py/apps/worker/src/worker
mkdir -p backend-py/apps/worker/tests
```

```toml
# backend-py/apps/worker/pyproject.toml
[project]
name = "worker"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    "fastapi",
    "uvicorn[standard]",
    "core",                                # workspace dep
]

[project.scripts]
worker = "worker.main:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/worker"]
```

```python
# backend-py/apps/worker/src/worker/__init__.py
"""Worker service package."""
```

```python
# backend-py/apps/worker/src/worker/main.py
import uvicorn

def main() -> None:
    uvicorn.run("worker.app:app", host="0.0.0.0", port=4041)
```

```toml
# backend-py/pyproject.toml に追記
[tool.uv.sources]
worker = { workspace = true }            # 既存の core/api/mcp-server に追加

[tool.mypy]
mypy_path = "apps/api/src:apps/worker/src:packages/core/src:apps/mcp/src"  # 1 つ追加

[tool.pytest.ini_options]
testpaths = ["apps/api/tests", "apps/worker/tests", "packages/core/tests"]
```

```bash
# 2. lockfile 更新
cd backend-py && uv lock

# 3. devenv.nix に process を追加（必要なら）
```

```nix
# devenv.nix
let
  workerExec = ''
    set -euo pipefail
    cd "$DEVENV_ROOT/backend-py"
    uv sync --all-packages --group dev
    exec "$UV_PROJECT_ENVIRONMENT/bin/uvicorn" worker.app:app \
      --reload --host 0.0.0.0 --port 4041
  '';
in {
  processes.worker = {
    exec = workerExec;
    start.enable = false;                # opt-in
    ready.http.get = { host = "127.0.0.1"; port = 4041; path = "/healthcheck"; };
  };
}
```

### 3.2 例: 新しい共有ライブラリ `packages/llm/` を追加

```toml
# backend-py/packages/llm/pyproject.toml
[project]
name = "llm"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = ["langchain", "langchain-anthropic", "core"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/llm"]
```

```python
# backend-py/packages/llm/src/llm/__init__.py
"""LLM orchestration shared across services."""
```

サービス側 (`apps/api/pyproject.toml`) で参照:

```toml
[project]
dependencies = ["fastapi", "core", "llm"]
```

workspace root への追加:

```toml
[tool.uv.sources]
llm = { workspace = true }
```

---

## 4. 命名衝突回避（PyPI shadow）

**MUST**: `src/<pkg>/` の `<pkg>` 名は、依存している外部 PyPI パッケージと衝突させない。

| 状況 | 衝突 | 回避策 |
|---|---|---|
| 公式 `mcp[cli]` を依存に持つ MCP サーバ | `src/mcp/` | `src/mcp_server/` （本プロジェクトの選択） |
| `langchain` を依存に持つラッパー | `src/langchain/` | `src/llm/` または `src/orchestration/` |
| `openai` を依存に持つラッパー | `src/openai/` | `src/openai_client/` |
| `boto3` を依存に持つ AWS ラッパー | `src/boto3/` | `src/aws/` または機能名（`src/storage/`） |

衝突した場合の症状: editable install 後、`import mcp` が自分の `src/mcp/__init__.py` を優先して解決し、外部 `mcp[cli]` SDK が `ModuleNotFoundError` で落ちる。

**`<member-name>` (project.name) と `<pkg>` を分けて宣言できる**ことに注意:

```toml
[project]
name = "mcp-server"              # ← project name
[tool.hatch.build.targets.wheel]
packages = ["src/mcp_server"]    # ← import 名
```

`uv add --package mcp-server ...` でメンバー指定し、コード内では `import mcp_server` と書く。

---

## 5. テスト構造

### 5.1 `tests/__init__.py` を置かない

複数 member が `tests/` を持つと、`__init__.py` がある場合に pytest が両方を `tests.test_*` として import しようとして collection error になる:

```
ERROR collecting packages/core/tests/test_logging.py
ModuleNotFoundError: No module named 'tests.test_logging'
```

**対策**: `tests/__init__.py` を**置かない**。pytest は rootdir モードで自動コレクションする。

### 5.2 `--import-mode=importlib`

pytest 公式が推奨する import mode。`prepend` (default) は `tests/` を sys.path 先頭に挿入するため shadow を起こしやすい。importlib モードは sys.path を汚さず import するため、editable install と素直に協調する。

```toml
[tool.pytest.ini_options]
addopts = "-ra -q --import-mode=importlib"
```

### 5.3 `pythonpath` 設定は禁止

src-layout + editable install で sys.path は完備される。`pythonpath` を pytest 設定に書くと flat-layout の workaround となり、二重に解決経路を持ち込む。

---

## 6. 実行コマンド一覧

すべて devenv 経由（`.claude/rules/commands.md` 必須）:

```bash
# 起動（Amplify backend は別途 `sandbox` を先に起動しておく）
devenv up                          # backend (api) + storybook
devenv up backend-mcp              # MCP server を opt-in で起動（placeholder）

# CI 確認系
test-backend-py                    # pytest（全 member 横断）
lint-backend-py                    # ruff check --fix apps packages
format-backend-py                  # ruff format apps packages
type-check-backend-py              # mypy apps packages

# CI モード（execIfModified キャッシュ）
lint-backend-py-ci
format-backend-py-check
type-check-backend-py (devenv tasks run type-check:backend-py)

# 依存追加
cd backend-py && uv add --package api <pkg>
cd backend-py && uv add --dev <pkg>            # workspace root の dev group へ
cd backend-py && uv lock                       # lockfile 更新
```

### 個別 member へのアクセス

```bash
cd backend-py

# 特定 member の python で実行
uv run --package api python -c "import api.app; print('OK')"

# 特定 member の entrypoint 実行
uv run --package api api          # apps/api/pyproject.toml の [project.scripts] api

# 特定 member のテストのみ
uv run pytest apps/api/tests/ -v
```

---

## 7. IDE 設定（Pyright / Pylance）

`backend-py/pyrightconfig.json` は CLI Pyright 用に設定済みで `0 errors` を出す。VS Code / Cursor の Pylance が import 解決に失敗する場合は、**インタプリタを明示的に選択**する必要がある:

### 7.1 `.vscode/settings.json` への追記

```jsonc
{
  "python.defaultInterpreterPath": "${workspaceFolder}/.devenv/state/venv/bin/python",
  "python.analysis.extraPaths": [
    "${workspaceFolder}/backend-py/apps/api/src",
    "${workspaceFolder}/backend-py/packages/core/src",
    "${workspaceFolder}/backend-py/apps/mcp/src"
  ]
}
```

### 7.2 確認方法

CLI で Pyright を叩いてエラーが出なければ構造は正しい（IDE 設定問題のみ）:

```bash
cd backend-py
uv run --with pyright pyright apps/api/src/api/app.py
# → 0 errors, 0 warnings, 0 informations
```

---

## 8. 共通例外の切り出しパターン

`packages/core` が `apps/api` 配下から例外を import できない（循環依存禁止）ため、**サービス横断で使う例外は core に置く**。サービス固有のものはサービス内に残す。

```python
# packages/core/src/core/exceptions.py
class AuthenticationError(Exception): ...
class ConfigurationError(Exception): ...

# apps/api/src/api/domain/exceptions.py
from core.exceptions import AuthenticationError, ConfigurationError

__all__ = ["AuthenticationError", "ConfigurationError", "ResourceNotFoundError"]

class ResourceNotFoundError(Exception):   # API 固有
    ...
```

これにより `api.app` 内の exception handler は単一 import surface (`from api.domain.exceptions import ...`) を維持できる。

---

## 9. デプロイ（AWS Lambda via Amplify）

FastAPI サーバは Amplify Gen2 の Python custom function として **AWS Lambda** にデプロイされる
（`frontend/packages/backend/amplify/functions/api/resource.ts`、CDK `Function` PYTHON_3_13）。
Lambda の handler は **Mangum**（ASGI → Lambda アダプタ）:

```python
# apps/api/src/api/lambda_handler.py
from mangum import Mangum

from api.app import app  # FastAPI() インスタンス

# Amplify は handler を "api.lambda_handler.handler" として配線する
handler = Mangum(app)
```

デプロイは Amplify が担う（`ampx sandbox` で per-dev、`ampx pipeline-deploy` でブランチ/本番）。
`uv run --package api uvicorn ...`（`api.main:main`）はローカル開発用。Lambda パッケージングでは
**workspace ルート `backend-py/`** を基準に依存を解決する（`uv run --package api` の参照範囲を
member 単体にしないため）。

---

## 10. よくあるアンチパターンと対処

| アンチパターン | 症状 | 正しい対応 |
|---|---|---|
| `tests/__init__.py` を置く | `ModuleNotFoundError: No module named 'tests.X'` | 削除する |
| `pythonpath` を pytest 設定に書く | flat-layout の workaround を持ち込む | 削除して `--import-mode=importlib` のみ使用 |
| `src/mcp/` で命名 | 公式 `mcp[cli]` SDK の import が落ちる | `src/mcp_server/` に rename |
| member の `pyproject.toml` で個別に ruff/mypy 設定 | 設定が散在し CI と乖離 | root pyproject.toml に集約 |
| member 個別の `uv.lock` | 全 member 間の依存解決が不整合 | root 単一 lockfile のみ |
| `cd backend-py/apps/api && uv sync` | member 単独 sync で他 member が editable install されない | `cd backend-py && uv sync --all-packages` |
| flat layout (`src/` 省略) | editable install 前に偶発的に import が解決し、packaging バグを検知できない | `src/<pkg>/` を導入 |
| project name と `<pkg>` 名を強制一致させる | PyPI shadow 回避が難しくなる | 別物として宣言（例: `mcp-server` + `src/mcp_server/`） |

---

## 11. 関連ドキュメント

| File | 役割 |
|---|---|
| `.claude/rules/python-monorepo.md` | **強制ポリシー（常に適用）** |
| `.claude/rules/backend-py.md` | Python コード規約（型注釈、SQLModel、テスト方針等） |
| `.claude/rules/commands.md` | devenv 経由でのみ実行する原則 |
| `.claude/rules/clean-code.md` | 後方互換禁止・重複禁止 |
| `.claude/skills/fastapi/` | FastAPI 公式パターン |
| `.claude/skills/python-testing/` | 単体テストガイドライン |
| `.claude/skills/logger/` | structlog (core.logging) の使い方 |
| `.claude/skills/debugging/` | devenv の debug 手順 |
| `backend-py/README.md` | プロジェクト固有の構造・コマンド説明 |
| `backend-py/AGENTS.md` | クイックリファレンス |

---

## 12. 公式出典まとめ

| トピック | URL | 引用 |
|---|---|---|
| uv workspaces 構造 | https://docs.astral.sh/uv/concepts/projects/workspaces/ | albatross tree + "the workspace shares a single lockfile" |
| uv editable installs | https://docs.astral.sh/uv/concepts/projects/dependencies/#editable-installs | "uv uses editable installation for workspace packages by default." |
| PyPA src vs flat layout | https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/ | 3 advantages of src layout |
| pytest Good Integration Practices | https://docs.pytest.org/en/stable/explanation/goodpractices.html | "strongly suggested to use a `src` layout" |
| PEP 660 editable installs | https://peps.python.org/pep-0660/ | PEP 517 style editable mode |
| Anthropic SDK pyproject.toml | https://github.com/anthropics/anthropic-sdk-python/blob/main/pyproject.toml | `packages = ["src/anthropic"]` |
| MCP Python SDK | https://github.com/modelcontextprotocol/python-sdk | `src/mcp/` 採用 |
| Hatch (build backend 本体) | https://github.com/pypa/hatch | `src/hatch/` 採用 |
| Hatch build config | https://hatch.pypa.io/latest/config/build/ | `[tool.hatch.build.targets.wheel].packages` |

これらの URL は調査時点（2026-05-30）で reachable。実装 / 設計判断時は本スキルが提供する規約と出典を root of truth として扱うこと。
