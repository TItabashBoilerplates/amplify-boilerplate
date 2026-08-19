import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
  buildDerivativePath,
  IMAGE_WIDTH_LADDER,
  isDerivativePath,
} from '@workspace/storage-image/ladder'
import type { S3Event } from 'aws-lambda'
import { Jimp } from 'jimp'

/**
 * S3 の作成イベントを受けて、幅の段ごとの派生画像を書き出す。
 *
 * 幅の段と派生 path の規約は **`@workspace/storage-image/ladder` が単一の正本**
 * （読む側の `StorageImage` と同じものを使う。2 か所に書くと必ずズレる）。
 */

const s3 = new S3Client({})

/** 派生を作る対象。これ以外の拡張子（HEIC / SVG / 動画）は素通しする */
const SUPPORTED = /\.(jpe?g|png|webp)$/i

/** Jimp が書き出せる MIME。元の拡張子に合わせる（勝手に変換しない） */
function mimeFor(key: string): 'image/jpeg' | 'image/png' {
  return /\.png$/i.test(key) ? 'image/png' : 'image/jpeg'
}

async function toBuffer(body: unknown): Promise<Buffer> {
  // Node 18+ の SDK は Readable を返す。transformToByteArray があればそちらを使う
  const stream = body as { transformToByteArray?: () => Promise<Uint8Array> }
  if (typeof stream.transformToByteArray === 'function') {
    return Buffer.from(await stream.transformToByteArray())
  }
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Buffer>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name
    // S3 のイベントキーは URL エンコードされている（`+` は空白）
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '))

    // 自分が書いた派生でまた発火しないようにする（無限ループ防止）
    if (isDerivativePath(key)) {
      continue
    }
    if (!SUPPORTED.test(key)) {
      console.info(`[image-derivatives] skip unsupported object: ${key}`)
      continue
    }

    try {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      if (!object.Body) {
        throw new Error(`empty body for ${key}`)
      }

      const original = await Jimp.read(await toBuffer(object.Body))
      const mime = mimeFor(key)

      // 元画像より大きい段は作らない（拡大しても情報は増えず転送量だけ増える）
      const widths = IMAGE_WIDTH_LADDER.filter((width) => width <= original.width)
      if (widths.length === 0) {
        console.info(`[image-derivatives] original narrower than the smallest step: ${key}`)
        continue
      }

      for (const width of widths) {
        const derivative = original.clone().resize({ w: width })
        const body = await derivative.getBuffer(mime)
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: buildDerivativePath(key, width),
            Body: body,
            ContentType: mime,
            // 派生は原本から再生成できるので長期キャッシュしてよい
            CacheControl: 'public, max-age=31536000, immutable',
          })
        )
      }

      console.info(`[image-derivatives] ${key}: wrote ${widths.length} derivatives`)
    } catch (error) {
      // 握りつぶさない（`.claude/rules/error-handling.md`）。1 件の失敗で
      // バッチ全体を落とさないため、ログに残して次のレコードへ進む。
      console.error(`[image-derivatives] failed for ${key}:`, error)
      throw error
    }
  }
}
