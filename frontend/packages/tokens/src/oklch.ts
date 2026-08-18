/**
 * Design Tokens: OKLCh → sRGB 解決
 *
 * トークンの正本 (`colors.ts`) は OKLCh（知覚的に均一な色空間）で書かれている。
 * CSS を扱えるプラットフォーム（Web / Desktop / NativeWind の className）は
 * OKLCh をそのまま解釈できるが、React Native の **JS 側の style prop や
 * サードパーティ製ナビゲーションのテーマ**（`tabBarActiveTintColor` など）は
 * hex しか受け付けない。
 *
 * このモジュールはその橋渡しをする。これにより native 側で別パレットを
 * 手書きする必要がなくなり、デザインシステムの正本が 1 つに保たれる。
 *
 * @see https://www.w3.org/TR/css-color-4/#ok-lab
 */

import { type ColorMode, type ColorToken, colors } from './colors'

const OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i

/** `0.5` / `50%` の両表記を 0..1 の数値にする */
function toRatio(raw: string, referenceValue: number): number {
  if (raw.endsWith('%')) {
    return Number.parseFloat(raw.slice(0, -1)) / 100
  }
  return Number.parseFloat(raw) / referenceValue
}

/** linear-light sRGB → gamma-encoded sRGB (CSS Color 4) */
function gammaEncode(channel: number): number {
  const abs = Math.abs(channel)
  if (abs <= 0.0031308) {
    return channel * 12.92
  }
  return Math.sign(channel) * (1.055 * abs ** (1 / 2.4) - 0.055)
}

function toHexPair(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio))
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
}

/**
 * OKLCh の CSS 文字列を hex 表記へ変換する。
 *
 * アルファを持つ色は 8 桁 hex (`#rrggbbaa`) を返す。
 * sRGB の色域外の色は各チャンネルをクランプする（CSS の既定挙動と同じ）。
 *
 * @throws OKLCh として解釈できない文字列を渡した場合
 */
export function oklchToHex(value: string): string {
  const match = OKLCH_PATTERN.exec(value.trim())
  if (!match) {
    throw new Error(`Not a valid oklch() color: ${value}`)
  }

  const [, rawL, rawC, rawH, rawAlpha] = match

  const lightness = toRatio(rawL, 1)
  // chroma のパーセント表記は 0.4 を 100% とする (CSS Color 4)
  const chroma = rawC.endsWith('%')
    ? (Number.parseFloat(rawC.slice(0, -1)) / 100) * 0.4
    : Number.parseFloat(rawC)
  const hueRadians = (Number.parseFloat(rawH) * Math.PI) / 180

  // OKLCh → OKLab
  const a = chroma * Math.cos(hueRadians)
  const b = chroma * Math.sin(hueRadians)

  // OKLab → LMS (cone response), 立方で非線形を戻す
  const lCone = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mCone = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sCone = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  // LMS → linear sRGB
  const red = 4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone
  const green = -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone
  const blue = -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone

  const hex = `#${toHexPair(gammaEncode(red))}${toHexPair(gammaEncode(green))}${toHexPair(gammaEncode(blue))}`

  if (rawAlpha === undefined) {
    return hex
  }
  return `${hex}${toHexPair(toRatio(rawAlpha, 1))}`
}

function resolveMode(mode: ColorMode): Record<ColorToken, string> {
  return Object.fromEntries(
    Object.entries(colors[mode]).map(([token, value]) => [token, oklchToHex(value)])
  ) as Record<ColorToken, string>
}

/**
 * `colors` を hex に解決したもの。React Native の JS 側から使う。
 *
 * className が使える場所では **必ずセマンティックなユーティリティ**
 * (`bg-background` / `text-foreground` ...) を優先すること。
 * これはあくまで hex しか受け取れない API のための出口。
 */
export const resolvedColors = {
  light: resolveMode('light'),
  dark: resolveMode('dark'),
} as const
