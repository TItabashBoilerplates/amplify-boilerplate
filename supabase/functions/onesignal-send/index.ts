/**
 * OneSignal 通知送信 API
 *
 * バックエンドから OneSignal を通じてプッシュ通知を送信するための Edge Function。
 *
 * ## エンドポイント
 *
 * POST /functions/v1/onesignal-send
 *
 * ## 認証
 *
 * - Supabase service_role キーまたは有効な JWT トークンが必要
 *
 * ## リクエストボディ
 *
 * ```json
 * {
 *   "type": "user" | "users" | "segment" | "all",
 *   "target": "user-id" | ["user-id-1", "user-id-2"] | ["Subscribed Users"],
 *   "headings": { "en": "Title", "ja": "タイトル" },
 *   "contents": { "en": "Message", "ja": "メッセージ" },
 *   "data": { "key": "value" },
 *   "url": "https://example.com/path"
 * }
 * ```
 *
 * ## 環境変数
 *
 * - `ONE_SIGNAL_APP_ID` - OneSignal App ID
 * - `ONE_SIGNAL_API_KEY` - OneSignal REST API Key
 * - `SUPABASE_URL` - Supabase URL（認証検証用）
 * - `SUPABASE_SERVICE_ROLE_KEY` - Supabase サービスロールキー
 */

import { createClient } from "@supabase/supabase-js";
import { createFunctionLogger } from "../shared/logger/index.ts";
import type {
  LocalizedContent,
  PlatformOptions,
} from "../shared/onesignal/index.ts";
import { createOneSignalClient } from "../shared/onesignal/index.ts";

const logger = createFunctionLogger("onesignal-send");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * 送信タイプ
 */
type SendType = "user" | "users" | "segment" | "all";

/**
 * リクエストボディ
 */
interface SendNotificationRequest {
  /**
   * 送信タイプ
   * - user: 単一ユーザーに送信
   * - users: 複数ユーザーに送信（最大2,000件）
   * - segment: セグメントに送信
   * - all: 全購読ユーザーに送信
   */
  type: SendType;

  /**
   * 送信先
   * - type=user: ユーザーID（string）
   * - type=users: ユーザーID配列（string[]）
   * - type=segment: セグメント名配列（string[]）
   * - type=all: 不要
   */
  target?: string | string[];

  /**
   * 通知タイトル（多言語対応）
   */
  headings?: LocalizedContent;

  /**
   * 通知本文（必須・多言語対応）
   */
  contents: LocalizedContent;

  /**
   * カスタムデータ
   */
  data?: Record<string, unknown>;

  /**
   * タップ時遷移先URL
   */
  url?: string;

  /**
   * プラットフォーム固有オプション
   */
  platformOptions?: PlatformOptions;
}

/**
 * 認証検証
 */
async function verifyAuth(
  req: Request,
): Promise<{ authorized: boolean; userId?: string }> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return { authorized: false };
  }

  // Bearer トークンを抽出
  const token = authHeader.replace("Bearer ", "");

  // service_role キーの場合は即座に許可
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (token === serviceRoleKey) {
    return { authorized: true };
  }

  // JWT トークンの場合は検証
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !serviceRoleKey) {
    return { authorized: false };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { authorized: false };
  }

  return { authorized: true, userId: user.id };
}

/**
 * メインハンドラ
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
    // 認証検証
    const auth = await verifyAuth(req);
    if (!auth.authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // リクエストボディ解析
    const body: SendNotificationRequest = await req.json();

    // バリデーション
    if (!body.contents || Object.keys(body.contents).length === 0) {
      return new Response(JSON.stringify({ error: "contents is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OneSignal クライアント作成
    const onesignal = createOneSignalClient();

    // 送信オプション
    const options = {
      headings: body.headings,
      contents: body.contents,
      data: body.data,
      url: body.url,
      platformOptions: body.platformOptions,
    };

    let result: Awaited<ReturnType<typeof onesignal.sendToAll>>;

    switch (body.type) {
      case "user":
        if (typeof body.target !== "string") {
          return new Response(
            JSON.stringify({ error: "target must be a string for type=user" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        result = await onesignal.sendToUser(body.target, options);
        break;

      case "users":
        if (!Array.isArray(body.target)) {
          return new Response(
            JSON.stringify({ error: "target must be an array for type=users" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        result = await onesignal.sendToUsers(body.target, options);
        break;

      case "segment":
        if (!Array.isArray(body.target)) {
          return new Response(
            JSON.stringify({
              error: "target must be an array for type=segment",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        result = await onesignal.sendToSegment(body.target, options);
        break;

      case "all":
        result = await onesignal.sendToAll(options);
        break;

      default:
        return new Response(
          JSON.stringify({
            error: "Invalid type. Must be: user, users, segment, or all",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
    }

    logger.info("Notification sent", {
      type: body.type,
      notificationId: result.id,
      recipients: result.recipients,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    logger.error("Error sending notification", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
