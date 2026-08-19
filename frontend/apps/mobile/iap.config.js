/**
 * アプリ内課金（サブスクリプション）の定義。**両ストア共通の正本**。
 *
 * 反映:
 *   store-create-ios-subscriptions   … App Store Connect に商品を作る
 *   store-equalize-ios-prices        … 販売地域すべてへ等価価格を展開する
 *   store-create-play-subscriptions  … Google Play に商品を作る
 *   store-create-play-offers         … Play の無料トライアル（offer）を作って有効化する
 *
 * ## なぜ 1 ファイルにまとめるか
 *
 * iOS と Android で商品定義を別々に持つと、**片方だけ価格や説明を直した状態**が
 * 必ず生まれる（「機能を削ったのに Play の商品説明だけ古い」が実際に起きる）。
 * ストアごとに違うのは構造（下記）だけなので、値は 1 か所に置き、
 * 各スクリプトがそれぞれの API 形へ変換する。
 *
 * ## iOS と Play の構造の違い（値ではなく形が違う）
 *
 * | | App Store | Google Play |
 * |---|---|---|
 * | 階層 | サブスクリプショングループ → 商品 | 商品 → 基本プラン → オファー |
 * | 無料トライアル | 商品の「導入オファー」を**地域ごとに 1 件** | 基本プランに紐づく **offer**（別スクリプト） |
 * | 地域価格 | Apple の `equalizations` が返す等価価格 | `pricing:convertRegionPrices` に換算させる |
 * | 作成直後の状態 | 価格・地域が揃うまで MISSING_METADATA | 基本プラン・オファーは **DRAFT**（activate が要る） |
 *
 * どちらも**為替を自前で計算しない**（ストア自身に換算させる）。
 *
 * ## 前提（これが無いと商品は永久に「準備中」のまま）
 *
 * - App Store: **有料 App 契約が有効**であること。未締結だと商品は
 *   MISSING_METADATA のままで、StoreKit からも 1 件も返らない
 * - Google Play: アプリが 1 度でも公開トラックへ提出済みであること
 *
 * ## 商品 ID は後から変えられない
 *
 * `productId` はストア側の一意キーで、**リネームできない**（作り直すと購入履歴が切れる）。
 * アプリ側の権限判定コードと必ず同じ文字列を使うこと。
 */

/**
 * 基準価格の通貨。ここを基準にストア自身が各地域へ換算する。
 * `baseTerritory` は App Store 側で基準価格ポイントを引く地域コード（ISO 3 文字）。
 */
const baseCurrency = 'JPY'
const baseTerritory = 'JPN'

/**
 * 無料トライアル。**enum はストアごとに別物なので両方を明示する**（推測しない）。
 * App Store の enum に `SEVEN_DAYS` は無く、7 日は `ONE_WEEK`。
 * 不要なら `freeTrial: null` にする。
 */
const freeTrial = {
  apple: { duration: 'ONE_WEEK', offerMode: 'FREE_TRIAL', numberOfPeriods: 1 },
  play: { offerId: 'freetrial7d', duration: 'P7D' },
}

/**
 * App Store のサブスクリプショングループ。
 * 同一グループ内の商品はユーザーが自由にアップ/ダウングレードできる。
 * **導入オファーはグループ単位で 1 回**しか取れない（月額で試した人は年額で取れない）。
 */
const group = {
  referenceName: 'Premium',
  localizations: [
    { locale: 'ja', name: 'プレミアム' },
    { locale: 'en-US', name: 'Premium' },
  ],
}

/**
 * 販売する商品。
 *
 * ⚠️ **雛形なので既定は空**。ここへ商品を書くと、上記スクリプトが実際に
 * ストアへ商品を作成する（作成した商品 ID は消せない）。中身を埋めてから使うこと。
 *
 * 記述例:
 *
 * ```js
 * {
 *   productId: 'premium_monthly',       // 両ストア共通。後から変更不可
 *   referenceName: 'Premium Monthly',   // ストア管理画面での表示名（ユーザーには出ない）
 *   basePrice: 480,                     // baseCurrency 建て
 *   apple: { subscriptionPeriod: 'ONE_MONTH' },
 *   play: { basePlanId: 'monthly', billingPeriodDuration: 'P1M' },
 *   localizations: [
 *     {
 *       apple: 'ja',
 *       play: 'ja-JP',
 *       name: 'プレミアム（月額）',
 *       description: '広告の非表示と、すべての機能の上限解除。',
 *       benefits: ['広告の非表示', '上限なしで利用できる'],  // Play のみ（最大 4 件）
 *     },
 *     {
 *       apple: 'en-US',
 *       play: 'en-US',
 *       name: 'Premium (Monthly)',
 *       description: 'Removes ads and unlocks every limit.',
 *       benefits: ['No ads', 'No usage limits'],
 *     },
 *   ],
 * }
 * ```
 *
 * `apple.subscriptionPeriod` の enum: ONE_WEEK / ONE_MONTH / TWO_MONTHS /
 * THREE_MONTHS / SIX_MONTHS / ONE_YEAR。
 * `play.billingPeriodDuration` は ISO 8601 duration（P1W / P1M / P3M / P6M / P1Y）。
 */
const products = []

module.exports = { baseCurrency, baseTerritory, freeTrial, group, products }
