# LangGraph 詳細ガイド

## Persistence（状態永続化）

### コンセプト

**Checkpoints** はグラフの実行状態のスナップショットで、各スーパーステップで保存されます。

**Threads** は実行状態を一意に識別するIDで、複数の実行を整理し、中断後の再開を可能にします。

### Checkpointer 選択

| Checkpointer | 用途 | パッケージ |
|--------------|------|-----------|
| `InMemorySaver` | 開発・テスト | `langgraph` (組込み) |
| `SqliteSaver` | ローカル永続化 | `langgraph-checkpoint-sqlite` |
| `PostgresSaver` | 本番環境 | `langgraph-checkpoint-postgres` |

### 実装パターン

```python
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph

# 本番用 Checkpointer
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)

# グラフにコンパイル時に設定
graph = workflow.compile(checkpointer=checkpointer)

# 実行時の設定
config = {"configurable": {"thread_id": "conversation-123"}}

# 状態取得
state = graph.get_state(config)

# 状態履歴取得
history = list(graph.get_state_history(config))

# 状態更新
graph.update_state(config, values={"key": "new_value"})
```

### ベストプラクティス

- **暗号化**: `EncryptedSerializer` で機密データを AES 暗号化
- **シリアライズ**: デフォルトの `JsonPlusSerializer` は多くの型をサポート
- **障害耐性**: 成功したノードの書き込みは保持され、リカバリ時の再実行を防止

---

## Interrupts（HITL）

### 基本概念

Interrupts はグラフ実行を特定ポイントで一時停止し、外部入力を待機します。

**3つの必須要素**:
1. Checkpointer（状態永続化）
2. thread_id（状態識別）
3. `interrupt()` 呼び出し

### 実装パターン

```python
from langgraph.types import interrupt, Command

def approval_node(state):
    """承認が必要な操作の前に実行"""
    # 実行を一時停止、ペイロードを返す
    user_decision = interrupt({
        "question": "この操作を実行しますか？",
        "proposed_action": state["pending_action"],
    })

    if not user_decision["approved"]:
        return {"status": "rejected", "reason": user_decision.get("reason")}

    return {"status": "approved"}
```

### 再開方法

```python
# 初回実行（interrupt で停止）
config = {"configurable": {"thread_id": "thread-1"}}
result = graph.invoke({"input": "data"}, config)

# 結果に __interrupt__ が含まれる場合、承認待ち
if "__interrupt__" in result:
    # ユーザー承認後に再開
    graph.invoke(Command(resume={"approved": True}), config)
```

### よくあるパターン

| パターン | 説明 |
|---------|------|
| **承認ワークフロー** | 重要な操作前に一時停止 |
| **レビュー & 編集** | LLM 出力を人間が修正 |
| **ツール呼び出し承認** | ツール実行前に確認 |
| **入力検証ループ** | 有効なデータ受信まで繰り返し |

### 重要なルール

```python
# ❌ 禁止: try/except でラップ（例外をキャッチしてしまう）
try:
    result = interrupt("question")
except:
    pass

# ❌ 禁止: 条件付きスキップ（インデックス不整合）
if some_condition:
    interrupt("question")

# ❌ 禁止: 非シリアライズ可能オブジェクト
interrupt(lambda x: x)  # 関数は不可

# ✅ 推奨: 副作用は interrupt 後に配置
def node(state):
    approved = interrupt("承認しますか？")
    if approved:
        # 副作用はここで実行（再開時に1回のみ）
        perform_action()
    return state
```

---

## Time Travel

### コンセプト

Time travel は過去のチェックポイントから実行を再開し、異なる実行パスを探索します。

**用途**:
- 意思決定プロセスの分析
- エラーのデバッグ
- 代替案の探索

### 4ステップワークフロー

