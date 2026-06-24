---
name: maestro
description: Maestro E2Eテストフレームワークガイダンス。フローファイル作成、OTP認証テスト、Mailpit連携、Web/Mobileテストについての質問に使用。E2Eテストの実装支援を提供。
---

# Maestro E2E Testing スキル

このプロジェクトは **Maestro** を使用して Web (Next.js) と Mobile (Expo) の E2E テストを実行します。

本ドキュメントでは、Maestro を使った E2E テストの **推奨パターン** と **ベストプラクティス** を解説します。

## 構成

| 項目 | 場所 |
|------|------|
| Maestro 設定 | `.maestro/config.yaml` |
| 環境変数 | `.maestro/.env` |
| OTP 抽出スクリプト | `.maestro/scripts/get-otp-from-mailpit.js` |
| テストユーザー作成 | `.maestro/scripts/setup-test-user.js` |
| テストユーザー削除 | `.maestro/scripts/cleanup-test-user.js` |
| Web テスト | `.maestro/web/` |
| Mobile テスト | `.maestro/mobile/` |
| テスト結果 | `e2e-results/maestro/` |

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
├── .env                           # 環境変数（SUPABASE_SERVICE_ROLE_KEY など）
├── scripts/
│   ├── get-otp-from-mailpit.js   # OTP 抽出ヘルパー
│   ├── setup-test-user.js        # テストユーザー作成
│   └── cleanup-test-user.js      # テストユーザー削除
├── web/
│   ├── auth/
│   │   └── login-flow.yaml       # Web OTP 認証フロー
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
  MAILPIT_URL: "http://localhost:54324"
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

## OTP 認証テスト

### Mailpit API

Supabase ローカル環境では Inbucket（Mailpit 互換）がメールサーバーとして動作。

| エンドポイント | 用途 |
|---------------|------|
| `GET /api/v1/messages` | メッセージ一覧取得 |
| `GET /api/v1/message/{id}` | メッセージ詳細取得 |
| `DELETE /api/v1/message/{id}` | メッセージ削除 |

### OTP 抽出スクリプトの使用

```yaml
# メールボックスをクリア（テスト開始前）
- runScript:
    file: ../../scripts/get-otp-from-mailpit.js
    env:
      MAILPIT_URL: ${MAILPIT_URL}

# OTP 送信後、メール到着を待って OTP を取得
- runScript:
    file: ../../scripts/get-otp-from-mailpit.js
    env:
      MAILPIT_URL: ${MAILPIT_URL}
      WAIT_FOR_EMAIL: "true"
      MAX_RETRIES: "15"

# 取得した OTP を入力
- inputText: ${output.otpCode}
```

### 環境変数

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `MAILPIT_URL` | Mailpit API URL | `http://localhost:54324` |
| `WAIT_FOR_EMAIL` | メール到着を待機 | `false` |
| `MAX_RETRIES` | 最大リトライ回数 | `10` |

### プラットフォーム別 URL

| Platform | MAILPIT_URL |
|----------|-------------|
| Web | `http://localhost:54324` |
| iOS Simulator | `http://localhost:54324` |
| Android Emulator | `http://10.0.2.2:54324` |

> **Note**: Android エミュレータは独自の仮想ネットワーク内で動作するため、ホストの `localhost` にアクセスするには `10.0.2.2` を使用。

## テストデータ管理

### 動的テストユーザー作成

Supabase Auth Admin API を使用してテストごとにユニークなユーザーを作成・削除します。

```yaml
# onFlowStart/onFlowComplete hooks を使用
appId: com.example.web
jsEngine: graaljs  # ES2022 サポート

onFlowStart:
  - runScript:
      file: ../../scripts/setup-test-user.js
      env:
        SUPABASE_URL: ${SUPABASE_URL}
        SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}

onFlowComplete:
  - runScript:
      file: ../../scripts/cleanup-test-user.js
      env:
        SUPABASE_URL: ${SUPABASE_URL}
        SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
        USER_ID: ${output.userId}
```

### setup-test-user.js 出力

| 変数 | 説明 |
|------|------|
| `output.testEmail` | 作成したユーザーのメールアドレス |
| `output.testPassword` | パスワード |
| `output.userId` | ユーザー UUID |
| `output.accessToken` | アクセストークン |

### 使用例

```yaml
---
# テストユーザーのメールアドレスを使用
- tapOn:
    id: "email"
- inputText: ${output.testEmail}

# 認証済みAPIリクエスト
- runScript:
    file: ../../scripts/api-request.js
    env:
      ACCESS_TOKEN: ${output.accessToken}
```

### 環境変数設定

`.maestro/.env` に Supabase 接続情報を設定:

```bash
# .maestro/.env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
MAILPIT_URL=http://localhost:54324
```

> **Note**: `SUPABASE_SERVICE_ROLE_KEY` は `env/backend/.env.local` から取得。

### クリーンアップの仕組み

- `onFlowComplete` はテスト成功・失敗に関わらず実行される
- `cleanup-test-user.js` は `USER_ID` が未指定の場合スキップ
- クリーンアップ失敗してもテスト自体は失敗しない

## Web テストフロー例

以下は OTP 認証フローの参考実装パターンです。

### 認証フロー

```yaml
appId: com.example.web
name: "Web OTP Login Flow"
tags:
  - auth
  - web
  - e2e

env:
  MAILPIT_URL: "http://localhost:54324"
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

# OTP 送信
- tapOn: "Send One-Time Password"

# 成功メッセージ確認
- assertVisible: "Check Your Email"

# OTP 取得
- runScript:
    file: ../../scripts/get-otp-from-mailpit.js
    env:
      MAILPIT_URL: ${MAILPIT_URL}
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
  # Android エミュレータ用
  MAILPIT_URL: "http://10.0.2.2:54324"
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

1. Supabase・backend-py が起動しているか確認: `devenv up`
2. Mailpit UI でメールを確認: `http://localhost:54324`
3. `MAX_RETRIES` を増やす
4. メールボックス名（@ より前）が正しいか確認

### Android で接続できない

`MAILPIT_URL` を `http://10.0.2.2:54324` に変更。

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
# メールボックスをクリア
- runScript:
    file: ../../scripts/get-otp-from-mailpit.js
    env:
      MAILPIT_URL: ${MAILPIT_URL}
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
- [ ] OTP テストでは `get-otp-from-mailpit.js` を使用している
- [ ] Android テストでは `MAILPIT_URL` が `10.0.2.2` になっている

### 推奨

- [ ] テスト開始時にメールボックスをクリアしている
- [ ] 各ステップで `assertVisible` を使用している
- [ ] デバッグ用にスクリーンショットを取得している
- [ ] 作業中のテストには `wip` タグを付けている

## 参考リンク

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro CLI Reference](https://maestro.mobile.dev/reference/cli)
- [Inbucket API](https://github.com/inbucket/inbucket/wiki/REST-API)
