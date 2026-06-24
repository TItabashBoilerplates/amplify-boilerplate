# Langfuse Self-Hosting (Docker Compose) 調査レポート

## 調査情報

- **調査日**: 2026-01-20
- **調査者**: spec agent
- **対象**: Langfuse v3 セルフホスティング（Docker Compose）

## バージョン情報

- **現在バージョン**: Langfuse v3（最新）
- **v2 サポート終了**: 2025年Q1（セキュリティアップデートのみ）
- **ClickHouse 要件**: >= 24.3
- **PostgreSQL 要件**: >= 12

## アーキテクチャ概要

Langfuse v3 は以下のコンポーネントで構成される：

### アプリケーションコンテナ

| コンテナ | 役割 |
|----------|------|
| `langfuse-web` | メインWebアプリケーション（UI + API） |
| `langfuse-worker` | 非同期イベント処理ワーカー |

### ストレージコンポーネント

| コンポーネント | 役割 | 必須 |
|---------------|------|------|
| **PostgreSQL** | トランザクションデータ（ユーザー、組織、プロジェクト、データセット、APIキー） | 必須 |
| **ClickHouse** | OLAP分析（トレース、オブザベーション、スコア） | **必須（v3から）** |
| **Redis/Valkey** | キュー + キャッシュ | 必須 |
| **S3/MinIO** | イベント永続化、メディアアップロード、バッチエクスポート | 必須 |

## ClickHouse が必要な理由

v3 から ClickHouse は**必須コンポーネント**となった。

### 背景

- v2 では PostgreSQL のみで動作していたが、大規模顧客でパフォーマンスボトルネックが発生
- LLM 分析データは大きな BLOB を含み、行指向ストレージでは数百万行のスキャンが重い
- ダッシュボードとテーブルフィルタリングが遅くなっていた

### ClickHouse の利点

1. **高スループット書き込み**: 毎秒数百イベントの取り込みに対応
2. **高速分析クエリ**: 数十億行でも低レイテンシ
3. **セルフホスティング向け**: MITライセンスで無料、クラウドベンダー非依存
4. **運用負荷軽減**: Druid と比較してシンプルなアーキテクチャ

## 推奨リソース要件

### Docker Compose（単一VM）

| リソース | 最小要件 | 推奨 |
|----------|----------|------|
| **CPU** | 4 コア | 4+ コア |
| **メモリ** | 16 GiB | 16+ GiB |
| **ストレージ** | 50 GiB | 100 GiB |
| **例（AWS）** | t3.xlarge | t3.xlarge以上 |

### 本番環境（Kubernetes）

| コンポーネント | 推奨設定 |
|---------------|----------|
| Langfuse Web | 2+ インスタンス、各2 CPU / 4GB RAM |
| Langfuse Worker | 2+ インスタンス、各2 CPU / 4GB RAM |
| ClickHouse | 3 レプリカ、`large` リソースプリセット、100Gi+ ストレージ |

## 公式 docker-compose.yml 構成

### サービス構成

```yaml
services:
  langfuse-worker:
    image: langfuse/langfuse-worker:3
    depends_on:
      - postgres
      - minio
      - redis
      - clickhouse
    # 環境変数は langfuse-web と共有

  langfuse-web:
    image: langfuse/langfuse:3
    ports:
      - "3000:3000"
    depends_on:
      - langfuse-worker

  clickhouse:
    image: clickhouse/clickhouse-server
    ports:
      - "127.0.0.1:8123:8123"  # HTTP
      - "127.0.0.1:9000:9000"  # Native
    volumes:
      - clickhouse-data:/var/lib/clickhouse
      - clickhouse-logs:/var/log/clickhouse-server

  minio:
    image: minio/minio
    ports:
      - "9090:9090"  # Console
      - "127.0.0.1:9091:9000"  # API
    volumes:
      - minio-data:/data

  redis:
    image: redis:7
    ports:
      - "127.0.0.1:6379:6379"

  postgres:
    image: postgres:16
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
  clickhouse-data:
  clickhouse-logs:
  minio-data:
```

### ネットワーク設計

- `langfuse-web`（ポート3000）と `minio`（ポート9090）のみ外部アクセス可能
- その他は `127.0.0.1` バインドで外部アクセス不可

## 必須環境変数

### データベース設定

| 変数 | 必須 | 説明 |
|------|------|------|
| `DATABASE_URL` | 必須 | PostgreSQL 接続文字列 |
| `DIRECT_URL` | オプション | コネクションプーリング使用時のマイグレーション用 |

### ClickHouse 設定

| 変数 | 必須 | 説明 |
|------|------|------|
| `CLICKHOUSE_URL` | 必須 | ClickHouse ホスト名 |
| `CLICKHOUSE_MIGRATION_URL` | 必須 | TCPプロトコル用マイグレーションURL |
| `CLICKHOUSE_USER` | 必須 | ユーザー名 |
| `CLICKHOUSE_PASSWORD` | 必須 | パスワード |
| `CLICKHOUSE_DB` | オプション | データベース名（デフォルト: `default`） |