```python
import uuid

# 1. グラフ実行
config = {"configurable": {"thread_id": str(uuid.uuid4())}}
state = graph.invoke({"input": "initial"}, config)

# 2. チェックポイント特定
states = list(graph.get_state_history(config))
target_state = states[2]  # 特定のポイントを選択

# 3. 状態更新（オプション）
new_config = graph.update_state(
    target_state.config,
    values={"key": "modified_value"}
)

# 4. 実行再開
graph.invoke(None, new_config)
```

---

## Message History 管理

### 問題

会話履歴がコンテキストウィンドウを超える場合の対処が必要です。

### 戦略

| 戦略 | 説明 |
|------|------|
| **トリミング** | 最初/最後の N メッセージを削除 |
| **要約** | 古いメッセージを要約に置換 |
| **カスタム** | ドメイン固有のフィルタリング |

### pre_model_hook 実装

```python
from langchain_core.messages.utils import trim_messages, count_tokens_approximately
from langgraph.prebuilt import create_react_agent

def pre_model_hook(state):
    """LLM 呼び出し前にメッセージを処理"""
    trimmed = trim_messages(
        state["messages"],
        strategy="last",
        token_counter=count_tokens_approximately,
        max_tokens=4000,
        start_on="human",
        end_on=("human", "tool"),
    )
    return {"llm_input_messages": trimmed}

graph = create_react_agent(
    model=model,
    tools=tools,
    pre_model_hook=pre_model_hook,
    checkpointer=checkpointer,
)
```

### 2つのアプローチ

```python
# 1. 元の履歴を保持（推奨）
def pre_model_hook(state):
    trimmed = trim_messages(state["messages"], ...)
    return {"llm_input_messages": trimmed}  # LLM入力のみ変更

# 2. 履歴を上書き（ストレージ節約）
from langchain_core.messages import RemoveMessage
from langgraph.graph.message import REMOVE_ALL_MESSAGES

def pre_model_hook(state):
    trimmed = trim_messages(state["messages"], ...)
    return {
        "messages": [RemoveMessage(REMOVE_ALL_MESSAGES)] + trimmed
    }
```

---

## 多数のツール管理

### 問題

ツールが多すぎると、トークン消費が増大し、モデルの推論精度が低下します。

### 解決策: 動的ツール選択

```python
from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_openai import OpenAIEmbeddings

# 1. ツールをベクトルストアにインデックス
tool_documents = [
    Document(
        page_content=tool.description,
        id=tool.name,
        metadata={"tool_name": tool.name}
    )
    for tool in tool_registry
]

vector_store = InMemoryVectorStore(embedding=OpenAIEmbeddings())
vector_store.add_documents(tool_documents)

# 2. ツール選択ノード
def select_tools(state):
    """クエリに関連するツールのみを選択"""
    query = state["messages"][-1].content
    relevant_docs = vector_store.similarity_search(query, k=5)
    selected_tool_names = [doc.id for doc in relevant_docs]
    return {"selected_tools": selected_tool_names}

# 3. グラフ構成
graph_builder.add_node("select_tools", select_tools)
graph_builder.add_node("agent", agent_node)
graph_builder.add_edge("select_tools", "agent")
```

---

## Agents API リファレンス

### create_react_agent パラメータ

| パラメータ | 説明 |
|-----------|------|
| `model` | 使用する LLM |
| `tools` | 利用可能なツールリスト |
| `checkpointer` | 状態永続化 |
| `pre_model_hook` | LLM 呼び出し前処理 |
| `response_format` | 構造化出力スキーマ |
| `interrupt_before` | 特定ノード前に中断 |
| `interrupt_after` | 特定ノード後に中断 |

### InjectedState / InjectedStore

```python
from langgraph.prebuilt import InjectedState, InjectedStore
from typing import Annotated

def my_tool(
    query: str,
    state: Annotated[dict, InjectedState],  # グラフ状態へのアクセス
    store: Annotated[BaseStore, InjectedStore],  # 永続ストレージ
) -> str:
    """ツール内で状態とストアにアクセス"""
    user_id = state.get("user_id")
    cached = store.get(namespace=("cache",), key=query)
    return cached or "..."
```
