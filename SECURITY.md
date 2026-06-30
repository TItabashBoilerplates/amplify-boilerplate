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

### 環境変数の管理

- `env/.env.secrets`ファイルを**絶対に**コミットしないでください
- 本番環境では環境変数を安全に管理してください（AWS Secrets Manager, HashiCorp Vault等）

### 認証・認可

- Supabase Auth使用時は`getUser()`を使用し、`getSession()`は避けてください
- JWTトークンを適切に検証してください

### データベース

- RLS（Row Level Security）ポリシーを必ず設定してください
- SQLインジェクション対策として、パラメータ化されたクエリを使用してください

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
