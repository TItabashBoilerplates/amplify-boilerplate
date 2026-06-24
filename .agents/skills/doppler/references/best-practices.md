# Doppler ベストプラクティス（公式準拠）

Doppler 公式ドキュメントに基づくベストプラクティス集。本リポジトリ固有の統合方法は
`SKILL.md`、完全移行手順は `migration-plan.md` を参照。

目次:
1. ワークプレイス / プロジェクト / 環境（config）の構造
2. Branch config と Personal config
3. Config Inheritance（継承）
4. トークンの種類と使い分け（最重要・セキュリティ）
5. CI/CD
6. 命名規約
7. シークレットのローテーション
8. アクセス制御（RBAC）
9. 監査ログ
10. CLI fallback ファイル
11. 何を Doppler に置く / 置かないか

## 1. 構造: Workplace → Project → Environment(config) → Secret

- **Workplace**: 組織アカウント（1 つ）。
- **Project**: アプリ / リポジトリ単位。
- **Environment / root config**: デプロイ環境。**既定で `dev` / `stg` / `prd` の 3 root config**。
  各 root config がその環境の secrets マスターを保持する。
- root config の secret を更新すると、そこから派生した branch config に自動反映される。

## 2. Branch config と Personal config

- **Branch config**: root config から派生した枝。用途例: クラウド別（AWS/GCP）デプロイ、
  未リリース機能用の追加 secret、同僚との一時共有、root への昇格（promote）。
- **Personal config**: dev 環境で **write 権限を持つ各ユーザーに自動付与される専用ブランチ**
  （例 `dev_personal`）。本人だけがアクセス可。**ローカル開発の既定はこれ**にするのが公式推奨。
  → 本リポジトリでは local profile を personal config に紐付ける（`doppler.yaml` の
  `config: dev_personal`）。

## 3. Config Inheritance（継承）

- 親 config の secrets を子 config へ共有できる。子を取得すると親の secrets も含まれる。
- 親を更新すると継承している全子に反映。共通値（例: 共有 API キー）を親に集約し、
  環境差分だけ子で上書きする運用に向く。

## 4. トークンの種類と使い分け（最重要）

| トークン | 権限 | 用途 | 注意 |
|---|---|---|---|
| **Service Token** | **read-only が既定**・**単一 project+config にスコープ** | 本番 / CI/CD のランタイム注入 | 最小権限。`--max-age` で失効可 |
| Service Account (token) | より広いアイデンティティ管理・OIDC 連携可 | インフラ統合・複数 config 横断 | 用途が広い分慎重に |
| CLI Token / Personal Token | **作成者と同じ write 権限** | ローカルの対話利用のみ | **本番/CI で使用厳禁**（write 権限が漏れる） |

公式の核心:
- **「CLI / Personal トークンは live 環境で絶対に使うな（作成者と同じ write 権限を持つ）」**
- Service Token は **read-only 既定 + 単一 config スコープ** = 最小権限。本番・CI はこれ。

作成:
```bash
doppler configs tokens create <token-name> --plain            # read-only, 単一 config
doppler configs tokens create ci --plain --max-age 24h        # 失効付き
```

## 5. CI/CD

- ユーザー認証（`doppler login`）は CI で使わない。**Service Token を `DOPPLER_TOKEN` に注入**。
  ```bash
  # 例（Docker）
  docker run -e DOPPLER_TOKEN='dp.st.prd.xxxx' your-app
  # 例（一般）
  DOPPLER_TOKEN='dp.st.dev.xxxx' doppler run -- <command>
  ```
- secrets ローテーション時に再デプロイをトリガーする change webhook を設定すると堅牢。
- 可能ならクラウド（AWS/GCP/Azure Secrets Manager）への sync 連携も併用しレジリエンスを上げる。

## 6. 命名規約

- **config / branch 名**: ハイフン区切り・全小文字（例 `dev_personal` は既定例外、機能ブランチは
  `feature-x` や `alice-feature-x`）。
- **secret キー**: サービス・環境・用途が一目で分かる prefix を付ける
  （例 `STRIPE_API_KEY`, `MONGO_DB_URI`）。環境差は config で分けるのが基本で、キー名に
  環境を埋め込みすぎない。

## 7. ローテーション

- スケジュールを決めて定期ローテーション。漏洩時の被害と権限クリープを抑える。
- 可能なものは Doppler の自動ローテーション（rotated secrets）を使う。

## 8. アクセス制御（RBAC）

- 役割で最小権限を付与。**dev は Collaborator、prd は Viewer か no-access** が目安。
- 本番 config への write は限定したメンバーのみ。

## 9. 監査ログ

- Doppler の audit log を**毎週**確認する（最も強力なセキュリティ機能の 1 つ）。

## 10. CLI fallback ファイル

- `doppler run` は既定で**暗号化された** fallback ファイルをローカルに書き出し、Doppler API
  が不達でも直近値で動作継続できる。
- 平文を残したくない / 純粋な取得だけしたい場合は `--no-file` を使う
  （本リポジトリの devenv ローダは `--no-file` を採用）。

## 11. 何を Doppler に置く / 置かないか（本リポジトリの方針）

| 種類 | 例 | 置き場所 |
|---|---|---|
| **シークレット** | API キー、トークン、DB パスワード、service_role 等 | **Doppler** |
| **非機密の環境変数** | ローカル Supabase URL / backend URL / port / publishable key | **ファイル**（`env/*/.env.local`、コミット可） |

「漏れても害がない設定値」までは Doppler に載せない。オフライン開発の容易さと、
Doppler 障害時の影響範囲を最小化するため。
