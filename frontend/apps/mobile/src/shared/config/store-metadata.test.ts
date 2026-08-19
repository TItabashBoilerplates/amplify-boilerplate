/**
 * ストア掲載情報・課金商品の定義が、**送る前に**壊れていないかを検証する。
 *
 * ここで見ているのは「ストア側で弾かれると原因が分かりにくいもの」だけ:
 *
 * | 検査 | 弾かれ方 |
 * |---|---|
 * | 文字数上限 | App Store は push が落ちる。Play は **commit 時**に落ちるので原因が遠い |
 * | ASO の語の重複 | エラーにならない。**検索の機会を黙って捨てる**だけなので気づけない |
 * | 商品定義の不整合 | 商品が作られない / 片方のストアにだけ出る |
 *
 * 実装は `frontend/apps/mobile/{store,play,iap}.config.js`。
 * 反映は `scripts/mobile/store.sh`（`.claude/rules/store-review.md`）。
 */
import { describe, expect, it } from 'vitest'

// biome-ignore lint/suspicious/noExplicitAny: 設定ファイルは CJS なので構造の型は持たない
const load = async (name: string): Promise<any> => {
  const mod = await import(`../../../${name}.config.js`)
  const value = mod.default ?? mod
  return typeof value === 'function' ? value() : value
}

/** App Store の上限（超えると eas metadata:push が落ちる） */
const APPLE_LIMITS = {
  title: 30,
  subtitle: 30,
  promoText: 170,
  description: 4000,
} as const

/** keywords はカンマ区切り・スペースなしで合計 100 文字 */
const APPLE_KEYWORDS_LIMIT = 100

describe('store.config.js（App Store の掲載情報）', () => {
  // metadata:push は本番の掲載情報を書き換えるので、雛形のまま流れないことを保証する
  it('STORE_WEB_BASE_URL が未設定なら読み込みで落ちる', async () => {
    const previous = process.env.STORE_WEB_BASE_URL
    process.env.STORE_WEB_BASE_URL = ''
    try {
      await expect(load('store')).rejects.toThrow(/STORE_WEB_BASE_URL/)
    } finally {
      if (previous === undefined) delete process.env.STORE_WEB_BASE_URL
      else process.env.STORE_WEB_BASE_URL = previous
    }
  })

  describe('設定済みのとき', () => {
    const withBaseUrl = async () => {
      const previous = process.env.STORE_WEB_BASE_URL
      process.env.STORE_WEB_BASE_URL = 'https://example.com'
      try {
        return await load('store')
      } finally {
        if (previous === undefined) delete process.env.STORE_WEB_BASE_URL
        else process.env.STORE_WEB_BASE_URL = previous
      }
    }

    it('app.json の version を使う（直書きするとビルドと紐付かなくなる）', async () => {
      const config = await withBaseUrl()
      const { version } = require('../../../app.json').expo
      expect(config.apple.version).toBe(version)
    })

    it('各ロケールが文字数上限に収まっている', async () => {
      const config = await withBaseUrl()
      for (const [locale, info] of Object.entries<Record<string, string>>(config.apple.info)) {
        for (const [field, max] of Object.entries(APPLE_LIMITS)) {
          const value = info[field] ?? ''
          expect(
            value.length,
            `${locale}.${field} が ${value.length} 文字（上限 ${max}）`
          ).toBeLessThanOrEqual(max)
        }
      }
    })

    it('keywords がカンマ区切りで 100 文字に収まっている', async () => {
      const config = await withBaseUrl()
      for (const [locale, info] of Object.entries<{ keywords?: string[] }>(config.apple.info)) {
        const joined = (info.keywords ?? []).join(',')
        expect(
          joined.length,
          `${locale}.keywords が ${joined.length} 文字（上限 ${APPLE_KEYWORDS_LIMIT}）`
        ).toBeLessThanOrEqual(APPLE_KEYWORDS_LIMIT)
      }
    })

    // Apple は同一ロケール内で title + subtitle + keywords の語を組み合わせて
    // 検索クエリを作る。**同じ語を複数フィールドに書くのは純粋な無駄**。
    it('title / subtitle / keywords で語が重複していない', async () => {
      const config = await withBaseUrl()
      for (const [locale, info] of Object.entries<{
        title: string
        subtitle: string
        keywords?: string[]
      }>(config.apple.info)) {
        const keywords = (info.keywords ?? []).map((k) => k.toLowerCase())
        const heading = `${info.title} ${info.subtitle}`.toLowerCase()
        const wasted = keywords.filter((k) => heading.includes(k))
        expect(
          wasted,
          `${locale}: keywords ${wasted.join(', ')} が title/subtitle と重複している`
        ).toEqual([])
      }
    })

    it('定期購入の要件になる法務 URL が全ロケールにある', async () => {
      const config = await withBaseUrl()
      for (const [locale, info] of Object.entries<Record<string, string>>(config.apple.info)) {
        expect(info.privacyPolicyUrl, `${locale}.privacyPolicyUrl`).toBeTruthy()
        // 自動更新サブスクがある場合 EULA の URL は必須（Apple 3.1.2）
        expect(info.termsOfUseUrl, `${locale}.termsOfUseUrl`).toBeTruthy()
      }
    })
  })
})

