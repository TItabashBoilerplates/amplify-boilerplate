---
name: detailed-design
description: |
  機能の詳細設計書を生成するスキル。新機能の設計、アーキテクチャ決定、データモデル設計、API設計、セキュリティ設計をGoogle Design Docスタイルで8ファイルに分割出力する。
  /detailed-design で呼び出し、feature名を引数に渡す。設計レビュー、技術仕様書、実装計画の作成にも使用。
argument-hint: <feature-name>
disable-model-invocation: true
effort: max
---

# 詳細設計書生成スキル

機能単位の詳細設計書を `docs/designs/$ARGUMENTS/` に8ファイル分割で生成する。

## 呼び出し方

```
/detailed-design user-management
/detailed-design multi-tenant-billing
```

## ワークフロー

### Phase 1: 要件ヒアリング

$ARGUMENTS が指定された場合、まず以下を確認する:

1. **機能の概要**: 何を実現したいか
2. **対象ユーザー**: B2B / B2C / 内部ツール
3. **スコープ**: 含める機能と含めない機能
4. **制約**: パフォーマンス、セキュリティ、既存システムとの互換性

ユーザーが十分な情報を提供している場合はヒアリングをスキップして Phase 2 へ進む。

### Phase 2: コードベース調査

以下を調査して既存システムとの整合性を確認:

1. **既存スキーマ**: `frontend/packages/backend/amplify/data/resource.ts`（`a.schema`）
2. **既存の認可ルール**: `authorization((allow) => [...])` のパターン（`allow.owner()` / `allow.groups()` / `allow.authenticated()`）
3. **既存FSD構造**: `frontend/apps/{web,mobile}/src/` の entities/features/widgets
4. **既存API**: `frontend/packages/backend/amplify/functions/`、必要なら `backend-py/apps/api/src/api/controller/`
5. **既存i18nキー**: `frontend/apps/web/src/shared/config/i18n/messages/`

### Phase 3: テンプレート読み込みと記入

`${CLAUDE_SKILL_DIR}/references/` にある8つのテンプレートを読み込み、調査結果と要件に基づいて記入する。

### Phase 4: 出力

`docs/designs/$ARGUMENTS/` に以下の8ファイルを出力:

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `README.md` | 概要・動機・ゴール/ノンゴール・目次 |
| 2 | `architecture.md` | システム構成・FSD構造・データフロー |
| 3 | `data-model.md` | ER図・`a.schema` 定義・認可ルール・インデックス |
| 4 | `api.md` | API設計・Amplify Data first 判定・エンドポイント |
| 5 | `ui-ux.md` | 画面一覧・コンポーネント設計・i18n |
| 6 | `security.md` | 認証・認可（`authorization`）・データ分類 |
| 7 | `testing.md` | TDD計画・Storybook・E2E |
| 8 | `rollout.md` | 実装フェーズ・リスク・代替案 |

## プロジェクトアーキテクチャ参照テーブル

各セクションで参照すべき技術とドキュメント:

| セクション | 技術スタック | 参照ルール/スキル |
|-----------|-------------|------------------|
| Frontend (Web) | Next.js 16, React 19, shadcn/ui, TailwindCSS 4 | `.claude/rules/frontend.md`, `.claude/skills/fsd/` |
| Frontend (Mobile) | Expo 57, React Native 0.86, gluestack-ui v5, NativeWind 5 | `.claude/rules/frontend.md`, `.claude/rules/mobile-uiux.md` |
| Frontend (Desktop) | Tauri v2 + Vite + React | `.claude/skills/tauri/` |
| State | TanStack Query v5 (server), Zustand (global) | `.claude/skills/tanstack-query/` |
| i18n | next-intl (en, ja) | `.claude/skills/i18n/` |
| Data / API | AWS AppSync + DynamoDB（Amplify Data, `a.schema`） | `.claude/rules/data-modeling.md`, `.claude/skills/amplify-gen2/` |
| Auth | Amazon Cognito（Amplify Auth。`otpLogin: true` で password + Email OTP） | `.claude/rules/auth.md` |
| Storage | Amazon S3（Amplify Storage） | `.claude/rules/storage-images.md` |
| Backend (既定) | **TypeScript の Amplify Function**（Node `defineFunction`） | `.claude/rules/backend-architecture.md` |
| Backend (escalation) | FastAPI on Lambda (Python) | `.claude/rules/backend-py.md` |
| 生成 AI | Amazon Bedrock（LangChain 経由）/ AgentCore | `.claude/rules/generative-ai.md` |
| UI Testing | Storybook 10 | `.claude/skills/storybook/`, `.claude/rules/ui-testing.md` |
| Unit Testing | Vitest (Frontend), pytest (Backend) | `.claude/rules/tdd.md` |
| E2E | Maestro（`e2e` / `e2e-web` / `e2e-mobile`） | `.claude/skills/maestro/` |

