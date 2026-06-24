# OneSignal 調査レポート

## 調査情報

- **調査日**: 2026-01-06
- **調査者**: spec agent

---

## 1. REST API 仕様

### Base URL

```
https://api.onesignal.com
```

### 認証方法（API Key の種類と用途）

| Key 種類 | 用途 | 公開可否 |
|---------|------|---------|
| **App ID** | SDK初期化、API呼び出しで必須（UUID v4形式） | 公開可（フロントエンドで使用可） |
| **App API Key** | REST API リクエスト認証（アプリ単位） | **非公開**（サーバーサイドのみ） |
| **Organization API Key** | アプリ・APIキー管理（組織単位） | **非公開**（管理用途のみ） |
| **Organization ID** | アプリ作成・更新時に必要（UUID v4形式） | 非公開推奨 |

**認証ヘッダー形式**:

```http
Authorization: Key YOUR_APP_API_KEY
```

**セキュリティ考慮事項**:
- API キーはパスワードと同等に扱う
- コードやリポジトリに公開しない
- 最大16キー/アカウント設定可能
- IPアドレス制限（CIDRブロック）設定可能
- キーローテーション機能あり

### 主要エンドポイント

#### プッシュ通知送信 API

**Endpoint**: `POST /notifications`

**Headers**:
```http
Content-Type: application/json
Authorization: Key YOUR_APP_API_KEY
```

**Request Body**:

```json
{
  "app_id": "YOUR_APP_ID",
  "target_channel": "push",
  "included_segments": ["Subscribed Users"],
  "contents": {
    "en": "Hello, world",
    "ja": "こんにちは"
  }
}
```

**ターゲティング方法**（いずれか1つを選択）:

| パラメータ | 説明 | 制限 |
|-----------|------|------|
| `include_aliases` | external_id, onesignal_id, カスタムエイリアスで指定 | 最大20,000件 |
| `included_segments` | 事前定義セグメントで指定 | - |
| `filters` | AND/ORロジックでオーディエンス構築 | 最大200エントリ |

**オプションパラメータ**:

| パラメータ | 説明 |
|-----------|------|
| `send_after` | 配信スケジュール（ISO 8601形式） |
| `delayed_option` | "timezone" or "last-active" でユーザー単位タイミング |
| `delivery_time_of_day` | 一貫した配信時刻設定 |
| `template_id` | 事前定義テンプレートID |

**Response**:

```json
{
  "id": "notification_id"
}
```

#### ユーザー/デバイス登録 API

**Create User**: `POST /users`
**View User**: `GET /users/{id}`
**Update User**: `PUT /users/{id}`
**Delete User**: `DELETE /users/{id}`

### Rate Limits

