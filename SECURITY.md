# Security Policy

## Supported Versions

現在サポートされているバージョン:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

セキュリティ上の脆弱性を発見した場合は、以下の手順に従ってください:

### 報告方法

1. **公開のIssueトラッカーには投稿しないでください**
   - セキュリティの脆弱性は公開されるべきではありません

2. **プライベートな報告**
   - GitHub Security Advisoriesを使用して報告してください
   - または、プロジェクトメンテナーに直接メールで連絡してください

### 報告に含めるべき情報

- 脆弱性の種類（例: SQL injection, XSS, CSRF等）
- 脆弱性の影響を受けるファイル/コンポーネントのパス
- 脆弱性を再現する手順
- 概念実証（Proof of Concept: PoC）コード（可能であれば）
- 潜在的な影響の説明

### レスポンス時間

- 初期応答: 48時間以内
- 修正パッチのリリース: 脆弱性の深刻度に応じて1週間〜1ヶ月以内

## セキュリティのベストプラクティス

### シークレットの管理

- **秘匿値は環境変数に置かず、Amplify secrets（SSM Parameter Store）を使ってください**
  （`ampx sandbox secret set <KEY>` / Amplify コンソールの Secret management）
- **`NEXT_PUBLIC_` / `EXPO_PUBLIC_` は「バンドルに焼き込まれる」という意味です。**
  秘匿値に付けないでください
- `amplify_outputs.json`（環境固有の生成物）をコミットしないでください
- 詳細: `.claude/rules/env-naming.md`

### 認証・認可

- サーバー側の認可判断は `runWithAmplifyServerContext` + `aws-amplify/auth/server` を
  通した結果で行ってください。Client Component が持つ値を根拠にしないでください
- レコード単位の認可は `amplify/data/resource.ts` の `authorization`
  （`allow.owner()` / `allow.groups()`）で宣言してください。アプリ層の `if` で
  代替しないでください
- 認証・セッション・パスワードの保管を自作しないでください（Cognito に任せる）

### データ

- **すべてのモデルに `authorization` を設定してください**（書き忘れは事故に直結します）
- DynamoDB では**列単位の認可ができません**。公開情報と機密情報を同じモデルに
  混ぜないでください（PII は別モデルへ分離）
- `deleteUser()` は Cognito ユーザーしか消しません。**関連データの削除は
  削除フローの一部として明示的に実装**してください

### 依存関係

- 定期的に依存関係を更新してください:
  ```bash
  # Frontend
  cd frontend && pnpm update

  # Backend
  cd backend-py/app && uv lock --upgrade
  ```

- Dependabotによる自動更新を有効にしてください

## 既知の脆弱性

現在、既知の重大な脆弱性はありません。

## セキュリティアップデート

セキュリティ関連のアップデートは、GitHub Releasesとこのファイルで通知されます。
