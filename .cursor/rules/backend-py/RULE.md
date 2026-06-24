---
description: "Backend Python standards for FastAPI and Clean Architecture"
alwaysApply: false
globs: ["backend-py/**/*.py"]
---
# Backend Python Standards

## Architecture

- **Pattern**: Clean Architecture
- **Framework**: FastAPI
- **Package Manager**: uv

## Directory Structure

```
backend-py/app/src/
├── controller/    # HTTP layer only
├── usecase/       # Business logic
├── gateway/       # Data access interfaces
├── domain/        # Entities (auto-generated)
├── infra/         # External dependencies
└── middleware/    # Auth, CORS, logging
```

## DRY Principle (MANDATORY)

| 対象 | 配置場所 |
|------|---------|
| Entity/型 | `domain/entity/` |
| Gateway | `gateway/` |
| ユーティリティ | `infra/` |

## Code Style

- **Linting**: Ruff
- **Type Check**: MyPy (strict)
- **Line Length**: 88

## SQLModel (IMPORTANT)

**同期実装を使用** (async未サポート)

```python
# CORRECT: Sync
def get_user(session: Session, user_id: str) -> User | None:
    return session.exec(select(User).where(User.id == user_id)).first()

# WRONG: Async
async def get_user(session: AsyncSession, ...):  # DO NOT USE
```

## LLM Client Policy (MANDATORY)

**LangChainを使用すること**

```python
# CORRECT
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-5.2")

# WRONG: 直接SDK使用
from openai import OpenAI  # DO NOT USE
```

