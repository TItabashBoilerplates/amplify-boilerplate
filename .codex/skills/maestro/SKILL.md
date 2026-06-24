---
name: maestro
description: Maestro E2Eテストフレームワークガイダンス。フローファイル作成、OTP認証テスト、Mailpit連携、Web/Mobileテストについての質問に使用。E2Eテストの実装支援を提供。
---

# Maestro E2E Testing スキル

このプロジェクトは **Maestro** を使用して Web (Next.js) と Mobile (Expo) の E2E テストを実行します。

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

### プラットフォーム別 URL

| Platform | MAILPIT_URL |
|----------|-------------|
| Web | `http://localhost:54324` |
| iOS Simulator | `http://localhost:54324` |
| Android Emulator | `http://10.0.2.2:54324` |

> **Note**: Android エミュレータは独自の仮想ネットワーク内で動作するため、ホストの `localhost` にアクセスするには `10.0.2.2` を使用。

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
