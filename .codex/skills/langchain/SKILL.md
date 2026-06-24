---
name: langchain
description: LangChain/LangGraph/LangSmith ガイダンス。エージェント実装、Persistence、Interrupts（HITL）、Time travel、Structured Output、Evaluation についての質問に使用。Python ベースの LLM オーケストレーション、セキュリティベストプラクティス、本番環境対応の実装支援を提供。
---

# LangChain / LangGraph / LangSmith スキル

このプロジェクトは **LangGraph** を使用してエージェントワークフローを構築し、**LangSmith** で評価・監視を行います。

## 技術スタック概要

| コンポーネント    | 用途                                   | パッケージ                      |
| ----------------- | -------------------------------------- | ------------------------------- |
| **LangGraph**     | ステートフルなエージェントワークフロー | `langgraph>=1.0.5`              |
| **LangChain**     | LLM 統合・ツール定義                   | `langchain>=1.2.0`              |
| **LangSmith**     | 評価・モニタリング・デバッグ           | LangSmith Cloud                 |
| **Checkpointers** | 状態永続化                             | `langgraph-checkpoint-postgres` |

## エージェント作成の選択肢

| API                                     | 用途         | 特徴                                         |
| --------------------------------------- | ------------ | -------------------------------------------- |
| `langgraph.prebuilt.create_react_agent` | 低レベル制御 | グラフ構造、カスタムノード、`pre_model_hook` |
| `langchain.agents.create_agent`         | ミドルウェア | PII 検出、HITL、要約など組み込み機能         |

## クイックリファレンス

### LangGraph: create_react_agent（推奨）

```python
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.prebuilt import create_react_agent

# 本番環境: PostgreSQL checkpointer
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)

# エージェント作成
graph = create_react_agent(
    model=model,
    tools=tools,
    checkpointer=checkpointer,
)

# 実行時は thread_id が必須
config = {"configurable": {"thread_id": "user-123"}}
result = graph.invoke({"messages": messages}, config=config)
```

### Human-in-the-Loop（HITL）

```python
from langgraph.types import interrupt, Command

def approval_node(state):
    # 実行を一時停止して承認を待つ
    approved = interrupt("この操作を承認しますか？")
    if not approved:
        return {"status": "rejected"}
    return {"status": "approved"}

# 再開時
graph.invoke(Command(resume=True), config)
```

### Structured Output

```python
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

class AnalysisResult(BaseModel):
    summary: str = Field(description="分析結果の要約")
    confidence: float = Field(ge=0.0, le=1.0)
    recommendations: list[str]

# LangGraph: create_react_agent + response_format
from langgraph.prebuilt import create_react_agent

graph = create_react_agent(
    model=model,
    tools=tools,
    response_format=AnalysisResult,
)
```

## セキュリティ原則

| 原則                 | 説明                                         |
| -------------------- | -------------------------------------------- |
| **最小権限**         | ツールには必要最小限の権限のみ付与           |
| **潜在的悪用の想定** | LLM は与えられた全権限を使用する可能性がある |
| **多層防御**         | 単一の防御策に依存しない                     |

```python
# ❌ 危険: 広範なファイルアクセス
tools = [FileSystemTool(base_path="/")]

# ✅ 推奨: 制限されたアクセス
tools = [FileSystemTool(base_path="/app/uploads", read_only=True)]
```

## リリースポリシー

| パッケージ    | 現行 LTS    | サポート期限        |
| ------------- | ----------- | ------------------- |
| LangChain 1.x | ACTIVE      | 2.0 リリース後 1 年 |
| LangGraph 1.x | ACTIVE      | 2.0 リリース後 1 年 |
| LangGraph 0.4 | MAINTENANCE | 2026 年 12 月       |

**Python 要件**: Python 3.10 以上
