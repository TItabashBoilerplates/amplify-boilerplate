---
name: maestro
description: Maestro E2Eテストフレームワークガイダンス。フローファイル作成、Cognito Email OTP 認証テスト、外部テストメールボックス連携、Web/Mobileテストについての質問に使用。E2Eテストの実装支援を提供。
---

# Maestro E2E Testing スキル

このプロジェクトは **Maestro** を使用して Web (Next.js) と Mobile (Expo) の E2E テストを実行します。

本ドキュメントでは、Maestro を使った E2E テストの **推奨パターン** と **ベストプラクティス** を解説します。

## 構成

| 項目 | 場所 |
|------|------|
| Maestro 設定 | `.maestro/config.yaml` |
| 環境変数 | `.maestro/.env` |
| OTP 抽出スクリプト | `.maestro/scripts/get-otp-from-email.js` |
| テストユーザー作成 | `.maestro/scripts/setup-test-user.js` |
| テストユーザー削除 | `.maestro/scripts/cleanup-test-user.js` |
| Web テスト | `.maestro/web/` |
| Mobile テスト | `.maestro/mobile/` |
| テスト結果 | `e2e-results/maestro/` |

> **重要 — ローカルメールシンクは無い**: 旧スタックの Mailpit / Inbucket は撤去済み。Cognito は
> SES 経由で実メールに OTP を送るため、ローカルにメール受信箱は立たない。OTP を伴う E2E は
> 次のいずれかが必要:
> 1. **外部テストメールボックス**（Mailosaur / MailSlurp、または SES → S3 受信を読む）を
>    `get-otp-from-email.js` から API で参照する、もしくは
> 2. **固定の dev-pool テストユーザー**（OTP を踏まないか既知のコードで通せる検証用ユーザー）を使う。
>
> そのため `.maestro/web/auth/login-flow.yaml` は現状 **`wip` プレースホルダー**（実行対象から除外）。
> 付随する `setup-test-user.js` / `get-otp-from-email.js` / `cleanup-test-user.js` も雛形で、
> 上記のどちらかを選んで実装したうえで `wip` タグを外す。

## コマンド

すべて devenv の **scripts** (PATH 直結)。Makefile は **deprecated**（削除済み）。

```bash
# 全 E2E テスト実行
e2e

# Web テストのみ
e2e-web

# Mobile テストのみ
e2e-mobile
```

## ディレクトリ構造

```
.maestro/
├── config.yaml                    # Workspace 設定
├── .env                           # 環境変数（COGNITO_USER_POOL_ID / テストメールボックス API key など）
├── scripts/
│   ├── get-otp-from-email.js     # OTP 抽出ヘルパー（外部テストメールボックス API）
│   ├── setup-test-user.js        # テストユーザー作成（Cognito dev-pool）
│   └── cleanup-test-user.js      # テストユーザー削除
├── web/
│   ├── auth/
│   │   └── login-flow.yaml       # Web Cognito OTP 認証フロー（wip プレースホルダー）
│   └── smoke/
│       └── home-page.yaml        # Web スモークテスト
└── mobile/
    ├── auth/
    │   └── login-flow.yaml       # Mobile 認証（テンプレート）
    └── smoke/
        └── home-screen.yaml      # Mobile スモークテスト
```

## フローファイルの書き方

### 基本構造

```yaml
# メタデータ
appId: com.example.app
name: "Flow Name"
tags:
  - auth
  - e2e

env:
  TEST_MAILBOX_API: "https://api.mailosaur.com"
  TEST_EMAIL: "test@example.com"

---
# テストステップ
- launchApp
- tapOn: "Element Text"
- inputText: "input value"
- assertVisible: "Expected Text"
```

### タグ規則

| タグ | 用途 |
|------|------|
| `smoke` | 基本動作確認テスト |
| `auth` | 認証関連テスト |
| `e2e` | エンドツーエンドテスト |
| `web` | Web アプリ専用 |
| `mobile` | Mobile アプリ専用 |
| `wip` | 作業中（除外される） |
| `skip` | スキップ対象 |

## OTP 認証テスト（Cognito Email OTP）

Cognito の passwordless Email OTP は実メール（SES）に送られる。**ローカルメールシンクは無い**ため、
OTP を取得するには **外部テストメールボックス**（Mailosaur / MailSlurp、または SES → S3 受信を読む）の
API を `get-otp-from-email.js` から叩く。各サービスで API は異なるので、選んだサービスに合わせて
スクリプトを実装する（下記は Mailosaur を例にした概形）。

### get-otp-from-email.js の使用（外部メールボックス）

```yaml
# OTP 送信後、メール到着を待って OTP を取得
- runScript:
    file: ../../scripts/get-otp-from-email.js
    env:
      TEST_MAILBOX_API: ${TEST_MAILBOX_API}
      TEST_MAILBOX_API_KEY: ${TEST_MAILBOX_API_KEY}
      TEST_MAILBOX_SERVER_ID: ${TEST_MAILBOX_SERVER_ID}
      TEST_EMAIL: ${TEST_EMAIL}
      WAIT_FOR_EMAIL: "true"
      MAX_RETRIES: "15"

# 取得した OTP を入力
- inputText: ${output.otpCode}
```

