import { snapImageWidth } from '@workspace/storage-image'
import { Image } from 'expo-image'
import { PixelRatio } from 'react-native'

/**
 * Amplify Storage（S3）の画像を **表示サイズに合わせて**表示する（Mobile）。
 *
 * ## Web との違い
 *
 * モバイルには `next/image` も srcset も無い。**表示サイズ（dp）× 端末の DPR** を
 * 実ピクセル幅として 1 枚だけ要求する。丸めはこのコンポーネントが行うので、
 * **呼び出し側で `PixelRatio` を掛けないこと**（1px 刻みだと CDN キャッシュが総崩れする）。
 *
 * ## URL は誰が作るか
 *
 * S3 には Supabase のようなリクエスト時変換 API が無いので、URL を組み立てるのは
 * このコンポーネントの仕事ではない。**呼び出し側が「その幅の画像 URL」を渡す**:
 *
 * - 公開パス → `resolveUrl(width)` で `buildDerivativePath` 済みの URL を返す
 * - 非公開 → サーバー側で `createSignedImageUrl({ path, width })` を発行して渡す
 *
 * ⚠️ **派生を生成する仕組み（S3 イベントの Lambda など）が未導入の場合**、
 * アップロード時に `MAX_IMAGE_WIDTH` 以下へ縮小して保存する運用（＝原本を持たない）が
 * 最低ラインになる（`.claude/rules/storage-images.md` §1.2 / §3）。
 */
export interface StorageImageProps {
  /**
   * 実ピクセル幅から画像 URL を解決する。
   *
   * 丸めた幅が渡ってくるので、`buildDerivativePath(path, width)` の結果や
   * サーバーで発行した署名 URL をそのまま返せばよい。
   */
  resolveUrl: (pixelWidth: number) => string
  /** 表示幅（dp） */
  width: number
  /** 表示高さ（dp） */
  height: number
  accessibilityLabel?: string
  className?: string
  contentFit?: 'cover' | 'contain' | 'fill'
}

export function StorageImage({
  resolveUrl,
  width,
  height,
  accessibilityLabel,
  className,
  contentFit = 'cover',
}: StorageImageProps) {
  // dp → 実ピクセル。段に丸めてキャッシュを効かせる
  const pixelWidth = snapImageWidth(PixelRatio.getPixelSizeForLayoutSize(width))

  return (
    <Image
      source={{ uri: resolveUrl(pixelWidth) }}
      style={{ width, height }}
      className={className}
      contentFit={contentFit}
      accessibilityLabel={accessibilityLabel}
      // 端末側の再デコードを避ける（expo-image の既定はメモリ + ディスク）
      cachePolicy="memory-disk"
    />
  )
}
