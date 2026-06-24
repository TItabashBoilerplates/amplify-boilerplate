/**
 * OneSignal Service Worker
 *
 * Web Push 通知を受信するために必要な Service Worker。
 * OneSignal SDK によって自動的に登録・管理される。
 *
 * @see https://documentation.onesignal.com/docs/web-push-custom-code-setup
 */

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')