- 全エンドポイントにレート制限あり
- エンドポイント・リクエストタイプにより異なる
- 詳細は [Rate Limits](https://documentation.onesignal.com/reference/rate-limits) 参照

### エラーハンドリング

**リトライ可能**:
- HTTP 429（Rate Limited）
- HTTP 5xx（Server Errors）
- ネットワークタイムアウト

**リトライ不可**:
- HTTP 4xx（リクエスト修正が必要）

**Idempotency**:
- `idempotency_key` ヘッダー使用推奨
- 最大64文字（英数字）
- 24時間キャッシュ
- デフォルトタイムアウト: 100秒

---

## 2. Web Push / Mobile Push の違い

### Web Push（Next.js / React）

#### インストール

```bash
# Web (React/Next.js)
bun add react-onesignal
```

**パッケージ情報**:
- **パッケージ名**: `react-onesignal`
- **最新バージョン**: 3.4.6（2026年1月時点）
- TypeScript サポート: あり

#### Service Worker 設定

1. `OneSignalSDKWorker.js` をダウンロード
2. `public/` ディレクトリに配置
3. 公開アクセス可能であること

**要件**:
- Content-Type: `application/javascript; charset=utf-8`
- 同一オリジン（CDN/サブドメイン不可）
- 推奨配置: `/push/onesignal/` などサブディレクトリ

#### Next.js App Router 初期化コード

```typescript
// app/providers/OneSignalProvider.tsx
'use client'

import { useEffect } from 'react'
import OneSignal from 'react-onesignal'

export function OneSignalProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      OneSignal.init({
        appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
        serviceWorkerPath: '/onesignal/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/onesignal/' },
        notifyButton: {
          enable: true,
        },
      })
    }
  }, [])

  return null
}
```

**注意事項**:
- `'use client'` ディレクティブ必須
- `useEffect` 内で初期化
- `typeof window !== 'undefined'` ガード
- React.StrictMode で重複初期化エラーが発生する場合あり

---

### Mobile Push（React Native / Expo）

#### インストール

```bash
# Expo managed workflow
npx expo install onesignal-expo-plugin
bun add react-native-onesignal
```

**パッケージ情報**:
- **react-native-onesignal**: 5.2.16（2026年1月時点）
- **onesignal-expo-plugin**: 2.0.3
- Expo SDK 48+ 対応

#### 要件

| プラットフォーム | 要件 |
|-----------------|------|
| Expo | SDK 48+ |
| React Native | 0.71+ |
| iOS | Xcode 14+, iOS 7.0+ |
| Android | Android 7.0+, Google Play Services |
| CocoaPods | 1.16.2+（iOS） |

#### app.json / app.config.js 設定

```json
{
  "expo": {
    "plugins": [
      [
        "onesignal-expo-plugin",
        {
          "mode": "development"
        }
      ]
    ],
    "ios": {
      "bundleIdentifier": "com.example.app",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      },
      "entitlements": {
        "aps-environment": "development",
        "com.apple.security.application-groups": [
          "group.com.example.app.onesignal"
        ]
      }
    },
    "android": {
      "package": "com.example.app"
    }
  }
}
```

**重要**: `onesignal-expo-plugin` は plugins 配列の**最初**に配置

#### 初期化コード

```typescript
// app/_layout.tsx (Expo Router)
import { useEffect } from 'react'
import { OneSignal, LogLevel } from 'react-native-onesignal'

export default function RootLayout() {
  useEffect(() => {
    // デバッグ用
    OneSignal.Debug.setLogLevel(LogLevel.Verbose)

    // 初期化
    OneSignal.initialize(process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID!)

    // 通知許可リクエスト
    OneSignal.Notifications.requestPermission(false)
  }, [])

  return <Slot />
}
```

#### イベントリスナー

```typescript
// プッシュ通知タップ検知
OneSignal.Notifications.addClickListener((event) => {
  console.log('Notification clicked:', event)
})

// フォアグラウンド通知制御
OneSignal.Notifications.addForegroundLifecycleListener((event) => {
  event.notification.display()
})

// 購読状態監視
OneSignal.User.pushSubscription.addObserver((state) => {
  console.log('Push subscription state:', state)
})
```

---

## 3. Supabase Edge Functions での利用パターン

### Deno での HTTP リクエスト方法

**推奨**: OneSignal SDK ではなく、REST API を直接呼び出す

```typescript
// supabase/functions/send-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!

interface NotificationPayload {
  external_user_id: string
  title: string
  message: string
}

serve(async (req) => {
  try {
    const { external_user_id, title, message }: NotificationPayload = await req.json()

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: 'push',
        include_aliases: {
          external_id: [external_user_id],
        },
        headings: { en: title },
        contents: { en: message },
      }),
    })

    const result = await response.json()

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: response.ok ? 200 : 400,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
```

### 環境変数の設定方法

**ローカル開発**:

```bash
# supabase/.env.local
ONESIGNAL_APP_ID=your_app_id
ONESIGNAL_REST_API_KEY=your_rest_api_key
```

**本番デプロイ**:

```bash
supabase secrets set ONESIGNAL_APP_ID=your_app_id
supabase secrets set ONESIGNAL_REST_API_KEY=your_rest_api_key
```

### Database Webhook との連携

1. Supabase Dashboard > Database > Webhooks
2. 新規 Webhook 作成:
   - Table: `orders`（例）
   - Event: `INSERT`
   - HTTP Method: `POST`
   - URL: Edge Function エンドポイント
   - Header: `Authorization: Bearer [anonKey]`

**Webhook ペイロード例**:

```json
{
  "type": "INSERT",
  "table": "orders",
  "record": {
    "id": "uuid",
    "user_id": "user_uuid",
    "amount": 1099
  }
}
```

### 既知の問題

- `@onesignal/node-onesignal` SDK は Deno 環境で互換性問題あり
- **推奨**: REST API を直接呼び出す方式を使用

---

## 4. OneSignal の料金プランと制限

### プラン比較表

| 項目 | Free | Growth ($19/月~) | Professional | Enterprise |
|------|------|-----------------|--------------|------------|
| **Mobile Push** | 無制限 | $0.012/MAU | カスタム | カスタム |
| **Web Push** | 10,000購読者/送信 | $0.004/購読者 | カスタム | カスタム |
| **Email** | 10,000/月 | 20,000/月 + $1.50/1,000 | カスタム | カスタム |
| **Journeys** | 1アクティブ, 2ステップ | 3アクティブ, 6ステップ | 20アクティブ | 無制限 |
| **Segments** | 6 | 10 | カスタム | 無制限 |
| **Data Tags** | 2 | 10 | カスタム | カスタム |
| **A/B Testing** | 基本 | 基本 | 高度 | 高度 |
| **サポート** | - | - | 24/7優先 | 専任マネージャー |
| **データ保持** | 18ヶ月 | - | 1年履歴 | 2年履歴 |

### Free プランの制限詳細

- **Mobile Push**: 購読者数・送信数ともに**無制限**
- **Web Push**: 10,000購読者まで/送信
- **Email**: 10,000送信/月
- **In-App Messaging**: 基本機能のみ
- **Segments**: 6個まで
- **Data Tags**: 2個まで
- **Journeys**: 1アクティブ、2メッセージステップ
- **購読者データ保持**: 18ヶ月アクティブ

### このプロジェクトでの推奨

**Free プラン** で開始可能:
- Mobile Push が無制限なため、Expo アプリのプッシュ通知には十分
- Web Push も 10,000 購読者まで対応可能
- 基本的な A/B テスト・セグメント機能あり

**Growth プラン検討タイミング**:
- Web Push 購読者が 10,000 を超える場合
- より多くのセグメント・タグが必要な場合
- 高度な Journey 機能が必要な場合

---

## 5. 実装推奨事項

### プロジェクト技術スタックとの統合

| プラットフォーム | パッケージ | バージョン |
|-----------------|-----------|-----------|
| Web (Next.js 16) | `react-onesignal` | ^3.4.6 |
| Mobile (Expo 55) | `react-native-onesignal` | ^5.2.16 |
| Mobile (Expo 55) | `onesignal-expo-plugin` | ^2.0.3 |
| Edge Functions | REST API 直接呼出 | - |

### 外部ユーザーID連携

Supabase Auth の `user.id` を OneSignal の `external_id` として使用:

```typescript
// フロントエンド（ログイン後）
OneSignal.login(user.id)

// ログアウト時
OneSignal.logout()
```

### セキュリティベストプラクティス

1. **App API Key** は絶対にフロントエンドに公開しない
2. **App ID** のみフロントエンド環境変数で使用可
3. REST API 呼び出しは Edge Functions/Backend 経由
4. IP アドレス制限の設定を検討

---

## 参考リンク

- [OneSignal REST API Overview](https://documentation.onesignal.com/reference/rest-api-overview)
- [Create Notification API](https://documentation.onesignal.com/reference/create-notification)
- [Keys & IDs](https://documentation.onesignal.com/docs/keys-and-ids)
- [Expo SDK Setup](https://documentation.onesignal.com/docs/react-native-expo-sdk-setup)
- [React/Next.js Setup](https://documentation.onesignal.com/docs/react-js-setup)
- [Web Push Setup](https://documentation.onesignal.com/docs/en/web-push-setup)
- [OneSignal Pricing](https://onesignal.com/pricing)
- [OneSignal + Supabase Integration](https://supabase.com/partners/integrations/onesignal)
- [GitHub: onesignal-supabase-sample](https://github.com/OneSignalDevelopers/onesignal-supabase-sample-integration-supabase)
- [GitHub: react-onesignal](https://github.com/OneSignal/react-onesignal)
- [GitHub: onesignal-expo-plugin](https://github.com/OneSignal/onesignal-expo-plugin)
