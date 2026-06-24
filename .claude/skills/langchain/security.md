# LangChain セキュリティガイド

## 3つの基本原則

### 1. 最小権限の原則

ツールとリソースには必要最小限の権限のみを付与します。

```python
# ❌ 危険: 広範な権限
database_tool = DatabaseTool(
    connection_string=ADMIN_CONNECTION,
    allowed_operations=["SELECT", "INSERT", "UPDATE", "DELETE", "DROP"],
)

# ✅ 推奨: 制限された権限
database_tool = DatabaseTool(
    connection_string=READONLY_CONNECTION,
    allowed_operations=["SELECT"],
    allowed_tables=["public_data", "user_profiles"],
)
```

### 2. 潜在的悪用の想定

LLM は与えられた全ての権限を使用する可能性があります。削除権限があれば、データを削除できると想定してください。

```python
# ❌ 危険: ファイル削除が可能
file_tool = FileSystemTool(
    base_path="/",
    operations=["read", "write", "delete"],
)

# ✅ 推奨: 読み取り専用、制限されたパス
file_tool = FileSystemTool(
    base_path="/app/uploads",
    operations=["read"],
    max_file_size=10 * 1024 * 1024,  # 10MB
)
```

### 3. 多層防御

単一の防御策に依存せず、複数の層で保護します。

```python
# 多層防御の例
class SecureAgent:
    def __init__(self):
        # 層1: 入力検証
        self.input_validator = InputValidator()

        # 層2: 制限されたツール
        self.tools = self._create_restricted_tools()

        # 層3: 出力フィルタリング
        self.output_filter = SensitiveDataFilter()

        # 層4: 監査ログ
        self.audit_logger = AuditLogger()

    async def invoke(self, input: str) -> str:
        # 入力検証
        validated = self.input_validator.validate(input)

        # 実行
        result = await self.agent.invoke(validated)

        # 出力フィルタリング
        filtered = self.output_filter.filter(result)

        # 監査ログ
        self.audit_logger.log(input, filtered)

        return filtered
```

## 具体的なリスクと対策

### ファイルシステムアクセス

| リスク | 対策 |
|-------|------|
| 機密ファイルの読み取り | base_path を制限 |
| システムファイルの変更 | read_only モード |
| 大量ファイルの読み込み | max_file_size 設定 |

```python
from langchain_community.tools import FileManagementToolkit

toolkit = FileManagementToolkit(
    root_dir="/app/user_uploads",
    selected_tools=["read_file", "list_directory"],  # 書き込み無効
)
```

### データベースアクセス

| リスク | 対策 |
|-------|------|
| スキーマ変更 | DDL 権限の削除 |
| データ削除 | DELETE 権限の削除 |
| 大量データ取得 | LIMIT 強制 |

```python
from langchain_community.utilities import SQLDatabase

# 読み取り専用接続
db = SQLDatabase.from_uri(
    READONLY_CONNECTION_STRING,
    include_tables=["products", "categories"],  # 許可テーブル
    sample_rows_in_table_info=3,
)
```

### API アクセス

| リスク | 対策 |
|-------|------|
| 不正なリクエスト | レート制限 |
| 機密データ送信 | 出力フィルタリング |
| 高コスト操作 | 操作ホワイトリスト |

```python
class SecureAPITool(BaseTool):
    rate_limiter: RateLimiter
    allowed_endpoints: list[str]

    def _run(self, endpoint: str, **kwargs) -> str:
        # レート制限チェック
        if not self.rate_limiter.allow():
            raise RateLimitError("Rate limit exceeded")

        # エンドポイントホワイトリスト
        if endpoint not in self.allowed_endpoints:
            raise SecurityError(f"Endpoint not allowed: {endpoint}")

        return self._call_api(endpoint, **kwargs)
```

## Human-in-the-Loop

重要な操作には人間の承認を必須にします。

### LangChain v1.0: HumanInTheLoopMiddleware

```python
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware

agent = create_agent(
    model="claude-sonnet-4-5-20250929",
    tools=[write_file, execute_sql, read_data],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                # ファイル書き込み: 全ての決定を許可
                "write_file": True,
                # SQL 実行: 承認または拒否のみ（編集不可）
                "execute_sql": {"allowed_decisions": ["approve", "reject"]},
                # データ読み取り: 自動承認（HITL不要）
                "read_data": False,
            }
        ),
    ],
)
```

### LangGraph: interrupt() 関数

```python
from langgraph.types import interrupt, Command
from langgraph.checkpoint.memory import InMemorySaver

def sensitive_operation_node(state):
    # 承認を待つ
    decision = interrupt({
        "operation": "delete_user",
        "target": state["user_id"],
    })
    if decision["approved"]:
        return {"status": "executed"}
    return {"status": "rejected", "reason": decision.get("reason")}

# checkpointer は必須
graph = workflow.compile(checkpointer=InMemorySaver())

# 再開時
graph.invoke(Command(resume={"approved": True}), config)
```

### 決定タイプ

| 決定 | 説明 | 注意点 |
|------|------|--------|
| **Approve** | そのまま実行 | - |
| **Edit** | 引数を修正して実行 | 大幅な変更は避ける |
| **Reject** | 実行拒否、フィードバック提供 | 理由を明記 |

## LangChain v1.0 セキュリティミドルウェア

### PIIMiddleware

個人情報を自動検出・保護します。

```python
from langchain.agents.middleware import PIIMiddleware

middleware = [
    # メールアドレスを自動マスク
    PIIMiddleware("email", strategy="redact", apply_to_input=True),
    # 電話番号をブロック（処理を停止）
    PIIMiddleware(
        "phone_number",
        detector=r"(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}",
        strategy="block",
    ),
]
```

### 戦略オプション

| 戦略 | 説明 |
|------|------|
| `redact` | 検出した PII をマスク文字で置換 |
| `block` | PII 検出時に処理を停止 |

## 脆弱性報告

### OSS プロジェクト

1. GitHub Security Tab から報告
2. セキュリティ連絡先にメール

### 対象パッケージ

Bug Bounty 対象:
- `langchain-core`
- `langgraph`
- 主要なインテグレーション

対象外:
- 実験的コード
- サンプルコード
- `langchain-community`

## チェックリスト

### デプロイ前

- [ ] 全ツールの権限を最小化
- [ ] 機密操作に HITL を設定
- [ ] 入出力のバリデーション実装
- [ ] 監査ログの有効化
- [ ] レート制限の設定
- [ ] エラーメッセージから機密情報を除去

### 継続的監視

- [ ] 異常なパターンのアラート設定
- [ ] 権限昇格の試みを検知
- [ ] 高コスト操作の監視
- [ ] 定期的なセキュリティレビュー
