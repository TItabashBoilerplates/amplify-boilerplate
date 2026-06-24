/**
 * OneSignal REST API 共通型定義
 *
 * @see https://documentation.onesignal.com/reference/create-notification
 */

// ====================
// 通知作成リクエスト
// ====================

/**
 * 多言語コンテンツ
 * @example { "en": "Hello", "ja": "こんにちは" }
 */
export type LocalizedContent = Record<string, string>;

/**
 * ターゲティング方法
 */
export interface NotificationTargeting {
  /**
   * セグメント指定
   * @example ["Subscribed Users", "Active Users"]
   */
  included_segments?: string[];

  /**
   * エイリアス指定（推奨）
   * external_id は Supabase user.id と連携
   */
  include_aliases?: {
    external_id?: string[];
    onesignal_id?: string[];
  };

  /**
   * サブスクリプションID指定（非推奨）
   */
  include_subscription_ids?: string[];
}

/**
 * 通知コンテンツ
 */
export interface NotificationContent {
  /**
   * 通知タイトル（多言語対応）
   */
  headings?: LocalizedContent;

  /**
   * 通知本文（必須・多言語対応）
   */
  contents: LocalizedContent;

  /**
   * カスタムデータ（アプリで受け取る追加情報）
   */
  data?: Record<string, unknown>;

  /**
   * タップ時の遷移先URL
   */
  url?: string;
}

/**
 * プラットフォーム固有オプション
 */
export interface PlatformOptions {
  /**
   * iOS: 添付ファイル
   */
  ios_attachments?: Record<string, string>;

  /**
   * Android: 大きな画像
   */
  big_picture?: string;

  /**
   * Chrome Web: 大きな画像
   */
  chrome_web_image?: string;
}

/**
 * 通知作成リクエスト
 */
export interface CreateNotificationRequest
  extends NotificationTargeting, NotificationContent, PlatformOptions {
  /**
   * OneSignal App ID
   */
  app_id: string;

  /**
   * ターゲットチャネル
   */
  target_channel?: "push" | "email" | "sms";

  /**
   * 通知の内部識別名
   */
  name?: string;
}

// ====================
// 通知レスポンス
// ====================

/**
 * 通知作成レスポンス
 */
export interface NotificationResponse {
  /**
   * 通知ID
   */
  id: string;

  /**
   * 送信先ユーザー数
   */
  recipients: number;

  /**
   * 外部ID（リクエストで指定した場合）
   */
  external_id?: string;

  /**
   * エラー情報
   */
  errors?: string[];
}

// ====================
// Webhook イベント
// ====================

/**
 * Webhook イベントタイプ
 */
export type WebhookEventType =
  | "notification.sent"
  | "notification.delivered"
  | "notification.clicked"
  | "notification.dismissed"
  | "subscription.created"
  | "subscription.deleted";

/**
 * Webhook ペイロード
 */
export interface WebhookPayload {
  /**
   * イベントタイプ
   */
  event: WebhookEventType;

  /**
   * 通知ID
   */
  notification_id?: string;

  /**
   * サブスクリプションID
   */
  subscription_id?: string;

  /**
   * OneSignal ユーザーID
   */
  onesignal_id?: string;

  /**
   * 外部ユーザーID（Supabase user.id）
   */
  external_user_id?: string;

  /**
   * 通知タイトル
   */
  heading?: string;

  /**
   * 通知本文
   */
  content?: string;

  /**
   * カスタムデータ
   */
  additional_data?: Record<string, unknown>;

  /**
   * アクションボタンID
   */
  action_id?: string;

  /**
   * タップ時URL
   */
  url?: string;

  /**
   * イベント発生日時
   */
  occurred_at?: string;
}

// ====================
// API エラー
// ====================

/**
 * OneSignal API エラーレスポンス
 */
export interface OneSignalApiError {
  errors: string[];
}
