# Langfuse LangChain/LangGraph 統合 調査レポート

## 調査情報

- **調査日**: 2026-01-20
- **調査者**: spec agent
- **対象**: Langfuse Python SDK v3 + LangChain/LangGraph 統合

## バージョン情報

| パッケージ | 最新バージョン | 最小要件 |
|-----------|---------------|---------|
| `langfuse` | 3.12.0 (2026-01-13) | Python >= 3.10 |
| `langchain` | ^0.1.10 以上 | - |
| `langgraph` | - | Python >= 3.11 |

**重要**: Langfuse Python SDK v3 は 2025年6月にリリースされ、OpenTelemetry ベースに完全刷新されている。

## セルフホスト要件

- **Langfuse プラットフォーム**: >= 3.63.0（Python SDK v3 の全機能に必要）

---

## 1. インストール

```bash
pip install langfuse langchain langchain_openai langgraph
```

または uv を使用：

```bash
uv add langfuse langchain langchain_openai langgraph
```

---

## 2. 環境変数の設定

### 必須環境変数

```env
# Langfuse 認証
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...

# Langfuse ホスト（セルフホスト時は必須）
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # EU リージョン
# LANGFUSE_BASE_URL=https://us.cloud.langfuse.com  # US リージョン
# LANGFUSE_BASE_URL=http://localhost:3000  # セルフホスト

# LLM プロバイダー
OPENAI_API_KEY=sk-proj-...
```

### オプション環境変数

```env
# デバッグモード
LANGFUSE_DEBUG=true

# デコレーターの I/O キャプチャ無効化（パフォーマンス最適化）
LANGFUSE_OBSERVE_DECORATOR_IO_CAPTURE_ENABLED=false
```

### Python での設定例

```python
import os

os.environ["LANGFUSE_SECRET_KEY"] = "sk-lf-..."
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-lf-..."
os.environ["LANGFUSE_BASE_URL"] = "http://localhost:3000"  # セルフホスト
os.environ["OPENAI_API_KEY"] = "sk-proj-..."
```

---

## 3. CallbackHandler の使い方

### 基本的な初期化

```python
from langfuse import get_client
from langfuse.langchain import CallbackHandler

# シングルトンクライアント取得（v3）
langfuse = get_client()

# CallbackHandler 作成
langfuse_handler = CallbackHandler()
```

### LangChain での使用

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(model_name="gpt-4o")
prompt = ChatPromptTemplate.from_template("Tell me a joke about {topic}")
chain = prompt | llm

# CallbackHandler を config で渡す
response = chain.invoke(
    {"topic": "cats"},
    config={"callbacks": [langfuse_handler]}
)
```

### メタデータでトレース属性を設定

```python
response = chain.invoke(
    {"topic": "cats"},
    config={
        "callbacks": [langfuse_handler],
        "metadata": {
            "langfuse_user_id": "user-123",
            "langfuse_session_id": "session-456",
            "langfuse_tags": ["production", "humor-bot"],
            "custom_field": "additional metadata"
        }
    }
)
```

### コンテキストマネージャーでの属性伝播（推奨）

```python
from langfuse import get_client, propagate_attributes
from langfuse.langchain import CallbackHandler

langfuse = get_client()

with langfuse.start_as_current_observation(as_type="span", name="chain-call") as span:
    with propagate_attributes(user_id="user-123", session_id="session-456"):
        handler = CallbackHandler()
        response = chain.invoke(
            {"input": "Hello"},
            config={"callbacks": [handler]}
        )
        # トレースの入出力を明示的に設定
        span.update_trace(
            input={"query": "Hello"},
            output={"response": response}
        )
```

---

## 4. LangGraph との統合

### 要件

- **Python 3.11 以上が必須**

### 基本的な使用方法

```python
from langfuse.langchain import CallbackHandler
from langgraph.graph import StateGraph
from langchain_core.messages import HumanMessage
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

# State 定義
class State(TypedDict):
    messages: Annotated[list, add_messages]

# Graph 構築
graph_builder = StateGraph(State)
graph_builder.add_node("chatbot", chatbot_function)
graph_builder.set_entry_point("chatbot")
graph_builder.set_finish_point("chatbot")
graph = graph_builder.compile()

# CallbackHandler を渡して実行
langfuse_handler = CallbackHandler()

