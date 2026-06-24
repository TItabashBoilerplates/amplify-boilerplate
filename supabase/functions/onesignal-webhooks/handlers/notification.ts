/**
 * 通知関連イベントハンドラ
 *
 * - notification.delivered: 通知がデバイスに配信された
 * - notification.clicked: ユーザーが通知をタップした
 * - notification.dismissed: ユーザーが通知を却下した
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createFunctionLogger } from "../../shared/logger/index.ts";
import type { HandlerResult, WebhookPayload } from "./types.ts";

const logger = createFunctionLogger("onesignal-webhook");

/**
 * 通知配信完了ハンドラ
 *
 * 通知がデバイスに正常に配信されたときに呼び出される。
 * 配信率のトラッキングやアナリティクスに使用。
 */
export function handleNotificationDelivered(
  _supabase: SupabaseClient,
  payload: WebhookPayload,
): HandlerResult {
  logger.info("Notification delivered", {
    notificationId: payload.notification_id,
    externalUserId: payload.external_user_id,
    occurredAt: payload.occurred_at,
  });

  // TODO: 必要に応じてデータベースに記録
  // 例: notification_analytics テーブルに配信記録を追加
  //
  // const { error } = await supabase.from('notification_analytics').insert({
  //   notification_id: payload.notification_id,
  //   user_id: payload.external_user_id,
  //   event_type: 'delivered',
  //   occurred_at: payload.occurred_at,
  // })

  return {
    success: true,
    message: `Notification delivered: ${payload.notification_id}`,
  };
}

/**
 * 通知タップハンドラ
 *
 * ユーザーが通知をタップしたときに呼び出される。
 * エンゲージメント率のトラッキングに使用。
 */
export function handleNotificationClicked(
  _supabase: SupabaseClient,
  payload: WebhookPayload,
): HandlerResult {
  logger.info("Notification clicked", {
    notificationId: payload.notification_id,
    externalUserId: payload.external_user_id,
    actionId: payload.action_id,
    url: payload.url,
    occurredAt: payload.occurred_at,
  });

  // TODO: 必要に応じてデータベースに記録
  // 例: 開封率トラッキング
  //
  // const { error } = await supabase.from('notification_analytics').insert({
  //   notification_id: payload.notification_id,
  //   user_id: payload.external_user_id,
  //   event_type: 'clicked',
  //   action_id: payload.action_id,
  //   url: payload.url,
  //   occurred_at: payload.occurred_at,
  // })

  return {
    success: true,
    message: `Notification clicked: ${payload.notification_id}`,
  };
}

/**
 * 通知却下ハンドラ
 *
 * ユーザーが通知を開かずに却下したときに呼び出される。
 * 通知の効果測定に使用。
 */
export function handleNotificationDismissed(
  _supabase: SupabaseClient,
  payload: WebhookPayload,
): HandlerResult {
  logger.info("Notification dismissed", {
    notificationId: payload.notification_id,
    externalUserId: payload.external_user_id,
    occurredAt: payload.occurred_at,
  });

  // TODO: 必要に応じてデータベースに記録
  //
  // const { error } = await supabase.from('notification_analytics').insert({
  //   notification_id: payload.notification_id,
  //   user_id: payload.external_user_id,
  //   event_type: 'dismissed',
  //   occurred_at: payload.occurred_at,
  // })

  return {
    success: true,
    message: `Notification dismissed: ${payload.notification_id}`,
  };
}
