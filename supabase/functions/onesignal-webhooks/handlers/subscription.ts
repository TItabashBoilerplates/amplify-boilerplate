/**
 * 購読状態変更イベントハンドラ
 *
 * - subscription.created: 新しいデバイスが購読を開始した
 * - subscription.deleted: デバイスが購読を解除した
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createFunctionLogger } from "../../shared/logger/index.ts";
import type { HandlerResult, WebhookPayload } from "./types.ts";

const logger = createFunctionLogger("onesignal-webhook");

/**
 * 購読開始ハンドラ
 *
 * 新しいデバイスがプッシュ通知を購読したときに呼び出される。
 * ユーザーの通知設定状態の同期に使用。
 */
export function handleSubscriptionCreated(
  _supabase: SupabaseClient,
  payload: WebhookPayload,
): HandlerResult {
  logger.info("Subscription created", {
    subscriptionId: payload.subscription_id,
    externalUserId: payload.external_user_id,
    onesignalId: payload.onesignal_id,
    platform: payload.platform,
    deviceType: payload.device_type,
    occurredAt: payload.occurred_at,
  });

  // TODO: 必要に応じてデータベースに記録
  // 例: ユーザーの通知設定を有効化
  //
  // if (payload.external_user_id) {
  //   const { error } = await supabase
  //     .from('user_settings')
  //     .update({ push_notifications_enabled: true })
  //     .eq('user_id', payload.external_user_id)
  // }
  //
  // または購読履歴を記録
  //
  // const { error } = await supabase.from('push_subscriptions').insert({
  //   subscription_id: payload.subscription_id,
  //   user_id: payload.external_user_id,
  //   onesignal_id: payload.onesignal_id,
  //   platform: payload.platform,
  //   device_type: payload.device_type,
  //   subscribed_at: payload.occurred_at,
  //   is_active: true,
  // })

  return {
    success: true,
    message: `Subscription created: ${payload.subscription_id}`,
  };
}

/**
 * 購読解除ハンドラ
 *
 * デバイスがプッシュ通知の購読を解除したときに呼び出される。
 * ユーザーの通知設定状態の同期に使用。
 */
export function handleSubscriptionDeleted(
  _supabase: SupabaseClient,
  payload: WebhookPayload,
): HandlerResult {
  logger.info("Subscription deleted", {
    subscriptionId: payload.subscription_id,
    externalUserId: payload.external_user_id,
    onesignalId: payload.onesignal_id,
    occurredAt: payload.occurred_at,
  });

  // TODO: 必要に応じてデータベースに記録
  // 例: 購読を非アクティブに更新
  //
  // const { error } = await supabase
  //   .from('push_subscriptions')
  //   .update({
  //     is_active: false,
  //     unsubscribed_at: payload.occurred_at,
  //   })
  //   .eq('subscription_id', payload.subscription_id)
  //
  // または、ユーザーの全デバイスが購読解除されたか確認
  //
  // if (payload.external_user_id) {
  //   const { data: activeSubscriptions } = await supabase
  //     .from('push_subscriptions')
  //     .select('id')
  //     .eq('user_id', payload.external_user_id)
  //     .eq('is_active', true)
  //
  //   if (!activeSubscriptions || activeSubscriptions.length === 0) {
  //     await supabase
  //       .from('user_settings')
  //       .update({ push_notifications_enabled: false })
  //       .eq('user_id', payload.external_user_id)
  //   }
  // }

  return {
    success: true,
    message: `Subscription deleted: ${payload.subscription_id}`,
  };
}
