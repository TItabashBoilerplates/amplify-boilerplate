# api

FastAPI + Supabase Auth サーバ。`backend-py` モノレポの 1 メンバー。

## 構造

```
apps/api/src/api/
├── app.py                # FastAPI application + lifespan + exception handlers
├── main.py               # uvicorn entrypoint (`uv run --package api api`)
├── controller/           # HTTP routing layer
├── usecase/              # Business logic
├── gateway/              # Data access abstraction
├── domain/
│   ├── entity/           # SQLModel models
│   ├── service/          # Domain services
│   ├── const/            # Constants
│   └── exceptions.py     # ResourceNotFoundError + re-export core 例外
├── infra/
│   └── db_client.py      # SQLModel Session (Supabase クライアントは core)
└── middleware/           # Logging + Auth middleware
```

## 起動

ローカル開発は `devenv up` で起動（`backend` プロセス、ポート 4040）。

```bash
# 単独起動 (port 4040)
cd backend-py && uv run --package api uvicorn api.app:app --reload --port 4040

# 本番 entry (project.scripts)
cd backend-py && uv run --package api api
```

## 共有パッケージ

logger / Supabase クライアント / 共通例外は `packages/core/` 経由で利用する:

```python
from core.logging import get_logger
from core.supabase_client import SupabaseClient
from core.exceptions import AuthenticationError, ConfigurationError
```

API 固有のドメイン例外（`ResourceNotFoundError` 等）は `api/domain/exceptions.py` で定義する。
