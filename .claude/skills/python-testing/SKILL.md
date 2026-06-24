---
name: python-testing
description: Python単体テストガイダンス（外部SDK / TypeError・ValueError検知）。外部SDKのテスト方針、respx/httpx_mock、autospec/spec_set、Adapter+Fakeパターンについての質問に使用。MagicMockによる型・値の隠蔽を防ぎ、TypeError/ValueError早期検知の実装支援を提供。
---

# Python単体テスト スキル

このプロジェクトでは **外部SDKのTypeError（型不整合）・ValueError（値不正）を単体テストレベルで検知** することを重視します。

## 目的

- **TypeError（型不整合）・ValueError（値不正）を単体テストで検知**
- **課金・ネットワーク呼び出しは避ける**（外部APIは叩かない）
- **都合の良いモック（MagicMock等）による問題の隠蔽を防ぐ**

## 3つの原則（最重要）

### 1. 外部SDK（pipモジュール）を丸ごとMockしない

モジュール全体をMockすると、属性が生えたり戻り値が何でも通ったりして、TypeError/ValueErrorが隠れる。

```python
# ❌ Bad: SDK全体をMock
@patch('openai.OpenAI')
def test_bad(mock_openai):
    # MagicMockは任意の属性アクセスを許可
    # 誤ったAPI、不正な値でもテストが通ってしまう
    mock_openai.return_value.chat.completions.create.return_value = MagicMock()
    mock_openai.return_value.typo_method()  # TypeError検知できない！

    # 本番では ValueError になるケースもスルー
    mock_openai.return_value.chat.completions.create(
        model="",           # ValueError: 空文字は不正
        messages=[],        # ValueError: 空リストは不正
        temperature=3.0,    # ValueError: 0-2の範囲外
    )
```

### 2. 本物のSDKを使い、差し替えるのは"境界（I/O）"だけ

ネットワーク/ファイル/DBなど外部I/Oはテストで遮断し、SDKの型チェック・バリデーション・パース挙動は本物のまま通す。

```python
# ✅ Good: SDKは本物、HTTP層のみ差し替え
import respx
from openai import OpenAI

@respx.mock
def test_good():
    respx.post("https://api.openai.com/v1/chat/completions").respond(
        json={
            "choices": [{"message": {"content": "Hello"}}],
            "usage": {"total_tokens": 10}
        }
    )
    client = OpenAI(api_key="test")
    # 本物のSDKが動作 → 型・値の検証が効く
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hi"}]
    )

    # 以下は本物のSDKがバリデーションするためエラーになる
    # client.chat.completions.create(model="", messages=[])  # ValueError!
```

### 3. Mockが必要なら `autospec` / `spec_set` で本物APIに縛る

どうしてもMockが必要な場合は、本物のAPIシグネチャに縛る。

```python
# ✅ Good: autospecで本物APIに縛る
from unittest.mock import patch

@patch('mymodule.client', autospec=True)
def test_with_autospec(mock_client):
    # 存在しないメソッドや引数違いはエラーになる
    mock_client.create_completion(invalid_arg="x")  # TypeError!
```

---

## パターンA: HTTP層差し替え（respx / httpx_mock）

**最も推奨されるパターン**。SDKは本物のまま、HTTP通信のみを差し替える。

### respx（推奨）

```python
import pytest
import respx
from httpx import Response
from openai import OpenAI

@pytest.fixture
def mock_openai_api():
    with respx.mock:
        # チャット完了エンドポイントをモック
        respx.post("https://api.openai.com/v1/chat/completions").mock(
            return_value=Response(
                200,
                json={
                    "id": "chatcmpl-xxx",
                    "object": "chat.completion",
                    "model": "gpt-4",
                    "choices": [{
                        "index": 0,
                        "message": {"role": "assistant", "content": "Hello!"},
                        "finish_reason": "stop"
                    }],
                    "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
                }
            )
        )
        yield

def test_chat_completion(mock_openai_api):
    client = OpenAI(api_key="test-key")

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hi"}]
    )

    # 本物のSDKが動作するため、型検証が効く
    assert response.choices[0].message.content == "Hello!"
    assert response.usage.total_tokens == 15
```

### pytest-httpx

```python
import pytest
from pytest_httpx import HTTPXMock
from openai import OpenAI

def test_with_httpx_mock(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url="https://api.openai.com/v1/chat/completions",
        method="POST",
        json={
            "choices": [{"message": {"content": "Mocked response"}}],
            "usage": {"total_tokens": 10}
        }
    )

    client = OpenAI(api_key="test")
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "test"}]
    )

    assert response.choices[0].message.content == "Mocked response"
```

### 効果

- SDKのバリデーション・パース処理が動作
- TypeError（型不整合）・ValueError（値不正）は即座にエラー
- 課金ゼロ、ネットワークゼロ

---

## パターンB: autospec / spec_set 必須化

Mockを使う場合は、本物のAPIシグネチャに縛る。

### autospec

```python
from unittest.mock import patch, MagicMock

# ❌ Bad: 通常のpatch（何でも通る）
@patch('mymodule.external_client')
def test_bad(mock_client):
    mock_client.nonexistent_method()  # エラーにならない

# ✅ Good: autospec=True（シグネチャに縛る）
@patch('mymodule.external_client', autospec=True)
def test_good(mock_client):
    mock_client.nonexistent_method()  # AttributeError!
    mock_client.real_method(wrong_arg=1)  # TypeError!
```