## 認証の設計で先に決めること（Cognito は後から変えられない）

認証基盤は **Amazon Cognito（Amplify Auth）で固定**（`.claude/rules/aws-first.md`）。
設計書で決めるのは基盤選択ではなく、**初回デプロイ後に変更できない項目**である。

### 1. サインイン方式（`loginWith`）— **immutable**

初回デプロイ後に変更するには **User Pool の作り直し（＝全ユーザー移行）**が要る。
本ボイラープレートの既定は `email: { otpLogin: true }` で、この 1 行で
**「メール + パスワード」と「Email OTP」の両方**が first factor として有効になる。

- **モバイルアプリを出す（出す予定がある）なら、メール + パスワードは必須**
  （OTP のみは App Store 2.1(a) でリジェクトされる。`.claude/rules/auth.md` §0）
- **MFA とパスワードレス（OTP / passkey）は Cognito の制約で併用不可**

### 2. ソーシャル / 外部 IdP を使うか

Apple でサインインの提供義務など別要件が絡む。**後から足すと既存ユーザーの
アカウント連携が必要**になるので、設計時に決めて `security.md` に書く。

### 3. マルチテナントの境界をどう表現するか

DynamoDB には RLS が無い。境界は **`a.schema` の `authorization` ルール**
（`allow.owner()` / `allow.groups()`）と**パーティションキーの設計**で作る。
アプリ層の `if` で代替してはならない。認可条件に使う属性は
**インデックスのキーに含める**（`.claude/rules/data-modeling.md`）。

### 判断プロセス

1. 要件を列挙する
2. 上の 1〜3 を**設計書の時点で確定**する（後から変えると移行コストが跳ね上がる）
3. `security.md` に判断理由を明記する

## 品質チェックリスト

設計書出力前に以下を確認:

### データモデル（`a.schema`）
- [ ] 全モデルに `authorization((allow) => [...])` が設定されている（**未設定は誰も読めない / 誰でも読める、のどちらかになる**）
- [ ] 日時は `a.datetime()`（`AWSDateTime` = ISO 8601 / TZ オフセット必須。`.claude/rules/datetime.md`）
- [ ] enum は `a.enum([...])` で定義
- [ ] **一覧のアクセスパターンを先に列挙**し、それぞれに `secondaryIndexes` の
      パーティションキー / ソートキーが対応している（`filter` 頼みになっていない）
- [ ] 並び順がソートキーで決まる設計になっている（クライアント側 sort をしない）
- [ ] 認可条件に使う属性がインデックスのキーに含まれている
- [ ] **破壊的変更の有無を明記**（フィールドの削除・型変更・必須化は本番でデータ消失。
      `.claude/rules/data-modeling.md`。本番反映は必ずユーザー承認）

### DynamoDB 設計で先に決めること

