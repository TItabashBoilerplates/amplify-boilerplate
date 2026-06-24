---
paths: backend-py/**/*.py
---

# Python Backend Code Standards

## Architecture

- **Pattern**: Clean Architecture (apps/<service> 内)
- **Framework**: FastAPI
- **Package Manager**: uv workspace（モノレポ構造の詳細・強制ポリシーは [`.claude/rules/python-monorepo.md`](python-monorepo.md) を参照）
- **詳細ガイド**: `.claude/skills/python-monorepo/SKILL.md`（新規 service / packages 追加、命名衝突回避、IDE 設定、出典付き）

## Directory Structure (uv Workspace)

`backend-py/` は uv workspace。`apps/<service>` の実行可能サービスと `packages/<name>` の共有
ライブラリで構成される。`apps/api` が FastAPI HTTP サーバ、`apps/mcp` は MCP サーバ雛形、
`packages/core` は logger / Supabase client / 共通例外を提供する。

```
backend-py/
├── pyproject.toml                  # workspace root（共通 tooling: ruff/mypy/pytest）
├── apps/
│   ├── api/src/api/                # FastAPI サーバ
│   │   ├── controller/             # HTTP request/response only
│   │   ├── usecase/                # Business logic
│   │   ├── gateway/                # Data access interfaces
│   │   ├── domain/                 # Entities, services, 固有例外 (sqlacodegen 生成は entity/)
│   │   ├── infra/                  # External system connections (DB)
│   │   └── middleware/             # Auth, CORS, request processing
│   └── mcp/src/mcp_server/         # MCP server skeleton
└── packages/
    └── core/src/core/              # 共有: logging.py / exceptions.py / supabase_client.py
```

## Responsibility Separation

- **Controllers**: HTTP layer only, no business logic
- **Use Cases**: Business logic, orchestration
- **Gateways**: Data access abstraction (interface definitions)
- **Infrastructure**: External system connections (DB, Supabase, external APIs)
- **Util**: Cross-cutting utilities (logging configuration, etc.)
- **Domain**: Entities, Value Objects

## DRY Principle (MANDATORY)

**重複実装は徹底的に排除し、コードをクリーンに保つ。**

### 共通化の原則

| 対象 | 配置場所 | 例 |
|------|---------|-----|
| **エンティティ・型定義** | `domain/entity/` | models.py, types |
| **Gateway インターフェース** | `gateway/` | 抽象化されたデータアクセス |
| **ドメインサービス** | `domain/service/` | ビジネスロジック |
| **横断的ユーティリティ** | `util/` | logging設定など |
| **外部システム接続** | `infra/` | DB, Supabase, 外部API |
| **ミドルウェア** | `middleware/` | 認証、リクエスト処理 |

### 禁止事項

```python
# ❌ Bad: 同じクエリロジックを複数の UseCase で重複
class ChatUseCase:
    def get_user(self, session, user_id):
        return session.exec(select(User).where(User.id == user_id)).first()

class ProfileUseCase:
    def get_user(self, session, user_id):  # 重複!
        return session.exec(select(User).where(User.id == user_id)).first()

# ✅ Good: Gateway に共通化
class UserGateway:
    def get_by_id(self, session: Session, user_id: str) -> User | None:
        return session.exec(select(User).where(User.id == user_id)).first()

class ChatUseCase:
    def __init__(self):
        self.user_gateway = UserGateway()
```

```python
# ❌ Bad: Supabase クライアント初期化を各所で重複
# usecase/chat.py
supabase = create_client(url, key)
# usecase/profile.py
supabase = create_client(url, key)

# ✅ Good: infra で一元管理
# infra/supabase_client.py
from src.infra.supabase_client import SupabaseClient
```

### チェックリスト

新しいコードを書く前に確認：

1. **既存の Gateway に同様の操作があるか？** → あれば再利用
2. **他の UseCase でも使う可能性があるか？** → Gateway に実装
3. **ドメインロジックが重複していないか？** → Domain Service に共通化
4. **外部システム接続が重複していないか？** → infra/ に一元化
5. **横断的ユーティリティが重複していないか？** → util/ に一元化

## Code Style

- **Linting**: Ruff
- **Line Length**: 88 characters
- **Type Checking**: MyPy (strict mode)
- **Docstrings**: Google style
- **Max Function Complexity**: 3 (McCabe)

## Type Annotations

All functions MUST have type annotations:

```python
# ✅ Good
async def get_user(user_id: str) -> User:
    ...

# ❌ Bad
async def get_user(user_id):
    ...
```

## Async/Await

All I/O operations MUST use async/await:

```python
# ✅ Good
async def fetch_data() -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.json()

# ❌ Bad
def fetch_data() -> dict:
    response = requests.get(url)
    return response.json()
```

## SQLModel Operations (Exception)

**IMPORTANT**: SQLModel database operations MUST use **synchronous** implementation.

SQLModel's async support is **not yet officially available**. According to the [official roadmap](https://github.com/fastapi/sqlmodel/issues/654), "Async tools and docs" remains an uncompleted task. Until official async support is released, use synchronous Session and operations:

```python
# ✅ Good: Sync SQLModel operations
from sqlmodel import Session, select

def get_user(session: Session, user_id: str) -> User | None:
    statement = select(User).where(User.id == user_id)
    return session.exec(statement).first()

def create_user(session: Session, user: User) -> User:
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

# ❌ Bad: Async SQLModel (causes issues)
async def get_user(session: AsyncSession, user_id: str) -> User | None:
    statement = select(User).where(User.id == user_id)
    result = await session.exec(statement)
    return result.first()
```

### Gateway Pattern with Sync SQLModel

```python
class UserGateway:
    def get_by_id(self, session: Session, user_id: str) -> User | None:
        """Sync database operation"""
        statement = select(User).where(User.id == user_id)
        return session.exec(statement).first()

    def create(self, session: Session, user: User) -> User:
        """Sync database operation"""
        session.add(user)
        session.commit()
        session.refresh(user)
        return user
```

### Async Endpoints with Sync SQLModel

FastAPI endpoints can still be async while using sync SQLModel:

```python
@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    session: Session = Depends(get_session),
) -> UserResponse:
    # Sync SQLModel operation inside async endpoint is OK
    gateway = UserGateway()
    user = gateway.get_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404)
    return UserResponse.from_orm(user)
```

## Python Unit Testing Policy (MANDATORY)

**原則**: 外部SDKの型不整合・値不正を単体テストレベルで検知する。

### 目的

- **TypeError（型不整合）・ValueError（値不正）を単体テストで検知**
- **課金・ネットワーク呼び出しは避ける**（外部APIは叩かない）
- **都合の良いモック（MagicMock等）による問題の隠蔽を防ぐ**

### 3つの原則

1. **外部SDK（pipモジュール）を丸ごとMockしない**
   - モジュール全体をMockすると、属性が生えたり戻り値が何でも通ったりして、TypeError/ValueErrorが隠れる

2. **本物のSDKを使い、差し替えるのは"境界（I/O）"だけ**
   - ネットワーク/ファイル/DBなど外部I/Oはテストで遮断
   - SDKの型チェック・バリデーション・パース挙動は本物のまま通す

3. **Mockが必要なら `autospec` / `spec_set` で本物APIに縛る**

### 推奨パターン

| パターン | 手法 | 効果 |
|----------|------|------|
| **A: HTTP層差し替え** | `respx`, `httpx_mock` | SDKは本物、I/Oのみ遮断 |
| **B: autospec/spec_set** | `patch(..., autospec=True)` | シグネチャ違いを検知 |
| **C: Adapter + Fake** | 薄いラッパー + Fake実装 | SDK更新耐性向上 |

### 禁止パターン

```python
# ❌ Bad: SDK全体をMock（型チェック・バリデーションが効かない）
@patch('openai.OpenAI')
def test_chat(mock_openai):
    mock_openai.return_value.chat.completions.create.return_value = MagicMock()
    # 誤ったAPI、不正な値でもテストが通ってしまう

# ❌ Bad: MagicMockで何でも通す
mock_response = MagicMock()
mock_response.choices[0].message.content = "test"  # 実際のAPIと異なっても気づけない
# model="" や messages=[] など不正な値もスルーされる

# ✅ Good: httpx層で差し替え（SDKは本物）
import respx
from openai import OpenAI

@respx.mock
def test_chat():
    respx.post("https://api.openai.com/v1/chat/completions").respond(json={...})
    client = OpenAI()
    response = client.chat.completions.create(...)  # 本物のSDK

# ✅ Good: autospecで本物APIに縛る
@patch('mymodule.openai_client', autospec=True)
def test_with_autospec(mock_client):
    # シグネチャ違いはTypeErrorになる
```

詳細なガイダンスは `.claude/skills/python-testing/SKILL.md` を参照。

---

## LLM Client Policy (MANDATORY)

**原則**: すべてのLLMクライアント実装は **LangChain** を使用する。

### 理由

- **統一されたインターフェース**: 複数のLLMプロバイダー（OpenAI, Anthropic, etc.）を一貫したAPIで利用可能
- **LangGraph統合**: エージェント・ワークフロー実装との連携
- **LangSmith連携**: トレーシング・評価・モニタリングの一元管理
- **本プロジェクトのAI/ML基盤**: `backend-py/README.md` で定義されたLangChain/LangGraphアーキテクチャとの整合性

### 必須パターン

```python
# ✅ Good: LangChain を使用
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

llm = ChatOpenAI(model="gpt-5.2")
response = llm.invoke("Hello")

# ❌ Bad: 直接SDKを使用
from openai import OpenAI
client = OpenAI()
response = client.chat.completions.create(...)
```

### 例外

以下の場合のみ直接SDKの使用を許可：
- LangChainが未対応の最新API機能
- LangChainラッパーにバグがある場合
- パフォーマンスクリティカルで軽量実装が必要な場合

**例外を適用する場合は、コードコメントで理由を明記すること。**