### 環境変数

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `TEST_MAILBOX_API` | テストメールボックスの API エンドポイント | （サービス依存） |
| `TEST_MAILBOX_API_KEY` | テストメールボックスの API キー | （秘匿） |
| `WAIT_FOR_EMAIL` | メール到着を待機 | `false` |
| `MAX_RETRIES` | 最大リトライ回数 | `10` |

> **Note**: 外部メールボックスはクラウドサービスなので、Web / iOS / Android のいずれからも同じ
> HTTPS エンドポイントにアクセスする（旧 Mailpit のような `10.0.2.2` 書き換えは不要）。

### 代替: 固定 dev-pool テストユーザー

外部メールボックスを使わない場合は、検証用の **固定 dev-pool テストユーザー**（OTP を踏まずに
通せる、または既知のコードで通せるユーザー）を用意して OTP 取得をスキップする。どちらの方式でも、
認証フローが完成するまで `.maestro/web/auth/login-flow.yaml` は `wip` タグで除外しておく。

## テストデータ管理

### 動的テストユーザー作成（Cognito dev-pool）

開発用 Cognito User Pool（dev-pool）に対し、AWS SDK / `aws cognito-idp` Admin API を使って
テストごとにユニークなユーザーを作成・削除する（`adminCreateUser` / `adminDeleteUser`）。

```yaml
# onFlowStart/onFlowComplete hooks を使用
appId: com.example.web
jsEngine: graaljs  # ES2022 サポート

onFlowStart:
  - runScript:
      file: ../../scripts/setup-test-user.js
      env:
        COGNITO_USER_POOL_ID: ${COGNITO_USER_POOL_ID}
        AWS_REGION: ${AWS_REGION}

onFlowComplete:
  - runScript:
      file: ../../scripts/cleanup-test-user.js
      env:
        COGNITO_USER_POOL_ID: ${COGNITO_USER_POOL_ID}
        AWS_REGION: ${AWS_REGION}
        USERNAME: ${output.username}
```

### setup-test-user.js 出力

| 変数 | 説明 |
|------|------|
| `output.testEmail` | 作成したユーザーのメールアドレス |
| `output.username` | Cognito ユーザー名 / sub |
| `output.idToken` | Cognito ID トークン（API 呼び出し用、取得できる場合） |

### 使用例

```yaml
---
# テストユーザーのメールアドレスを使用
- tapOn:
    id: "email"
- inputText: ${output.testEmail}

# 認証済みAPIリクエスト（Cognito ID トークンを Bearer で送る）
- runScript:
    file: ../../scripts/api-request.js
    env:
      ID_TOKEN: ${output.idToken}
```

### 環境変数設定

`.maestro/.env` に Cognito / テストメールボックス接続情報を設定:

```bash
# .maestro/.env
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx   # dev-pool（amplify_outputs.json から）
AWS_REGION=ap-northeast-1
TEST_MAILBOX_API=https://api.mailosaur.com
TEST_MAILBOX_API_KEY=...                         # 外部テストメールボックスの API キー
```

> **Note**: `COGNITO_USER_POOL_ID` は `frontend/amplify_outputs.json` から取得。Cognito Admin API
> 操作には AWS 認証情報（プロファイル）が必要。

### クリーンアップの仕組み

- `onFlowComplete` はテスト成功・失敗に関わらず実行される
- `cleanup-test-user.js` は `USERNAME` が未指定の場合スキップ
- クリーンアップ失敗してもテスト自体は失敗しない

## Web テストフロー例

以下は Cognito Email OTP 認証フローの参考実装パターンです。OTP 取得は外部テストメールボックス
（`get-otp-from-email.js`）を前提とし、認証フローが完成するまで `wip` タグで除外します。

### 認証フロー

```yaml
appId: com.example.web
name: "Web Cognito OTP Login Flow"
tags:
  - auth
  - web
  - e2e
  - wip  # 外部メールボックス or dev-pool ユーザー実装後に削除

env:
  TEST_MAILBOX_API: "https://api.mailosaur.com"
  TEST_EMAIL: "testuser@example.com"

---
# ログインページへ移動
- launchApp:
    arguments:
      url: "http://localhost:3000/en/login"

# メール入力
- tapOn:
    id: "email"
- inputText: ${TEST_EMAIL}

# OTP 送信（Cognito signIn USER_AUTH + EMAIL_OTP）
- tapOn: "Send One-Time Password"

# 成功メッセージ確認
- assertVisible: "Check Your Email"

# OTP 取得（外部テストメールボックス）
- runScript:
    file: ../../scripts/get-otp-from-email.js
    env:
      TEST_MAILBOX_API: ${TEST_MAILBOX_API}
      TEST_MAILBOX_API_KEY: ${TEST_MAILBOX_API_KEY}
      TEST_EMAIL: ${TEST_EMAIL}
      WAIT_FOR_EMAIL: "true"

# Verify ページへ移動
- openLink: "http://localhost:3000/en/verify?email=${TEST_EMAIL}"

# OTP 入力
- tapOn:
    id: "token"
- inputText: ${output.otpCode}

# 検証
- tapOn: "Verify Code"

# ダッシュボード確認
- assertVisible: "Dashboard"
```

