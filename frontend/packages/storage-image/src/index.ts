/**
 * Amplify Storage（S3）の画像配信ヘルパ（Web / Mobile 共有）
 *
 * ## 何のためにあるか
 *
 * **S3 に置いた画像を元サイズのまま配ってはならない**（`.claude/rules/storage-images.md`）。
 * 表示 40px のアバターのために 4MB の JPEG を転送すると、そのまま S3 + CloudFront の
 * データ転送課金になり、LCP も落ちる。そして**この不具合はレビューで見つからない**
 * （無変換でも画面は正しく表示され、ビルド・型・lint はすべて通る）。
 *
 * ## Supabase との最大の違い
 *
 * Supabase Storage には変換 API が組み込まれているが、**S3 には無い**。
 * したがってプラットフォームごとに配信経路が変わる:
 *
 * | 対象 | 経路 |
 * |---|---|
 * | Web（Next.js on Amplify Hosting） | `next/image` の最適化（Next 13+ は追加設定不要） |
 * | Mobile（Expo） | 派生（リサイズ済みオブジェクト）を要求する |
 *
 * このモジュールは**両者で共通の「幅の段」と path 規約**だけを持つ。実際の
 * `<img>` / `expo-image` の描画は各アプリの `@/shared/ui` の `StorageImage` が行う。
 *
 * @see https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html
 * @see https://docs.amplify.aws/react/build-a-backend/storage/download-files/
 *
 * @packageDocumentation
 */

import { getUrl } from 'aws-amplify/storage'

/**
 * Amplify Hosting の Next.js 画像最適化の実測上限。
 *
 * これを超える原本を Web に出すと**最適化が失敗する**（画像が出ない / 500）。
 * アップロード時に上限内へ縮小しておくこと（`.claude/rules/storage-images.md` §3）。
 */
export const IMAGE_OPTIMIZER_LIMITS = {
  /** 最適化後の画像サイズ上限（バイト） */
  maxOptimizedBytes: 4.3 * 1024 * 1024,
  /** Lambda@Edge の画像レスポンス上限（バイト） */
  maxEdgeResponseBytes: 1 * 1024 * 1024,
} as const

/**
 * 生成しうる幅の全集合。
 *
 * **`apps/web/next.config.ts` の `images.imageSizes` + `images.deviceSizes` と
 * 一致していなければならない**（ズレると `storage-image.policy.test.ts` が落ちる）。
 * Next.js の既定 `deviceSizes` は 3840 を含むが、派生を事前生成する運用では
 * 段を増やすほど生成コストが増えるので 2048 で打ち止めにしている。
 */
export const IMAGE_WIDTH_LADDER = [
  16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048,
] as const

export type ImageWidth = (typeof IMAGE_WIDTH_LADDER)[number]

/** 段の最大値。アップロード時はこの幅以下へ縮小して保存する（原本を持たない） */
export const MAX_IMAGE_WIDTH = IMAGE_WIDTH_LADDER[IMAGE_WIDTH_LADDER.length - 1]

/**
 * 要求幅を {@link IMAGE_WIDTH_LADDER} の段へ丸める（要求幅以上で最小の段）。
 *
 * 段に丸めるのは **CDN キャッシュヒット率**のため。1px 刻みの幅をそのまま投げると
 * 実質すべてキャッシュミスになり、取得のたびにオリジンへ行く（速度も転送量も悪化する）。
 *
 * **呼び出し側で幅を自前計算しないこと。** 表示サイズを渡してここで丸める。
 *
 * @throws 幅が有限の正数でない場合（呼び出し側の実装バグ）
 */
export function snapImageWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`snapImageWidth: width must be a positive finite number, received ${width}`)
  }

  const requested = Math.ceil(width)
  return IMAGE_WIDTH_LADDER.find((step) => step >= requested) ?? MAX_IMAGE_WIDTH
}

/**
 * 派生（リサイズ済みオブジェクト）の S3 path。
 *
 * `media/u1/avatar.jpg` + 128 → `media/u1/avatar@128w.jpg`
 *
 * ## なぜ path 規約を共有するのか
 *
 * 派生を作る側（S3 イベントの Lambda）と読む側（Mobile の `StorageImage`）が
 * **同じ規則を 2 か所に書くと必ずズレる**（ズレても 404 になるだけで型は通る）。
 * 規約はここが単一の正本。
 *
 * @param path - 原本の path（`getUrl` / `uploadData` に渡すのと同じもの）
 * @param width - {@link snapImageWidth} で丸めた幅
 */
export function buildDerivativePath(path: string, width: number): string {
  const snapped = snapImageWidth(width)
  const lastDot = path.lastIndexOf('.')
  const lastSlash = path.lastIndexOf('/')

  // 拡張子が無い / ディレクトリ名にだけ `.` がある場合は末尾に付ける
  if (lastDot <= lastSlash) {
    return `${path}@${snapped}w`
  }
  return `${path.slice(0, lastDot)}@${snapped}w${path.slice(lastDot)}`
}

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