describe('play.config.js（Google Play の掲載情報）', () => {
  it('宣言した上限に全ロケールが収まっている', async () => {
    const { LIMITS, listings } = await load('play')
    for (const listing of listings) {
      for (const [field, max] of Object.entries<number>(LIMITS)) {
        const value = listing[field] ?? ''
        expect(
          value.length,
          `${listing.language}.${field} が ${value.length} 文字（上限 ${max}）`
        ).toBeLessThanOrEqual(max)
      }
    }
  })

  it('フィーチャーグラフィックの見出しが短い（一覧では小さく写る）', async () => {
    const { featureGraphic } = await load('play')
    expect(featureGraphic.subtitle.length).toBeLessThanOrEqual(2)
    for (const line of featureGraphic.subtitle) {
      expect(line.length, `"${line}" が長すぎる`).toBeLessThanOrEqual(30)
    }
  })
})

describe('iap.config.js（アプリ内課金）', () => {
  it('productId が重複していない（ストア側の一意キー）', async () => {
    const { products } = await load('iap')
    const ids = products.map((p: { productId: string }) => p.productId)
    expect(new Set(ids).size, `重複: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('全商品が両ストアぶんの定義を持つ', async () => {
    const { products } = await load('iap')
    for (const p of products) {
      expect(p.basePrice, `${p.productId}.basePrice`).toBeGreaterThan(0)
      expect(p.apple?.subscriptionPeriod, `${p.productId}.apple`).toBeTruthy()
      expect(p.play?.basePlanId, `${p.productId}.play.basePlanId`).toBeTruthy()
      expect(p.play?.billingPeriodDuration, `${p.productId}.play.billingPeriodDuration`).toMatch(
        /^P\d+[DWMY]$/
      )
    }
  })

  // 片方のストアにだけロケールがある状態を防ぐ。
  // 「iOS では日本語なのに Play では英語のまま」が実際に起きる形。
  it('全ロケールが apple / play 両方のコードを持つ', async () => {
    const { products } = await load('iap')
    for (const p of products) {
      for (const l of p.localizations ?? []) {
        expect(l.apple, `${p.productId} の localization に apple が無い`).toBeTruthy()
        expect(l.play, `${p.productId} の localization に play が無い`).toBeTruthy()
        expect(l.name, `${p.productId}/${l.apple} の name`).toBeTruthy()
        expect(l.description, `${p.productId}/${l.apple} の description`).toBeTruthy()
        // Play の benefits は最大 4 件（超えると作成が落ちる）
        expect((l.benefits ?? []).length).toBeLessThanOrEqual(4)
      }
    }
  })

  it('無料トライアルは両ストアの enum を明示している', async () => {
    const { freeTrial } = await load('iap')
    if (freeTrial === null) return
    // App Store の enum に SEVEN_DAYS は無く、7 日は ONE_WEEK。
    // 片方だけ書くと「iOS はトライアルあり / Play は無し」になる
    expect(freeTrial.apple?.duration).toBeTruthy()
    expect(freeTrial.apple?.offerMode).toBe('FREE_TRIAL')
    expect(freeTrial.play?.offerId).toBeTruthy()
    expect(freeTrial.play?.duration).toMatch(/^P\d+[DWMY]$/)
  })

  it('グループのローカライズが空でない（App Store の必須項目）', async () => {
    const { group } = await load('iap')
    expect(group.referenceName).toBeTruthy()
    expect(group.localizations.length).toBeGreaterThan(0)
  })
})