for s in graph.stream(
    {"messages": [HumanMessage(content="What is Langfuse?")]},
    config={"callbacks": [langfuse_handler]}
):
    print(s)
```

### LangGraph Server での使用

```python
# Graph 宣言時に CallbackHandler を設定
graph = graph_builder.compile().with_config({"callbacks": [langfuse_handler]})
```

### Graph ビジュアライゼーション

Langfuse は LangGraph のトレースを自動的にグラフビューで可視化する（2025年2月追加）。

```python
# ローカルで Graph を可視化（デバッグ用）
from IPython.display import Image, display
display(Image(graph.get_graph().draw_mermaid_png()))
```

---

## 5. @observe デコレーターの使い方

### 基本的な使用

```python
from langfuse import observe

@observe()
def my_data_processing_function(data, parameter):
    return {"processed_data": data, "status": "ok"}

@observe(name="llm-call", as_type="generation")
async def my_async_llm_call(prompt_text):
    return "LLM response"
```

### デコレーターパラメータ

| パラメータ | 説明 | デフォルト |
|-----------|------|-----------|
| `name` | オブザベーション名 | 関数名 |
| `as_type` | タイプ（"span", "generation", "tool"） | "span" |
| `capture_input` | 入力キャプチャ有効化 | `True` |
| `capture_output` | 出力キャプチャ有効化 | `True` |

### ネストされたオブザベーション

```python
from langfuse import observe

@observe()
def inner_function(data):
    return {"processed": data}

@observe()
def outer_function(data):
    # 自動的にネストされる
    return inner_function(data)
```

### トレース属性の更新（v3 API）

```python
from langfuse import observe, get_client

@observe()
def process_query(user_input: str):
    langfuse = get_client()

    # 現在のトレースを更新
    langfuse.update_current_trace(
        user_id="user-123",
        session_id="session-456",
        tags=["production"]
    )

    return "result"
```

### LangChain との組み合わせ

```python
from langfuse import observe, get_client, propagate_attributes
from langfuse.langchain import CallbackHandler

@observe()
def process_with_langchain(user_input: str):
    langfuse = get_client()

    with propagate_attributes(
        user_id="user-123",
        session_id="session-456"
    ):
        handler = CallbackHandler()
        result = chain.invoke(
            {"input": user_input},
            config={"callbacks": [handler]}
        )

    return result
```

---

## 6. v2 から v3 への主な変更点

### インポートの変更

```python
# v2（非推奨）
from langfuse.callback import CallbackHandler
from langfuse.decorators import langfuse_context, observe

# v3（推奨）
from langfuse.langchain import CallbackHandler
from langfuse import observe, get_client
```

### トレース属性の設定方法

```python
# v2（非推奨）: CallbackHandler のコンストラクタで設定
handler = CallbackHandler(user_id="user-123", session_id="session-456")

# v3（推奨）: metadata で設定
response = chain.invoke(
    {"input": "Hello"},
    config={
        "callbacks": [handler],
        "metadata": {
            "langfuse_user_id": "user-123",
            "langfuse_session_id": "session-456"
        }
    }
)

# v3（推奨）: propagate_attributes で設定
with propagate_attributes(user_id="user-123", session_id="session-456"):
    handler = CallbackHandler()
    response = chain.invoke({"input": "Hello"}, config={"callbacks": [handler]})
```

### コンテキスト更新

```python
# v2（非推奨）
langfuse_context.update_current_trace(user_id="user-123")

# v3（推奨）
langfuse = get_client()
langfuse.update_current_trace(user_id="user-123")
```

### トレース ID 管理

```python
# v3: 外部 ID から決定論的トレース ID を生成
from langfuse import Langfuse

trace_id = Langfuse.create_trace_id(seed="external_request_id")
```

---

## 7. 分散トレーシング

### カスタムトレース ID の使用

```python
from langfuse import Langfuse, get_client
from langfuse.langchain import CallbackHandler

# 外部 ID から決定論的トレース ID を生成
predefined_trace_id = Langfuse.create_trace_id(seed="external_request_id")

langfuse = get_client()

with langfuse.start_as_current_observation(
    as_type="span",
    name="langchain-request",
    trace_context={"trace_id": predefined_trace_id}
) as span:
    handler = CallbackHandler()
    response = chain.invoke(
        {"input": "data"},
        config={"callbacks": [handler]}
    )
