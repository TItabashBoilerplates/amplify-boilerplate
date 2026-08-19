import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IMAGE_WIDTH_LADDER } from './ladder'

/**
 * S3 画像配信ポリシーの静的検査
 *
 * `.claude/rules/storage-images.md` の不変条件をコードに固定する。ここで検査しているものは
 * **壊してもアプリは普通に動く**（ビルドも型チェックも lint も通る）。気づけるのは
 * S3 / CloudFront の転送量請求か、遅いページを誰かが報告したときだけなので、CI で止める。
 *
 * 検査するのは「画像を描画するファイルが S3 の URL を自前で組み立てていないか」。
 * 画像以外（PDF 等）の署名 URL 発行までは禁止しない。
 */

const FRONTEND_ROOT = resolve(__dirname, '../../..')
const APP_SOURCE_DIRS = [
  join(FRONTEND_ROOT, 'apps/web/src'),
  join(FRONTEND_ROOT, 'apps/mobile/src'),
]

/** ポリシーの実装本体（ここだけは Storage の URL を組み立ててよい） */
const POLICY_IMPLEMENTATION = [
  'apps/web/src/shared/ui/storage-image',
  'apps/mobile/src/shared/ui/storage-image',
]

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) return listSourceFiles(fullPath)
    return /\.tsx?$/.test(entry) && !/\.(test|stories)\.tsx?$/.test(entry) ? [fullPath] : []
  })
}

function collectAppSources(): { relativePath: string; content: string }[] {
  return APP_SOURCE_DIRS.flatMap(listSourceFiles).map((path) => ({
    relativePath: relative(FRONTEND_ROOT, path),
    content: readFileSync(path, 'utf-8'),
  }))
}

function isPolicyImplementation(relativePath: string): boolean {
  return POLICY_IMPLEMENTATION.some((dir) => relativePath.startsWith(dir))
}

const APP_SOURCES = collectAppSources()

describe('S3 の URL を自前で組み立てない', () => {
  /**
   * ドメインを文字列で組み立てると、バケット移行 / リージョン変更 / 公開設定の切替で
   * **全箇所が一斉に壊れる**。しかも壊れ方は「画像が出ない」だけなので気づきにくい。
   */
  it('s3.amazonaws.com を含む URL をハードコードしていない', () => {
    const offenders = APP_SOURCES.filter(
      (file) =>
        !isPolicyImplementation(file.relativePath) &&
        /s3[.-][\w-]*\.?amazonaws\.com/.test(file.content)
    ).map((file) => file.relativePath)
    expect(offenders, `S3 のホストを直書きしている: ${offenders.join(', ')}`).toEqual([])
  })

  /**
   * `getUrl()` の戻り値をそのまま `<img>` / `expo-image` に渡すと**原本が転送される**。
   * 画像は `StorageImage` 経由に限る。
   */
  it('画像描画ファイルが getUrl を直接呼んでいない', () => {
    const offenders = APP_SOURCES.filter((file) => {
      if (isPolicyImplementation(file.relativePath)) return false
      const rendersImage = /<(?:Image|img)[\s>]/.test(file.content)
      return rendersImage && /\bgetUrl\s*\(/.test(file.content)
    }).map((file) => file.relativePath)
    expect(
      offenders,
      `getUrl() の結果を直接描画している（StorageImage を使う）: ${offenders.join(', ')}`
    ).toEqual([])
  })
})

describe('next.config.ts と幅の段が一致している', () => {
  const nextConfig = readFileSync(join(FRONTEND_ROOT, 'apps/web/next.config.ts'), 'utf-8')

  /**
   * 段がズレると Next が生成する srcset の幅と派生（`...@128w.jpg`）が食い違い、
   * **Mobile だけ 404** になる。config 側で段を再定義していないことを固定する。
   */
  it('imageSizes / deviceSizes を IMAGE_WIDTH_LADDER から導出している', () => {
    expect(nextConfig).toContain("from '@workspace/storage-image'")
    expect(nextConfig).toContain('IMAGE_WIDTH_LADDER')
    // 段の数値を config 側で列挙し直していないこと（二重管理の防止）
    expect(nextConfig).not.toMatch(/imageSizes:\s*\[\s*\d/)
    expect(nextConfig).not.toMatch(/deviceSizes:\s*\[\s*\d/)
  })

  /** 登録しないと `next/image` が 400 で落ちる */
  it('remotePatterns に S3 / CloudFront を登録している', () => {
    expect(nextConfig).toContain('remotePatterns')
    expect(nextConfig).toContain('amazonaws.com')
    expect(nextConfig).toContain('cloudfront.net')
  })

  /** Amplify Hosting の最適化上限（4.3MB）を超えない段であること */
  it('段の最大値が Amplify Hosting の実用範囲に収まっている', () => {
    expect(Math.max(...IMAGE_WIDTH_LADDER)).toBeLessThanOrEqual(2500)
  })
})

describe('unoptimized で逃げていない（Web）', () => {
  /**
   * `unoptimized` を付けると `next/image` を通しても**原本が配られる**。
   * 署名 URL（毎回変わる）を扱う `StorageImage` の内部実装だけが例外。
   */
  it('StorageImage 以外で unoptimized を使っていない', () => {
    const offenders = APP_SOURCES.filter(
      (file) => !isPolicyImplementation(file.relativePath) && /\bunoptimized\b/.test(file.content)
    ).map((file) => file.relativePath)
    expect(offenders, `unoptimized を使っている: ${offenders.join(', ')}`).toEqual([])
  })
})
