/**
 * OneSignal REST API クライアント
 *
 * Edge Functions から OneSignal REST API を呼び出すためのクライアント。
 * 環境変数 `ONE_SIGNAL_APP_ID` と `ONE_SIGNAL_API_KEY` が必要。
 *
 * @see https://documentation.onesignal.com/reference/create-notification
 *
 * @example
 * ```typescript
 * const client = createOneSignalClient()
 *
 * // 特定ユーザーに通知
 * await client.sendToUser("user-123", {
 *   headings: { en: "New Message", ja: "新しいメッセージ" },
 *   contents: { en: "You have a new message", ja: "新しいメッセージがあります" },
 * })
 *
 * // セグメントに通知
 * await client.sendToSegment(["Subscribed Users"], {
 *   contents: { en: "Weekly update", ja: "週次アップデート" },
 * })
 * ```
 */

import type {
  CreateNotificationRequest,
  LocalizedContent,
  NotificationResponse,
  OneSignalApiError,
  PlatformOptions,
} from "./types.ts";

const ONESIGNAL_API_URL = "https://api.onesignal.com";

/**
 * OneSignal クライアント設定
 */
interface OneSignalClientConfig {
  appId: string;
  apiKey: string;
}

/**
 * 通知送信オプション
 */
interface SendNotificationOptions {
  headings?: LocalizedContent;
  contents: LocalizedContent;
  data?: Record<string, unknown>;
  url?: string;
  platformOptions?: PlatformOptions;
}

/**
 * OneSignal クライアントを作成
 *
 * @throws {Error} 環境変数が設定されていない場合
 */
export function createOneSignalClient() {
  const appId = Deno.env.get("ONE_SIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONE_SIGNAL_API_KEY");

  if (!appId || !apiKey) {
    throw new Error(
      "ONE_SIGNAL_APP_ID and ONE_SIGNAL_API_KEY environment variables must be set",
    );
  }

  const config: OneSignalClientConfig = { appId, apiKey };

  return {
    /**
     * App ID を取得
     */
    get appId() {
      return config.appId;
    },

    /**
     * 汎用通知送信
     *
     * @param request - 完全な通知リクエスト（app_id は自動設定）
     * @returns 通知レスポンス
     */
    async sendNotification(
      request: Omit<CreateNotificationRequest, "app_id">,
    ): Promise<NotificationResponse> {
      const response = await fetch(`${ONESIGNAL_API_URL}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Key ${config.apiKey}`,
        },
        body: JSON.stringify({
          app_id: config.appId,
          ...request,
        }),
      });

      if (!response.ok) {
        const error: OneSignalApiError = await response.json();
        throw new Error(`OneSignal API error: ${JSON.stringify(error.errors)}`);
      }

      return response.json();
    },

    /**
     * 特定ユーザーに通知送信
     *
     * external_id は Supabase の user.id と対応させることを推奨。
     *
     * @param externalUserId - ユーザーの外部ID（Supabase user.id）
     * @param options - 通知オプション
     * @returns 通知レスポンス
     *
     * @example
     * ```typescript
     * await client.sendToUser("550e8400-e29b-41d4-a716-446655440000", {
     *   headings: { en: "Order Shipped", ja: "発送完了" },
     *   contents: { en: "Your order has been shipped!", ja: "ご注文が発送されました！" },
     *   data: { orderId: "12345" },
     *   url: "https://example.com/orders/12345",
     * })
     * ```
     */
    sendToUser(
      externalUserId: string,
      options: SendNotificationOptions,
    ): Promise<NotificationResponse> {
      return this.sendNotification({
        target_channel: "push",
        include_aliases: {
          external_id: [externalUserId],
        },
        headings: options.headings,
        contents: options.contents,
        data: options.data,
        url: options.url,
        ...options.platformOptions,
      });
    },

    /**
     * 複数ユーザーに通知送信
     *
     * 最大 2,000 件まで一括送信可能。
     *
     * @param externalUserIds - ユーザーの外部ID配列
     * @param options - 通知オプション
     * @returns 通知レスポンス
     */
    sendToUsers(
      externalUserIds: string[],
      options: SendNotificationOptions,
    ): Promise<NotificationResponse> {
      if (externalUserIds.length > 2000) {
        throw new Error(
          "Cannot send to more than 2,000 users at once. Use segments instead.",
        );
      }

      return this.sendNotification({
        target_channel: "push",
        include_aliases: {
          external_id: externalUserIds,
        },
        headings: options.headings,
        contents: options.contents,
        data: options.data,
        url: options.url,
        ...options.platformOptions,
      });
    },

    /**
     * セグメントに通知送信
     *
     * @param segments - セグメント名の配列
     * @param options - 通知オプション
     * @returns 通知レスポンス
     *
     * @example
     * ```typescript
     * await client.sendToSegment(["Subscribed Users"], {
     *   headings: { en: "Weekly Update", ja: "週次アップデート" },
     *   contents: { en: "Check out what's new!", ja: "新着情報をチェック！" },
     * })
     * ```
     */
    sendToSegment(
      segments: string[],
      options: SendNotificationOptions,
    ): Promise<NotificationResponse> {
      return this.sendNotification({
        target_channel: "push",
        included_segments: segments,
        headings: options.headings,
        contents: options.contents,
        data: options.data,
        url: options.url,
        ...options.platformOptions,
      });
    },

    /**
     * 全購読ユーザーに通知送信
     *
     * @param options - 通知オプション
     * @returns 通知レスポンス
     */
    sendToAll(options: SendNotificationOptions): Promise<NotificationResponse> {
      return this.sendToSegment(["Subscribed Users"], options);
    },
  };
}

/**
 * OneSignal クライアントの型
 */
export type OneSignalClient = ReturnType<typeof createOneSignalClient>;
