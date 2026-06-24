/**
 * OneSignal Webhook エンドポイント
 *
 * OneSignal からの Webhook イベントを受信し、適切なハンドラにルーティングする。
 *
 * ## 対応イベント
 *
 * - `notification.delivered` - 通知がデバイスに配信された
 * - `notification.clicked` - ユーザーが通知をタップした
 * - `notification.dismissed` - ユーザーが通知を却下した
 * - `subscription.created` - 新しいデバイスが購読を開始した
 * - `subscription.deleted` - デバイスが購読を解除した
 *
 * ## 環境変数
 *
 * - `ONE_SIGNAL_WEBHOOK_SECRET` - Webhook 検証用シークレット（推奨）
 * - `SUPABASE_URL` - Supabase URL
 * - `SUPABASE_SERVICE_ROLE_KEY` - Supabase サービスロールキー
 *
 * @see https://documentation.onesignal.com/docs/webhooks
 */

import { createClient } from "@supabase/supabase-js";
import { createFunctionLogger } from "../shared/logger/index.ts";
import {
  handleNotificationClicked,
  handleNotificationDelivered,
  handleNotificationDismissed,
} from "./handlers/notification.ts";
import {
  handleSubscriptionCreated,
  handleSubscriptionDeleted,
} from "./handlers/subscription.ts";
import type {
  HandlerResult,
  WebhookEventType,
  WebhookPayload,
} from "./handlers/types.ts";

const logger = createFunctionLogger("onesignal-webhook");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-onesignal-signature",
};

/**
 * Webhook シークレットによる検証
 *
 * OneSignal Webhook は現在署名ベースの検証を提供していないため、
 * カスタムシークレットをクエリパラメータまたはヘッダーで検証する。
 *
 * @example
 * Webhook URL: https://xxx.supabase.co/functions/v1/onesignal-webhooks?secret=YOUR_SECRET
 */
function verifyWebhookSecret(req: Request, expectedSecret: string): boolean {
  // クエリパラメータから検証
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret === expectedSecret) {
    return true;
  }

  // ヘッダーから検証
  const headerSecret = req.headers.get("x-webhook-secret");
  if (headerSecret === expectedSecret) {
    return true;
  }

  return false;
}

/**
 * メイン Webhook ハンドラ
 */
Deno.serve(async (req: Request) => {
  // CORS プリフライト
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // POST のみ受付
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Webhook シークレット検証（設定されている場合）
    const webhookSecret = Deno.env.get("ONE_SIGNAL_WEBHOOK_SECRET");
    if (webhookSecret) {
      const isValid = verifyWebhookSecret(req, webhookSecret);
      if (!isValid) {
        logger.error("Invalid webhook secret");
        return new Response(JSON.stringify({ error: "Invalid secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ペイロード解析
    const payload: WebhookPayload = await req.json();
    const eventType = payload.event as WebhookEventType;

    logger.info("Received event", { eventType });

    // Supabase クライアント作成
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error("Supabase configuration missing");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // イベントタイプに応じてハンドラを実行
    let result: HandlerResult;

    switch (eventType) {
      case "notification.delivered":
        result = await handleNotificationDelivered(supabase, payload);
        break;
      case "notification.clicked":
        result = await handleNotificationClicked(supabase, payload);
        break;
      case "notification.dismissed":
        result = await handleNotificationDismissed(supabase, payload);
        break;
      case "subscription.created":
        result = await handleSubscriptionCreated(supabase, payload);
        break;
      case "subscription.deleted":
        result = await handleSubscriptionDeleted(supabase, payload);
        break;
      default:
        logger.info("Unhandled event type", { eventType });
        result = { success: true, message: `Unhandled event: ${eventType}` };
    }

    const status = result.success ? 200 : 500;
    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    logger.error("Error processing webhook", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
