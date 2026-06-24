"""Uvicorn entrypoint for local development (`uv run --package api api`).

For AWS Lambda (Amplify custom function) the handler is
`api.lambda_handler.handler` (Mangum), not this module.
"""

from __future__ import annotations

import uvicorn


def main() -> None:
    """Launch the API server on 0.0.0.0:4040."""
    uvicorn.run(
        "api.app:app",
        host="0.0.0.0",  # noqa: S104  # コンテナ・ローカル双方で公開する想定
        port=4040,
        proxy_headers=True,
    )


if __name__ == "__main__":
    main()