## Mobile テストフロー

以下は Mobile 認証フローの参考実装パターンです。
未実装の機能には `wip` タグを付けて除外できます。

```yaml
appId: ${APP_ID}
name: "Mobile OTP Login Flow"
tags:
  - auth
  - mobile
  - wip  # 実装後に削除

env:
  # 外部テストメールボックス（クラウド HTTPS なので Android でも同じ URL）
  TEST_MAILBOX_API: "https://api.mailosaur.com"
  TEST_EMAIL: "testuser@example.com"

---
- launchApp:
    clearState: true
    permissions:
      all: allow

# TODO: 認証画面実装後にコメント解除
# - tapOn:
#     id: "email-input"
# - inputText: ${TEST_EMAIL}
# ...
```

## 要素の特定方法

### 優先順位

1. **id**: 最も安定（`id: "email"`）
2. **accessibilityLabel**: アクセシビリティラベル
3. **text**: 表示テキスト（`tapOn: "Send One-Time Password"`）
4. **index**: 最後の手段

### 例

```yaml
# ID で特定（推奨）
- tapOn:
    id: "submit-button"

# テキストで特定
- tapOn: "Sign In"

# 複合条件
- tapOn:
    text: "Submit"
    index: 0
```

## スクリーンショット

```yaml
# スクリーンショット取得
- takeScreenshot: screenshot-name

# 結果は e2e-results/maestro/ に保存
```

## Workspace 設定

### config.yaml

```yaml
flows:
  - "web/**/*.yaml"
  - "mobile/**/*.yaml"

includeTags:
  - smoke
  - auth
  - e2e

excludeTags:
  - skip
  - wip

executionOrder:
  continueOnFailure: false

testOutputDir: ../e2e-results/maestro

platform:
  ios:
    disableAnimations: true
  android:
    disableAnimations: true
```

## トラブルシューティング

### OTP が取得できない

1. Amplify backend sandbox が起動しているか確認: `sandbox`（= `ampx sandbox`）。AWS 認証情報も確認
2. 外部テストメールボックスの管理画面で OTP メールが届いているか確認（`TEST_MAILBOX_API_KEY` / server ID が正しいか）
3. `MAX_RETRIES` を増やす（SES 経由の到達は数秒かかることがある）
4. Cognito の SES 設定（送信元・サンドボックス制限）を確認

### 認証フローが実行されない

`.maestro/web/auth/login-flow.yaml` は既定で `wip` タグが付き除外される。外部メールボックス
または dev-pool テストユーザーを実装したら `wip` タグを外す。

### テストがタイムアウトする

```yaml
# 待機時間を延長
- extendedWaitUntil:
    visible: "Expected Element"
    timeout: 30000
```

### 要素が見つからない

```yaml
# デバッグ用スクリーンショット
- takeScreenshot: debug-state

# 画面階層を確認
- runFlow:
    file: debug-flow.yaml
```

## ベストプラクティス

### テスト前にデータをクリア

```yaml
# メールボックスをクリア（外部テストメールボックスの古いメッセージを削除）
- runScript:
    file: ../../scripts/get-otp-from-email.js
    env:
      TEST_MAILBOX_API: ${TEST_MAILBOX_API}
      TEST_MAILBOX_API_KEY: ${TEST_MAILBOX_API_KEY}
      # WAIT_FOR_EMAIL を指定しないとクリアのみ
```

### 明示的な待機

```yaml
# 要素が表示されるまで待機
- assertVisible: "Expected Text"

# 時間指定で待機（非推奨、最後の手段）
- waitForAnimationToEnd
```

### 環境変数の活用

```yaml
env:
  BASE_URL: ${BASE_URL:-http://localhost:3000}
  TEST_EMAIL: ${TEST_EMAIL:-test@example.com}
```

## チェックリスト

新しいテストフローを追加する前に確認:

### 必須

- [ ] 適切なタグを設定している（`smoke`, `auth`, `e2e`, `web`/`mobile`）
- [ ] 要素特定に `id` を優先使用している
- [ ] OTP テストでは `get-otp-from-email.js`（外部テストメールボックス）を使用している
- [ ] OTP を伴う auth フローは未完成の間 `wip` タグで除外している

### 推奨

- [ ] テスト開始時にメールボックスをクリアしている
- [ ] 各ステップで `assertVisible` を使用している
- [ ] デバッグ用にスクリーンショットを取得している
- [ ] 作業中のテストには `wip` タグを付けている

## 参考リンク

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro CLI Reference](https://maestro.mobile.dev/reference/cli)
- [Amazon Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [Mailosaur API](https://mailosaur.com/docs/api/) / [MailSlurp API](https://docs.mailslurp.com/)
