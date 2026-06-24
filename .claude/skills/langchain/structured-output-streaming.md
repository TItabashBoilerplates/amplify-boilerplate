# Structured Output ストリーミングガイド

## 概要

LangGraph でカスタムストリーミングを使用し、構造化出力を途中結果として送信するパターンを解説します。

> **参照**: [LangGraphの途中出力ストリーミング解説](https://zenn.dev/mseabass/articles/8d7272b58bdd1f)

---

## 重要な制約: TypedDict を使用する

### Pydantic では構造化出力のストリーミング不可

`with_structured_output` を使用してストリーミングする場合、**Pydantic モデルではストリーミングできません**。代わりに **TypedDict** を使用する必要があります。

```python
# ❌ 禁止: Pydantic ではストリーミング不可
from pydantic import BaseModel

class AnalysisResult(BaseModel):
    thinking: str
    answer: str

# ストリーミングモードでは動作しない
chain = llm.with_structured_output(AnalysisResult)
for chunk in chain.stream(...):  # 動作しない
    pass

# ✅ 推奨: TypedDict を使用
from typing import TypedDict

class AnalysisResult(TypedDict):
    thinking: str
    answer: str

# ストリーミングモードで動作
chain = llm.with_structured_output(AnalysisResult)
for chunk in chain.stream(...):  # 動作する
    print(chunk)
```

### TypedDict の定義パターン

```python
from typing import TypedDict, Optional
from typing_extensions import Required, NotRequired

# 基本パターン
class StreamingOutput(TypedDict):
    thinking: str
    answer: str

# オプショナルフィールド付き
class StreamingOutputWithOptional(TypedDict, total=False):
    thinking: str
    answer: str
    confidence: float  # オプショナル

# 必須とオプショナルの混在
class MixedOutput(TypedDict):
    thinking: Required[str]  # 必須
    answer: Required[str]    # 必須
    metadata: NotRequired[dict]  # オプショナル
```

---

## LangGraph カスタムストリーミング

### 3 つの必須設定

1. **streamMode の設定**: `stream_mode="custom"`
2. **writer の設定**: ノード内で `config["writer"]` を使用
3. **checkpointer の設定**: ストリーミングには checkpointer が必須

### Python 実装

```python
from typing import TypedDict
from langgraph.graph import StateGraph
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig

# 1. 出力スキーマ定義（TypedDict 必須）
class ThinkingOutput(TypedDict):
    type: str  # "thinking" or "answer"
    content: str

# 2. グラフ状態定義
class GraphState(TypedDict):
    input: str
    result: str

# 3. ストリーミングノード実装
async def thinking_node(state: GraphState, config: RunnableConfig) -> GraphState:
    writer = config.get("writer")

    # 思考過程をストリーミング出力
    if writer:
        await writer(ThinkingOutput(type="thinking", content="分析中..."))
        await writer(ThinkingOutput(type="thinking", content="データを検証中..."))

    # LLM 呼び出し（with_structured_output + TypedDict）
    chain = llm.with_structured_output(ThinkingOutput)
    async for chunk in chain.astream(state["input"]):
        if writer and chunk.get("content"):
            await writer(chunk)

    return {"result": "完了"}

# 4. グラフ構築
workflow = StateGraph(GraphState)
workflow.add_node("thinking", thinking_node)
workflow.set_entry_point("thinking")
workflow.set_finish_point("thinking")

# 5. checkpointer 設定（必須）
checkpointer = MemorySaver()
graph = workflow.compile(checkpointer=checkpointer)

# 6. ストリーミング実行
async def run_streaming():
    config = {"configurable": {"thread_id": "thread-1"}}

    async for chunk in graph.astream(
        {"input": "分析対象"},
        config=config,
        stream_mode="custom",  # カスタムストリーミングモード
    ):
        print(f"受信: {chunk}")
```

### TypeScript 実装

```typescript
import { StateGraph, MemorySaver } from "@langchain/langgraph";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

// 1. 出力スキーマ定義
interface ThinkingOutput {
  type: "thinking" | "answer";
  content: string;
}

// 2. グラフ状態定義
interface GraphState {
  input: string;
  result: string;
}

// 3. ストリーミングノード実装
async function thinkingNode(
  state: GraphState,
  config: LangGraphRunnableConfig
): Promise<Partial<GraphState>> {
  const writer = config.writer;

  // 思考過程をストリーミング出力
  if (writer) {
    await writer({ type: "thinking", content: "分析中..." } as ThinkingOutput);
    await writer({ type: "thinking", content: "データを検証中..." } as ThinkingOutput);
  }

  return { result: "完了" };
}

// 4. グラフ構築
const workflow = new StateGraph<GraphState>({
  channels: {
    input: { value: null },
    result: { value: null },
  },
});

workflow.addNode("thinking", thinkingNode);
workflow.setEntryPoint("thinking");
workflow.setFinishPoint("thinking");

// 5. checkpointer 設定（必須）
const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

// 6. ストリーミング実行
async function runStreaming() {
  const config = { configurable: { thread_id: "thread-1" } };

  for await (const chunk of await graph.stream(
    { input: "分析対象" },
    { ...config, streamMode: "custom" }
  )) {
    console.log("受信:", chunk);
  }
}
```

---

## ユースケース: 思考と回答の分離表示

LLM の思考過程と最終回答を別々に表示する場合：

```python
from typing import TypedDict, Literal

class StreamChunk(TypedDict):
    chunk_type: Literal["thinking", "answer"]
    content: str

async def agent_node(state: GraphState, config: RunnableConfig) -> GraphState:
    writer = config.get("writer")

    # 思考過程を表示（異なる UI スタイルで表示可能）
    if writer:
        await writer(StreamChunk(chunk_type="thinking", content="問題を分析しています..."))
        await writer(StreamChunk(chunk_type="thinking", content="解決策を検討中..."))

    # 最終回答
    if writer:
        await writer(StreamChunk(chunk_type="answer", content="結論は..."))

    return state
```

フロントエンドでは `chunk_type` に基づいて表示スタイルを切り替えます。

---

## よくある間違い

### 1. Pydantic を使用してストリーミングを試みる

```python
# ❌ 動作しない
from pydantic import BaseModel

class Output(BaseModel):
    content: str

chain = llm.with_structured_output(Output)
for chunk in chain.stream(input):  # ストリーミング不可
    pass
```

### 2. checkpointer なしでストリーミング

```python
# ❌ エラーになる
graph = workflow.compile()  # checkpointer なし
async for chunk in graph.astream(..., stream_mode="custom"):
    pass  # 動作しない
```

### 3. writer の null チェック忘れ

```python
# ❌ 危険
async def node(state, config):
    await config["writer"](data)  # writer が None の可能性

# ✅ 安全
async def node(state, config):
    writer = config.get("writer")
    if writer:
        await writer(data)
```

---

## まとめ

| 項目 | 設定 |
|------|------|
| スキーマ定義 | **TypedDict** を使用（Pydantic 不可） |
| ストリームモード | `stream_mode="custom"` |
| 出力送信 | `config["writer"]` を使用 |
| 状態永続化 | checkpointer 必須 |
