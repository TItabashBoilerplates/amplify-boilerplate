/**
 * Amplify Storage（S3）の画像配信ヘルパ（Web / Mobile 共有）
 *
 * 幅の段と派生 path の規約は {@link ./ladder} が正本で、**aws-amplify に依存しない**
 * （派生を生成する Lambda も同じものを import する）。このファイルはそこへ
 * 署名付き URL の発行を足したブラウザ / サーバー向けの入口。
 *
 * @packageDocumentation
 */

import { getUrl } from 'aws-amplify/storage'
import { buildDerivativePath } from './ladder'

export {
  buildDerivativePath,
  IMAGE_OPTIMIZER_LIMITS,
  IMAGE_WIDTH_LADDER,
  type ImageWidth,
  isDerivativePath,
  MAX_IMAGE_WIDTH,
  snapImageWidth,
} from './ladder'

/**
 * 非公開オブジェクトの署名付き URL を作る（**サーバー側専用**）。
 *
 * ⚠️ **クライアントで署名しない。** `getUrl()` の既定有効期限は 900 秒で、
 * **毎回 URL が変わる**ため `next/image` の最適化キャッシュもヒットしない。
 * 一覧に大量に並ぶ画像を署名 URL で出さないこと（サムネイルは公開パスへ置く）。
 *
 * 返した URL を **DB に保存してはならない**（期限切れの URL がデータとして残る）。
 */
export async function createSignedImageUrl(options: {
  path: string
  /** 表示幅。派生を要求する場合に渡す（段に丸めてから使う） */
  width?: number
  /** 秒。既定は Amplify の既定値（900 秒）に合わせる */
  expiresIn?: number
}): Promise<string> {
  const path =
    options.width === undefined ? options.path : buildDerivativePath(options.path, options.width)

  const { url } = await getUrl({
    path,
    options: { expiresIn: options.expiresIn ?? 900 },
  })
  return url.toString()
}
