# Generative AI Policy

**MANDATORY**: 生成AI機能は、処理時間で**2つのパターン**に振り分けて実装する。実装の詳細・
コードは `.claude/skills/amplify-gen2`（`references/generative-ai.md`）に従う。

## 1. パターンの選択（必須）

| 種類 | 実装パターン |
|---|---|
| **対話的・短時間**（チャット、補完、要約など即時応答） | **SSE ストリーミング**でトークンを逐次返す（オーソドックスな既定） |
| **長時間・エージェント的**（マルチステップ推論、ツール連携、バッチ、数十秒〜分） | **バックグラウンド処理 + DB で処理ステータス管理 + フロントは Amplify リアルタイムで監視** |

「短いか長いか」で迷ったら、**Lambda / Function URL のタイムアウト（同期は最大15分、SSE も接続を保持し続ける）を超えうるか**で判断する。超えうる／途中経過を見せたい／複数人が監視する場合は必ずパターン B。

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
- 監視を**ポーリングで実装しない**（Amplify リアルタイム = AppSync サブスクリプション）。
- 違反する実装はやり直し。判断に迷う場合はユーザーに確認（`feedback_ask_user_when_unsure.md`）。