```

### マルチプロジェクトルーティング（実験的）

```python
from langfuse.langchain import CallbackHandler

# 異なるプロジェクトにトレースをルーティング
handler_a = CallbackHandler(public_key="pk-lf-project-a-...")
handler_b = CallbackHandler(public_key="pk-lf-project-b-...")
```

---

## 8. スコアリング

### スパンオブジェクト経由

```python
with langfuse.start_as_current_observation(as_type="span") as span:
    # ... 処理 ...
    span.score_trace(
        name="user-feedback",
        value=1,
        data_type="NUMERIC",
        comment="Correct response"
    )
```

### トレース ID 経由

```python
langfuse.create_score(
    trace_id=trace_id,
    name="correctness",
    value=0.9,
    data_type="NUMERIC"
)
```

---

## 9. ベストプラクティス

### 初期化

```python
from langfuse import get_client

# シングルトンパターンを使用（v3）
langfuse = get_client()
```

### 短命アプリケーションでのフラッシュ

```python
# サーバーレス環境では必須
langfuse.flush()

# 完全なシャットダウン
get_client().shutdown()
```

### パフォーマンス最適化

```python
# 大きな入出力をキャプチャしない
@observe(capture_input=False, capture_output=False)
def process_large_data(data):
    return heavy_processing(data)
```

### Azure OpenAI 使用時

```python
from langchain_openai import AzureChatOpenAI

llm = AzureChatOpenAI(
    azure_deployment="my-deployment",
    model="gpt-4o"  # モデル名の正しいパースに必要
)
```

---

## 10. 完全な実装例

### FastAPI + LangChain + Langfuse

```python
from fastapi import FastAPI
from langfuse import get_client, observe, propagate_attributes
from langfuse.langchain import CallbackHandler
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

app = FastAPI()
langfuse = get_client()

# チェーン定義
llm = ChatOpenAI(model_name="gpt-4o")
prompt = ChatPromptTemplate.from_template("Answer the question: {question}")
chain = prompt | llm

@app.post("/chat")
@observe(name="chat-endpoint")
async def chat(user_id: str, session_id: str, question: str):
    with propagate_attributes(user_id=user_id, session_id=session_id):
        handler = CallbackHandler()
        response = chain.invoke(
            {"question": question},
            config={"callbacks": [handler]}
        )

    # フラッシュ（重要）
    langfuse.flush()

    return {"answer": response.content}
```

### LangGraph Agent + Langfuse

```python
from langfuse import get_client, propagate_attributes
from langfuse.langchain import CallbackHandler
from langgraph.graph import StateGraph
from langchain_core.messages import HumanMessage
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

langfuse = get_client()

class State(TypedDict):
    messages: Annotated[list, add_messages]

def chatbot(state: State):
    # LLM 呼び出しロジック
    return {"messages": [response]}

graph_builder = StateGraph(State)
graph_builder.add_node("chatbot", chatbot)
graph_builder.set_entry_point("chatbot")
graph_builder.set_finish_point("chatbot")
graph = graph_builder.compile()

def run_agent(user_id: str, question: str):
    with propagate_attributes(user_id=user_id):
        handler = CallbackHandler()

        for s in graph.stream(
            {"messages": [HumanMessage(content=question)]},
            config={"callbacks": [handler]}
        ):
            yield s

    langfuse.flush()
```

---

## 参考リンク

- [Langfuse LangChain Integration](https://langfuse.com/integrations/frameworks/langchain)
- [Langfuse LangGraph Integration](https://langfuse.com/guides/cookbook/integration_langgraph)
- [Python SDK v3 Migration Guide](https://langfuse.com/docs/observability/sdk/python/upgrade-path)
- [@observe Decorator Documentation](https://langfuse.com/docs/sdk/python/decorators)
- [Langfuse SDK Overview](https://langfuse.com/docs/observability/sdk/overview)
- [LangChain Cookbook](https://langfuse.com/guides/cookbook/integration_langchain)
- [Graph View for LangGraph Traces](https://langfuse.com/changelog/2025-02-14-trace-graph-view)
- [langfuse PyPI](https://pypi.org/project/langfuse/)
- [GitHub - langfuse-python](https://github.com/langfuse/langfuse-python)
