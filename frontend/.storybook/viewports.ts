/**
 * デバイス枠プリセット（UI/UX デバッグ用）。
 *
 * ■ 用途
 *   Storybook のツールバーから実機相当の画面幅に切り替えて、レイアウト崩れを確認する。
 *   `.claude/rules/ui-testing.md` / storybook スキルの「MobileView 用の Story を作らず
 *   Viewport ツールを使う」方針を実際に使える状態にするためのもの。
 *
 * ■ ⚠️ これはストア用スクリーンショットの生成には使えない
 *   ここの数値は **CSS ピクセル（＝論理ポイント）** で、Storybook は react-native-web の
 *   描画なので、ネイティブのフォント・shadow/elevation・ステータスバー・セーフエリアは
 *   再現されない。ストアに提出する画像は simulator / emulator の実描画を
 *   `screenshots-mobile` script（Maestro）でキャプチャすること。
 *
 * ■ 論理ポイント → ストア要求ピクセルの対応（実機の DPR を掛けた値）
 *   | プリセット      | 論理 pt    | DPR | 実ピクセル   | ストア区分                    |
 *   |-----------------|-----------|-----|-------------|-------------------------------|
 *   | iphone-6-9      | 440x956   | x3  | 1320x2868   | App Store 6.9"（**必須**）    |
 *   | iphone-6-5      | 428x926   | x3  | 1284x2778   | App Store 6.5"（6.9"未提出時）|
 *   | iphone-6-3      | 393x852   | x3  | 1179x2556   | App Store 6.3"（任意）        |
 *   | iphone-6-1      | 390x844   | x3  | 1170x2532   | App Store 6.1"（任意）        |
 *   | ipad-13         | 1032x1376 | x2  | 2064x2752   | App Store 13"（iPad 対応時必須）|
 *   | ipad-11         | 744x1133  | x2  | 1488x2266   | App Store 11"                 |
 *   出典: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/
 *
 *   Android は Play が「9:16 推奨・最小 1080x1920」かつ
 *   **「最大辺は最小辺の 2 倍以内」**を要求する。最近の端末は 20:9（例 1080x2400 = 2.22 倍）で
 *   この制約を**超える**ため、生スクショをそのまま出せない。詳細は screenshots スクリプト側で扱う。
 *   出典: https://support.google.com/googleplay/android-developer/answer/9866151
 */
import type { Viewport } from 'storybook/viewport'

const px = (width: number, height: number) => ({ width: `${width}px`, height: `${height}px` })

export const deviceViewports: Record<string, Viewport> = {
  'iphone-6-9': {
    name: 'iPhone 6.9" (16/17 Pro Max)',
    styles: px(440, 956),
    type: 'mobile',
  },
  'iphone-6-5': {
    name: 'iPhone 6.5" (14 Plus)',
    styles: px(428, 926),
    type: 'mobile',
  },
  'iphone-6-3': {
    name: 'iPhone 6.3" (16 Pro)',
    styles: px(393, 852),
    type: 'mobile',
  },
  'iphone-6-1': {
    name: 'iPhone 6.1" (14/13)',
    styles: px(390, 844),
    type: 'mobile',
  },
  'iphone-se': {
    name: 'iPhone SE (4.7")',
    styles: px(375, 667),
    type: 'mobile',
  },
  'android-phone': {
    name: 'Android Phone (Pixel 7/8)',
    styles: px(412, 915),
    type: 'mobile',
  },
  'android-compact': {
    name: 'Android Compact (360x640)',
    styles: px(360, 640),
    type: 'mobile',
  },
  'ipad-13': {
    name: 'iPad 13"',
    styles: px(1032, 1376),
    type: 'tablet',
  },
  'ipad-11': {
    name: 'iPad 11"',
    styles: px(744, 1133),
    type: 'tablet',
  },
}
