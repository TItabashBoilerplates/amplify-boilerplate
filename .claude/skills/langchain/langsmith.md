# LangSmith 評価・モニタリングガイド

## 概要

LangSmith は LLM アプリケーションの評価・監視・デバッグを行うプラットフォームです。

## 評価タイプ

| タイプ             | 説明                                     | 用途             |
| ------------------ | ---------------------------------------- | ---------------- |
| **オフライン評価** | キュレーションされたデータセットでテスト | 開発中の品質検証 |
| **オンライン評価** | 本番トラフィックをリアルタイム評価       | 本番監視         |

## 評価ワークフロー

### 1. データセット作成

```python
from langsmith import Client

client = Client()

# データセット作成
dataset = client.create_dataset(
    dataset_name="質問応答テスト",
    description="基本的な Q&A テストケース",
)

# サンプル追加
examples = [
    {
        "inputs": {"question": "富士山の高さは？"},
        "outputs": {"answer": "3776メートル"},
    },
    {
        "inputs": {"question": "日本の首都は？"},
        "outputs": {"answer": "東京"},
    },
]
client.create_examples(dataset_id=dataset.id, examples=examples)
```

### 2. ターゲット関数定義

```python
from langsmith import wrappers
from openai import OpenAI

# OpenAI クライアントをラップ（トレーシング有効化）
openai_client = wrappers.wrap_openai(OpenAI())

def target(inputs: dict) -> dict:
    """評価対象の関数"""
    response = openai_client.chat.completions.create(
        model="gpt-5.2",
        messages=[
            {"role": "system", "content": "正確に回答してください"},
            {"role": "user", "content": inputs["question"]},
        ],
    )
    return {"answer": response.choices[0].message.content.strip()}
```

### 3. 評価器実装

```python
from openevals.llm import create_llm_as_judge
from openevals.prompts import CORRECTNESS_PROMPT

def correctness_evaluator(inputs: dict, outputs: dict, reference_outputs: dict):
    """正確性を評価する LLM-as-Judge"""
    evaluator = create_llm_as_judge(
        prompt=CORRECTNESS_PROMPT,
        model="openai:gpt-5.2",
        feedback_key="correctness",
    )
    return evaluator(
        inputs=inputs,
        outputs=outputs,
        reference_outputs=reference_outputs,
    )


def length_evaluator(inputs: dict, outputs: dict, reference_outputs: dict):
    """コードベースの評価器"""
    answer = outputs.get("answer", "")
    return {
        "key": "answer_length",
        "score": len(answer),
    }
```

### 4. 評価実行

```python
def run_evaluation():
    client = Client()

    results = client.evaluate(
        target,
        data="質問応答テスト",
        evaluators=[correctness_evaluator, length_evaluator],
        experiment_prefix="qa-evaluation",
        max_concurrency=4,
    )

    print(f"結果 URL: {results.experiment_url}")
    return results

if __name__ == "__main__":
    run_evaluation()
```

## 評価器タイプ

| タイプ           | 説明             | 例                     |
| ---------------- | ---------------- | ---------------------- |
| **Human Review** | 人間による評価   | 主観的品質判定         |
| **Code-based**   | ルールベース     | 長さ、フォーマット検証 |
| **LLM-as-Judge** | LLM による評価   | 正確性、関連性スコア   |
| **Pairwise**     | 2 つの出力を比較 | A/B テスト             |

## データセット管理

### バージョニング

LangSmith はデータセット変更時に自動でバージョンを作成します。

```python
# 特定バージョンのサンプルを取得
examples = client.list_examples(
    dataset_name="質問応答テスト",
    as_of="latest",  # または特定のタイムスタンプ
)

# タグ付きバージョン
client.update_dataset_tag(
    dataset_id=dataset.id,
    tag="prod",
    as_of="2024-01-15T10:00:00Z",
)
```

### フィルタリング

```python
# メタデータでフィルタ
examples = client.list_examples(
    dataset_name="テストデータ",
    metadata={"category": "factual"},
)

# スプリットでフィルタ
examples = client.list_examples(
    dataset_name="テストデータ",
    splits=["test"],
)
```

## Time Travel（Server API）

### 概念

Time travel を使用して、過去のチェックポイントから実行を再開できます。

### 実装

```python
from langgraph_sdk import get_client

client = get_client()

# 1. スレッド履歴取得
history = await client.threads.get_history(thread_id)

# 2. 特定チェックポイントの状態を更新
new_state = await client.threads.update_state(
    thread_id,
    values={"key": "modified_value"},
    checkpoint_id=target_checkpoint_id,
)

# 3. チェックポイントから再開
result = await client.runs.wait(
    thread_id,
    assistant_id,
    input=None,  # None で再開
    checkpoint_id=new_state["checkpoint_id"],
)
```

## 環境設定

```bash
# 必須
export LANGSMITH_API_KEY="lsv2_..."
export LANGSMITH_TRACING=true

# オプション
export LANGSMITH_PROJECT="my-project"
export LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
```

## ベストプラクティス

### 開発フロー

1. **開発中**: オフライン評価で変更を検証
2. **デプロイ前**: 回帰テストでベースラインと比較
3. **本番**: オンライン評価でリアルタイム監視
4. **改善**: 失敗トレースをデータセットに追加

### 評価設計

```python
# 複数の評価器を組み合わせ
evaluators = [
    # 正確性（LLM-as-Judge）
    correctness_evaluator,
    # 応答時間（コードベース）
    latency_evaluator,
    # 安全性（LLM-as-Judge）
    safety_evaluator,
]

# サンプリングレートを設定（本番）
online_config = {
    "sample_rate": 0.1,  # 10% のリクエストを評価
    "filters": {"has_error": True},  # エラー時のみ
}
```

### 継続的改善

```python
# 失敗したトレースをデータセットに追加
failed_runs = client.list_runs(
    project_name="production",
    filter="has_error = true",
)

for run in failed_runs:
    client.create_example(
        dataset_id=improvement_dataset.id,
        inputs=run.inputs,
        outputs=run.outputs,
        metadata={"source": "production_failure"},
    )
```
