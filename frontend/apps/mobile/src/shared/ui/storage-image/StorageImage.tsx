import { snapImageWidth } from '@workspace/storage-image'
import { Image } from 'expo-image'
import { useEffect, useMemo, useState } from 'react'
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
 * このコンポーネントの仕事ではない。**呼び出し側が「その幅の画像 URL」を返す**:
 *
 * - 公開パス → `buildDerivativePath` の URL を同期で返す
 * - 非公開（既定） → `createSignedImageUrl({ path, width })` を返す（**Promise 可**）
 *
 * 丸めた幅が決まるのは描画時なので、署名は同期では書けない。`resolveUrl` は
 * `Promise<string>` を返してよく、その間はプレースホルダを描画する。
 *
 * ⚠️ 幅ごとの実体（`...@128w.jpg`）は `amplify/functions/image-derivatives` が
 * アップロード時に生成する（`.claude/rules/storage-images.md` §1.2 の方式 A）。
 */
export interface StorageImageProps {
  /**
   * 実ピクセル幅から画像 URL を解決する。
   *
   * 丸めた幅が渡ってくるので、`buildDerivativePath(path, width)` の結果や
   * `createSignedImageUrl({ path, width })` の戻り値をそのまま返せばよい。
   */
  resolveUrl: (pixelWidth: number) => string | Promise<string>
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

  // ⚠️ memo 化は必須。素で呼ぶと**レンダーのたびに新しい Promise** ができ、
  // 下の effect が毎回張り直されて署名 URL を無駄に何度も発行することになる。
  const resolved = useMemo(() => resolveUrl(pixelWidth), [resolveUrl, pixelWidth])

  // 同期で返ってくる経路（公開パス）は state を経由しない。
  // effect の中で同期に setState すると連鎖レンダーになる（react-hooks/set-state-in-effect）。
  const syncUri = typeof resolved === 'string' ? resolved : null
  const [asyncUri, setAsyncUri] = useState<string | null>(null)

  useEffect(() => {
    if (typeof resolved === 'string') return
    let active = true
    resolved
      .then((value) => {
        if (active) {
          setAsyncUri(value)
        }
      })
      .catch((error: unknown) => {
        // 握りつぶさない（`.claude/rules/error-handling.md`）。
        // 画像 1 枚のために画面全体を落とさないので、ログに残して空のまま描画する。
        console.error('[StorageImage] failed to resolve the image URL:', error)
      })
    return () => {
      active = false
    }
  }, [resolved])

  const uri = syncUri ?? asyncUri

  return (
    <Image
      source={uri ? { uri } : undefined}
      style={{ width, height }}
      className={className}
      contentFit={contentFit}
      accessibilityLabel={accessibilityLabel}
      // 端末側の再デコードを避ける（expo-image の既定はメモリ + ディスク）
      cachePolicy="memory-disk"
    />
  )
}
