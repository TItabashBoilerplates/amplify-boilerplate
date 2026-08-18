import { snapImageWidth } from '@workspace/storage-image'
import Image from 'next/image'

/**
 * Amplify Storage（S3）の画像を **表示サイズに合わせて**表示する（Web）。
 *
 * ## なぜ必ずこれを通すのか
 *
 * 元画像をそのまま配ると、表示 40px のアバターのために 4MB の JPEG が転送される。
 * S3 + CloudFront のデータ転送課金と LCP に直撃するが、**無変換でも画面は正しく
 * 表示されるのでレビューでは見つからない**（`.claude/rules/storage-images.md`）。
 *
 * ## 2 つの入口
 *
 * | 公開性 | 渡すもの | 挙動 |
 * |---|---|---|
 * | 公開パス（`public/...`） | `src`（安定 URL） | `next/image` の srcset がフルに効く |
 * | 非公開（既定） | `signedUrl`（**サーバー側で発行**） | 1 枚だけ最適化する |
 *
 * ⚠️ 署名 URL は `getUrl()` の既定 900 秒で**毎回変わる**ため、`next/image` の
 * 最適化キャッシュはヒットしない（1 枚ぶんの最適化コストが毎回かかる）。
 * **一覧に大量に並ぶ画像を署名 URL で出さない** — サムネイルは公開パスへ置く。
 */
export interface StorageImageProps {
  /** 公開パスの安定 URL（CloudFront 経由）。`signedUrl` と排他 */
  src?: string
  /** サーバー側で発行した署名付き URL。`src` と排他 */
  signedUrl?: string
  alt: string
  /** 表示幅（CSS px）。段への丸めはここで行う */
  width: number
  height: number
  /** `next/image` の `sizes`。レスポンシブに出すなら必ず渡す */
  sizes?: string
  priority?: boolean
  className?: string
}

export function StorageImage({
  src,
  signedUrl,
  alt,
  width,
  height,
  sizes,
  priority,
  className,
}: StorageImageProps) {
  if ((src === undefined) === (signedUrl === undefined)) {
    throw new Error('StorageImage: src と signedUrl はどちらか一方だけを渡してください')
  }

  // 幅を自前計算させない（1px 刻みだと CDN キャッシュが総崩れする）
  const snapped = snapImageWidth(width)
  const scaledHeight = Math.round((height / width) * snapped)

  if (signedUrl !== undefined) {
    return (
      <Image
        src={signedUrl}
        alt={alt}
        width={snapped}
        height={scaledHeight}
        priority={priority}
        className={className}
        // 署名 URL は transform を後から変えられず毎回変わるため、
        // 最適化を通しても無駄なコストになる。サイズは発行時に確定させている。
        unoptimized
      />
    )
  }

  return (
    <Image
      src={src as string}
      alt={alt}
      width={snapped}
      height={scaledHeight}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  )
}
