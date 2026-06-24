# Generative AI Policy

**MANDATORY**: 生成AI機能は、処理時間で**2つのパターン**に振り分けて実装する。実装の詳細・
コードは `.claude/skills/amplify-gen2`（`references/generative-ai.md`）に従う。

## 1. パターンの選択（必須）

| 種類 | 実装パターン |
|---|---|
| **対話的・短時間**（チャット、補完、要約など即時応答） | **A: SSE ストリーミング**でトークンを逐次返す（オーソドックスな既定） |
| **バックグラウンド・〜15分・サンドボックス不要**（数十秒〜数分のジョブ） | **B: ワーカー Lambda + DB ステータス + Amplify リアルタイム監視** |
| **超長時間（> Lambda 15分）or サンドボックス隔離が必要なエージェント**（任意コード/AI生成コードの実行、ブラウザ操作、多段の自律エージェント） | **C: Amazon Bedrock AgentCore**（Runtime: 最大8時間・microVM 隔離 / Code Interpreter・Browser: サンドボックスツール）+ DB ステータス + Amplify リアルタイム監視 |

判断軸:
- 即時応答でトークンを流す → **A（SSE）**。
- 背景処理だが **Lambda の15分以内で収まり、サンドボックス不要** → **B（ワーカー Lambda）**。
- **15分を超える** or **サンドボックス（隔離されたコード実行・ブラウザ）が要る** → **C（AgentCore）**。
  迷ったら「Lambda の15分を超えうるか」「未検証/AI生成コードを実行するか」で判定し、どちらか Yes なら C。

> **B も C も、フロント監視は共通**: DB（Amplify Data）に処理ステータスを持ち、フロントは Amplify の
> リアルタイム（AppSync サブスクリプション）で監視する。違いは「処理本体をどこで走らせるか」だけ。

## 2. 対話的 = SSE ストリーミング（既定）

- **TypeScript の Amplify Function（第一候補）**で実装する。Hono の `streamSSE`（`hono/streaming`）+
  `streamHandle`（`hono/aws-lambda`）、Function URL は `InvokeMode.RESPONSE_STREAM`。
- トークン源は **LangChain**（`@langchain/aws` の `ChatBedrockConverse` の `.stream()`）。
  低レベルは Bedrock `ConverseStream`。
- フロントは Client Component で SSE を購読（`fetch` + `ReadableStream`）。SSR でストリームしない。
- 管理型の代替: Amplify AI Kit `a.conversation`（AppSync サブスクリプションでストリーム）。
  本リポジトリの既定は SSE だが、ターンキーなチャットが欲しい場合の選択肢。

## 3. 長時間エージェント = バックグラウンド + DB ステータス + リアルタイム監視

1. **DB（Amplify Data）に処理ステータスを持つジョブモデル**を定義する
   （例 `AgentJob`: `status` enum `PENDING|RUNNING|SUCCEEDED|FAILED`、`progress`、`result`、`error`、owner 認可）。
2. クライアントはジョブを作成（`getDataClient().models.AgentJob.create`）し、**バックグラウンドのワーカー
   Lambda**（SQS 経由 or 作成イベント）でエージェント本体を実行する。
3. ワーカーは進捗・結果を**サーバーサイドのデータクライアント（IAM/ロール認可）でジョブ行に書き戻す**。
4. **フロントは Amplify のリアルタイム機能（AppSync サブスクリプション: `observeQuery` / `onUpdate`）で
   ジョブをリアルタイム監視**し、進捗・完了を即時反映する（`.claude/rules/render-optimization.md` に従い entity 層へ）。

> リアルタイム監視は **Amplify のベストプラクティス（AppSync サブスクリプション）** を使う。ポーリングはしない。
> 詳細は `.claude/skills/amplify-gen2/references/realtime.md`、バックグラウンド/SQS は `references/aws-services.md`。

> **ワーカー Lambda は ≤15分・サンドボックス不要のときだけ**。超えるか、隔離されたコード実行/ブラウザが
> 要るなら下の §3.5（AgentCore）に逃がす。

## 3.5 超長時間 / サンドボックスが要る = Amazon Bedrock AgentCore（必須）

以下のいずれかに該当するエージェント処理は **ワーカー Lambda ではなく Amazon Bedrock AgentCore** を使う:

- **Lambda の 15分上限を超える**（多段の自律エージェント、長い推論・ツールループ、バッチ）。
- **サンドボックス隔離が必要**（AI/LLM が生成した任意コードの実行、ブラウザ操作などの未検証処理）。

| 用途 | AgentCore の機能 |
|---|---|
| エージェント本体を長時間ホスト（最大 **8時間**・microVM セッション隔離・非同期） | **AgentCore Runtime**（`InvokeAgentRuntime`） |
| AI 生成/任意コードを隔離実行（Python/JS/TS・15分→最大8時間・S3 経由 5GB） | **AgentCore Code Interpreter** |
| エージェントのブラウザ操作を隔離実行 | **AgentCore Browser** |

- 監視は **B と同じ**: ジョブ状態を Amplify Data（`AgentJob` 等）に書き、フロントは AppSync サブスクで監視。
  起動・進捗反映は worker/オーケストレータ（または AgentCore からのコールバック）が Amplify Data を IAM 認可で更新する。
- AgentCore 呼び出しは IAM（`bedrock-agentcore:InvokeAgentRuntime` 等）を最小権限で付与（`references/aws-services.md`）。
- LangGraph / Strands 等のフレームワークをそのままホストできる。詳細は `references/generative-ai.md` の Pattern C。

## 4. 共通ルール

- **LLM クライアントは LangChain**（`.claude/rules/backend-py.md` の LLM ポリシー）。TS=`@langchain/aws`、
  Python=`langchain-aws`。直 SDK は LangChain 未対応機能のときだけ（理由をコメント）。
- **バックエンドは TypeScript の Amplify Function が既定**（`.claude/rules/backend-architecture.md`）。
  Python（`backend-py`）は LangGraph の複雑なエージェント等、特殊要件のときのみ。
- **依存追加は bun**（`bun add @langchain/aws ...`）。Python は `uv add --package <member> langchain-aws`。
- Bedrock はリージョン単位でモデルアクセス有効化が必要。IAM は最小権限
  （`bedrock:InvokeModel` / `bedrock:InvokeModelWithResponseStream`、`references/aws-services.md`）。
- 認可: ジョブの**読み取り/監視は owner**、**ワーカーの書き込みは IAM/ロール**（非 owner）で行う。

## 5. 強制事項

- 対話的 AI を**ポーリングや一括レスポンス**で実装しない（SSE を使う）。
- 長時間エージェントを**同期 Function URL で待たせない**（背景処理 + DB ステータス + サブスクリプション）。
- **Lambda の15分を超える / サンドボックスが要るエージェントを worker Lambda で無理に回さない**
  （**Amazon Bedrock AgentCore** を使う。§3.5）。未検証/AI生成コードを素の Lambda で実行しない。
- 監視を**ポーリングで実装しない**（Amplify リアルタイム = AppSync サブスクリプション）。
- 違反する実装はやり直し。判断に迷う場合はユーザーに確認（`feedback_ask_user_when_unsure.md`）。