### spec_set

```python
from unittest.mock import Mock

# ❌ Bad: 通常のMock
mock = Mock()
mock.any_attribute = "value"  # 何でも設定可能

# ✅ Good: spec_set（存在しない属性は拒否）
from mymodule import RealClass
mock = Mock(spec_set=RealClass)
mock.nonexistent = "value"  # AttributeError!
```

### create_autospec

```python
from unittest.mock import create_autospec
from mymodule import RealClass

mock = create_autospec(RealClass, instance=True)
mock.method(wrong_type_arg)  # TypeError（型が合わない）
```

---

## パターンC: Adapter + Fake

外部SDK依存を局所化し、テストではFake実装を注入。

### Adapter定義

```python
# infra/llm_adapter.py
from abc import ABC, abstractmethod
from typing import Protocol

class LLMResponse:
    """SDK非依存の統一レスポンス型"""
    content: str
    tokens_used: int

class LLMAdapter(Protocol):
    """LLMクライアントの抽象インターフェース"""

    def chat(self, messages: list[dict], model: str) -> LLMResponse:
        """チャット完了を実行"""
        ...
```

### 本番実装

```python
# infra/openai_adapter.py
from openai import OpenAI
from .llm_adapter import LLMAdapter, LLMResponse

class OpenAIAdapter:
    """OpenAI SDKのAdapter実装"""

    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)

    def chat(self, messages: list[dict], model: str) -> LLMResponse:
        response = self.client.chat.completions.create(
            model=model,
            messages=messages
        )
        return LLMResponse(
            content=response.choices[0].message.content,
            tokens_used=response.usage.total_tokens
        )
```

### Fake実装（テスト用）

```python
# tests/fakes/fake_llm.py
from infra.llm_adapter import LLMAdapter, LLMResponse

class FakeLLMAdapter:
    """テスト用Fake実装"""

    def __init__(self, responses: list[str] | None = None):
        self.responses = responses or ["Default fake response"]
        self._call_count = 0
        self.call_history: list[dict] = []

    def chat(self, messages: list[dict], model: str) -> LLMResponse:
        self.call_history.append({"messages": messages, "model": model})
        content = self.responses[self._call_count % len(self.responses)]
        self._call_count += 1
        return LLMResponse(content=content, tokens_used=10)
```

### UseCase での使用

```python
# usecase/chat_usecase.py
from infra.llm_adapter import LLMAdapter

class ChatUseCase:
    def __init__(self, llm: LLMAdapter):
        self.llm = llm  # DI: Adapter or Fake

    def execute(self, user_message: str) -> str:
        response = self.llm.chat(
            messages=[{"role": "user", "content": user_message}],
            model="gpt-4"
        )
        return response.content
```

### テスト

```python
# tests/usecase/test_chat_usecase.py
import pytest
from usecase.chat_usecase import ChatUseCase
from tests.fakes.fake_llm import FakeLLMAdapter

def test_chat_usecase():
    fake_llm = FakeLLMAdapter(responses=["Hello from fake!"])
    usecase = ChatUseCase(llm=fake_llm)

    result = usecase.execute("Hi")

    assert result == "Hello from fake!"
    assert fake_llm.call_history[0]["messages"][0]["content"] == "Hi"
```

### 効果

- SDK更新耐性が向上（Adapterのみ修正）
- テストの意図が明確
- 外部依存の局所化

---

## OpenAIクライアントの推奨テスト構成

### ディレクトリ構造

```
backend-py/
├── app/src/
│   ├── infra/
│   │   ├── openai_adapter.py      # 本番Adapter
│   │   └── llm_adapter.py         # 抽象インターフェース
│   └── usecase/
│       └── chat_usecase.py
└── tests/
    ├── conftest.py
    ├── fakes/
    │   └── fake_llm.py            # Fake実装
    └── usecase/
        └── test_chat_usecase.py
```

### conftest.py

```python
import pytest
from tests.fakes.fake_llm import FakeLLMAdapter

@pytest.fixture
def fake_llm():
    return FakeLLMAdapter()

@pytest.fixture
def fake_llm_with_responses():
    def _factory(responses: list[str]):
        return FakeLLMAdapter(responses=responses)
    return _factory
```

---

## 禁止パターンまとめ

| パターン | 問題点 |
|----------|--------|
| `@patch('openai.OpenAI')` | SDK全体がMock化、型チェック・バリデーション無効 |
| `MagicMock()` の多用 | 任意の属性アクセスを許可、ValueError検知不可 |
| `Mock(return_value=...)` のみ | シグネチャ・値の検証なし |
| 外部APIを直接叩く | 課金発生、ネットワーク依存 |

## 推奨パターンまとめ

| パターン | 使用場面 | ツール |
|----------|----------|--------|
| **HTTP層差し替え** | 外部API呼び出しテスト | `respx`, `pytest-httpx` |
| **autospec/spec_set** | 内部モジュールのMock | `unittest.mock` |
| **Adapter + Fake** | 複雑なSDK依存 | 自作Adapter + Fake |

---

## ベストプラクティス

1. **新規テスト作成時**: まずパターンAを検討
2. **既存コードのテスト**: パターンCでAdapter化を検討
3. **やむを得ずMock**: 必ず`autospec=True`を付与
4. **MagicMock禁止**: `spec_set`なしのMagicMockは使用しない
5. **テスト環境**: `pytest` + `respx` or `pytest-httpx` を標準構成に
