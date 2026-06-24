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
