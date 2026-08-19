---
description: "Python monorepo (uv workspace) structure for backend-py"
alwaysApply: true
globs: ["backend-py/**"]
---
# Python Monorepo (uv Workspace) Policy

**MANDATORY**: `backend-py/` は uv の **virtual workspace**（root は `package = false`）。

正本: `/.claude/rules/python-monorepo.md`

## 構造

```
backend-py/
├── pyproject.toml        # workspace root（package = false / members / dev group / ruff / mypy / pytest）
├── uv.lock               # 単一ルート lockfile（member 別に作らない）
├── apps/<service>/
│   ├── pyproject.toml
│   ├── src/<pkg>/        # ← src-layout 必須
│   └── tests/            # ← __init__.py を置かない（member 間で tests.* が衝突する）
└── packages/<lib>/
    ├── src/<lib>/
    └── tests/
```

**禁止**: flat layout（`src/` 省略）/ member 別の `uv.lock`・`.python-version`・tooling 設定 /
`tests/__init__.py`

## 命名

`src/<pkg>/` の名前を**依存している外部 PyPI パッケージと衝突させない**
（例: `mcp` を依存するなら `src/mcp_server/`）。衝突すると editable install 後に
本物の SDK の import が `ModuleNotFoundError` で落ちる。

## コマンド

```bash
uv add --package <member> <pkg>        # 依存追加は --package 必須
uv sync --all-packages --all-groups    # 必ず workspace root から
```

## ⚠️ `uv run` は import 解決が要るツールで `--all-packages` 必須

素の `uv run` は root の dependency-group しか同期せず member の依存を入れない。
その状態では **mypy が third-party を `Any` と見て strict のルールを誤爆**し、
**pytest が collection error** になる（＝壊れていないコードが落ちる）。

```bash
uv run --all-packages mypy apps packages   # ✅
uv run --all-packages pytest               # ✅
uv run ruff check apps packages            # ruff は import を解決しないので不要
```

品質チェックは devenv 経由（`type-check-backend-py` / `test-backend-py` / `lint-backend-py`）。
