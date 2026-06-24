/**
 * OneSignal 共通モジュール
 *
 * @example
 * ```typescript
 * import { createOneSignalClient } from "../shared/onesignal/index.ts"
 * import type { WebhookPayload } from "../shared/onesignal/index.ts"
 * ```
 */

export type { OneSignalClient } from "./client.ts";
export { createOneSignalClient } from "./client.ts";

export type {
  CreateNotificationRequest,
  LocalizedContent,
  NotificationContent,
  NotificationResponse,
  NotificationTargeting,
  OneSignalApiError,
  PlatformOptions,
  WebhookEventType,
  WebhookPayload,
} from "./types.ts";
