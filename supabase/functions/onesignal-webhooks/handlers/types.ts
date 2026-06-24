/**
 * OneSignal Webhook ハンドラ型定義
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Webhook ペイロード（OneSignal から送信される）
 *
 * @see https://documentation.onesignal.com/docs/webhooks
 */
export interface WebhookPayload {
  /**
   * イベントタイプ
   */
  event: WebhookEventType;

  /**
   * OneSignal App ID
   */
  app_id?: string;

  /**
   * 通知ID
   */
  notification_id?: string;

  /**
   * サブスクリプションID（デバイス）
   */
  subscription_id?: string;

  /**
   * OneSignal ユーザーID
   */
  onesignal_id?: string;

  /**
   * 外部ユーザーID（Supabase user.id と連携）
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
   * タップしたアクションボタンID
   */
  action_id?: string;

  /**
   * タップ時URL
   */
  url?: string;

  /**
   * イベント発生日時（ISO 8601）
   */
  occurred_at?: string;

  /**
   * デバイスタイプ
   */
  device_type?: number;

  /**
   * プラットフォーム
   */
  platform?: string;
}

/**
 * Webhook ハンドラの戻り値
 */
export interface HandlerResult {
  success: boolean;
  message: string;
}

/**
 * Webhook ハンドラ関数の型
 */
export type WebhookHandler = (
  supabase: SupabaseClient,
  payload: WebhookPayload,
) => Promise<HandlerResult>;