| 決めること | なぜ設計時か |
|---|---|
| **アクセスパターンの一覧** | DynamoDB は「後からクエリを足す」ができない。インデックスは事前設計 |
| **パーティションキーの選び方** | ホットパーティションは本番でしか顕在化しない |
| **一覧のページング UI**（もっと見る / 無限スクロール） | `nextToken` しか無く、**ページ番号 UI と総件数は DynamoDB 単体では作れない**（`.claude/rules/list-pagination.md` §2.4） |
| **リレーショナルが本質的に要るか** | 強整合な JOIN / OFFSET が要るなら Aurora（Amplify Data SQL）。後から移すのは高い |
| **PII をどのモデルに置くか** | 認可の単位（owner / group）とパーティションの単位に直結する |

### API
- [ ] **Amplify Data first 判定**が行われている（`a.schema` + `authorization` > TS の `defineFunction` > backend-py）
- [ ] Function を足すなら「なぜ Amplify Data だけでは足りないか」の理由が明記
- [ ] backend-py を使うなら **escalation トリガー**（LLM / 長時間 / Python 固有 / 既存資産）のどれに該当するか明記（`.claude/rules/backend-architecture.md`）
- [ ] 一覧 API は `limit` を明示し、**終端判定が `nextToken`** になっている

### Frontend
- [ ] FSDレイヤー配置が適切（shared/entities/features/widgets/views）
- [ ] i18nキーが en/ja 両方で定義
- [ ] コンポーネントに Storybook ストーリーが計画されている

### セキュリティ
- [ ] データ分類（public/internal/confidential/restricted）が完了
- [ ] 認証基盤の選択理由が明記
- [ ] マルチテナント境界が `a.schema` の `authorization` で強制されている（アプリ層の `if` ではない）
- [ ] メール変更を扱うなら `AttributesRequireVerificationBeforeUpdate: ['email']` が前提に入っている

### テスト
- [ ] ビジネスロジック（model/api/lib）にTDD計画
- [ ] UIコンポーネントにStorybook計画（単体テスト不要）
- [ ] **認可ルールの検証計画**がある（`ampx sandbox` に対する統合テスト or Maestro の E2E。
      `a.schema` の `authorization` は単体テストでは検証できない）

### 自動生成ファイル
- [ ] 自動生成ファイルを直接編集していないか（`.claude/rules/auto-generated.md` 参照）
- [ ] 型変更が必要な場合、`amplify/data/resource.ts` を編集して `sandbox` で反映しているか
      （`Schema` 型は `a.schema()` からの型推論なので生成コマンドは不要）
- [ ] `amplify_outputs.json` をコミットしていないか（環境固有の生成物）

## 条件付きセクションのルール

不要なセクションは削除せず、以下の形式で「対象外」を明示する:

```markdown
## Backend Python API

N/A -- この機能では Backend Python は使用しない（Amplify Data first 判定により
`a.schema` + `authorization` で完結し、escalation トリガーにも該当しない）
```

**理由**: レビュアーがスコープ検討済みであることを確認でき、意図的な除外と記載漏れを区別できるため。

## 記述ガイドライン

1. **日本語で記述**: 技術用語は英語OK
2. **Mermaid図を活用**: ER図、シーケンス図、コンポーネント図
3. **コード例はプロジェクトのパターンに準拠**: 実際の `amplify/data/resource.ts` のスタイルを踏襲
4. **トレードオフを明記**: 設計判断の理由と代替案
5. **各ファイルは独立して読める**: 他ファイルへのリンクは含めるが依存しない
6. **非ゴールを明確に**: やらないことを明示する（Google Design Doc スタイル）
7. **不要セクションは N/A 表記**: セクションを削除せず「N/A -- {理由}」と記載

## テンプレート

各テンプレートの詳細は以下のファイルを参照:

- [overview-template.md](references/overview-template.md) - 概要
- [architecture-template.md](references/architecture-template.md) - アーキテクチャ
- [data-model-template.md](references/data-model-template.md) - データモデル
- [api-template.md](references/api-template.md) - API設計
- [ui-ux-template.md](references/ui-ux-template.md) - UI/UX設計
- [security-template.md](references/security-template.md) - セキュリティ
- [testing-template.md](references/testing-template.md) - テスト計画
- [rollout-template.md](references/rollout-template.md) - ロールアウト計画