### Redis 設定

| 変数 | 必須 | 説明 |
|------|------|------|
| `REDIS_CONNECTION_STRING` | 必須 | Redis 接続文字列 |
| `REDIS_TLS_ENABLED` | オプション | TLS有効化（v3.28.0+） |

### S3/MinIO 設定

| 変数 | 必須 | 説明 |
|------|------|------|
| `LANGFUSE_S3_EVENT_UPLOAD_BUCKET` | 必須 | イベントアップロード用バケット |
| `LANGFUSE_S3_EVENT_UPLOAD_ENDPOINT` | オプション | カスタムエンドポイント（MinIO用） |
| `LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID` | オプション | アクセスキー |
| `LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY` | オプション | シークレットキー |
| `LANGFUSE_S3_EVENT_UPLOAD_FORCE_PATH_STYLE` | オプション | MinIO互換性用 |

### 認証・セキュリティ

| 変数 | 必須 | 説明 |
|------|------|------|
| `NEXTAUTH_URL` | 必須 | LangfuseデプロイメントURL |
| `NEXTAUTH_SECRET` | 必須 | セッションCookie検証用（256bit以上） |
| `SALT` | 必須 | APIキーハッシュ用ソルト（256bit以上） |
| `ENCRYPTION_KEY` | 必須 | 機密データ暗号化キー（64文字hex） |

## PostgreSQL との連携オプション

### オプション1: Docker Compose 内蔵 PostgreSQL（推奨：開発/テスト）

docker-compose.yml 内の PostgreSQL サービスをそのまま使用。

### オプション2: 既存 Supabase PostgreSQL を使用

**メリット**:
- インフラ統合
- 既存のバックアップ/監視を活用

**設定方法**:

```yaml
# docker-compose.yml から postgres サービスを削除
# 環境変数で外部DBを指定

environment:
  DATABASE_URL: "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

**注意点**:
- Supabase は UTC 設定がデフォルトなので互換性あり
- 専用データベースの作成を推奨（`langfuse` など）
- RLS は Langfuse テーブルには不要
- コネクションプーリング使用時は `DIRECT_URL` も設定

### オプション3: 別途 PostgreSQL を用意（推奨：本番）

Langfuse 専用の PostgreSQL インスタンスを用意。

**理由**:
- 負荷分離
- 独立したスケーリング
- Supabase のリソース競合回避

## セキュリティ設定

### 変更必須項目（`# CHANGEME` マーカー）

1. PostgreSQL パスワード
2. ClickHouse パスワード
3. Redis パスワード
4. MinIO アクセスキー/シークレット
5. `NEXTAUTH_SECRET`
6. `SALT`
7. `ENCRYPTION_KEY`

### シークレット生成方法

```bash
# NEXTAUTH_SECRET / SALT（256bit以上）
openssl rand -base64 32

# ENCRYPTION_KEY（64文字hex）
openssl rand -hex 32
```

### ファイアウォール設定

外部からアクセス可能にすべきポート:
- `:3000` - Langfuse Web UI/API
- `:9090` - MinIO Console（必要な場合のみ）

## 起動手順

```bash
# 1. リポジトリクローン
git clone https://github.com/langfuse/langfuse.git
cd langfuse

# 2. シークレット更新
# docker-compose.yml 内の # CHANGEME 項目を編集

# 3. 起動
docker compose up -d

# 4. 起動確認（2-3分待機）
docker compose logs -f langfuse-web-1
# "Ready" ログが出力されたら完了

# 5. アクセス
open http://localhost:3000
```

## アップグレード手順

```bash
docker compose down
docker compose up --pull always -d
```

## 制限事項

### Docker Compose の制限

- 水平スケーリング非対応（Load Balancer 追加が必要）
- 高可用性なし
- 自動バックアップなし
- 本番環境には非推奨

### 推奨される本番環境

- Kubernetes（Helm Chart）
- AWS/Azure/GCP マネージドサービス
- Railway

## 参考リンク

- [Docker Compose (self-hosted) - Langfuse](https://langfuse.com/self-hosting/deployment/docker-compose)
- [Self-host Langfuse - Overview](https://langfuse.com/self-hosting)
- [Configuration via Environment Variables](https://langfuse.com/self-hosting/configuration)
- [ClickHouse (self-hosted) - Langfuse](https://langfuse.com/self-hosting/deployment/infrastructure/clickhouse)
- [PostgreSQL (self-hosted) - Langfuse](https://langfuse.com/self-hosting/deployment/infrastructure/postgres)
- [Migrate Langfuse v2 to v3](https://langfuse.com/self-hosting/upgrade/upgrade-guides/upgrade-v2-to-v3)
- [GitHub - langfuse/langfuse docker-compose.yml](https://github.com/langfuse/langfuse/blob/main/docker-compose.yml)
- [Langfuse and ClickHouse - ClickHouse Blog](https://clickhouse.com/blog/langfuse-and-clickhouse-a-new-data-stack-for-modern-llm-applications)
