/**
 * Google Play の掲載情報（Git 管理）。App Store 側の `store.config.js` と対になる。
 *
 * 反映: `store-push-play-listing`（文言 + アイコン + スクショを 1 つの edit で commit）
 *
 * ## なぜ store.config.js と共有しないのか
 *
 * 同じアプリの説明でも、**両ストアで別物として書く必要がある**:
 *
 * - **上限が違う**（Play: title 30 / 短い説明 80 / 詳細 4000。
 *   App Store: title 30 / subtitle 30 / description 4000 + keywords 100）
 * - **課金の定型文が違う**。App Store は「App Store アカウントに請求されます」、
 *   Play は Google Play の解約導線を案内する必要がある
 * - **検索の当たり方が違う**。App Store は keywords が独立していて description は
 *   検索対象外だが、**Play は詳細な説明が検索インデックスの対象**。したがって
 *   Play 側は説明文の中に自然な形でキーワードを含める
 *
 * 共通化すると必ずどちらかの規約に引きずられるので、意図的に別ファイルにしている。
 * ただし**事実（無料枠の値・機能の有無・価格）は必ず一致させること**。
 * 食い違うと Apple 2.3.1（不正確なメタデータ）の指摘対象になる。
 */

/** Play の上限。`store-push-play-listing` が送信前に検証する */
const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 }

const ja = {
  language: 'ja-JP',
  // 30 文字以内。App Store の title と揃える（同じアプリが別名で出ると信頼を損ねる）
  title: 'アプリ名',
  // 80 文字以内。検索結果と一覧でタイトルの下に出る 1 行
  shortDescription: '一番の価値を 80 文字で言い切る',
  // 4000 文字以内。**Play では検索対象**なので、自然な文章のままキーワードを含める
  fullDescription: [
    'このアプリが解決することを 1〜2 行で。',
    '',
    '■ 主な機能',
    '機能の説明。ユーザーが何をできるようになるかを書く。',
    '',
    '■ 無料でどこまで使えるか',
    '無料プランの範囲と、上限がある機能を具体的な数値で書く。',
    '',
    // 定期購入がある場合は以下の定型文を必ず入れる（無い場合は削除する）
    'お支払いは Google Play アカウントに請求されます。定期購入は、期間終了の 24 時間前までに自動更新をオフにしない限り自動更新されます。購入後は Google Play の [定期購入] からいつでも管理・解約できます。',
    '',
    '利用規約とプライバシーポリシーは、アプリ内および掲載のリンクからご確認いただけます。',
  ].join('\n'),
}

const en = {
  language: 'en-US',
  title: 'App Name',
  shortDescription: 'The single clearest promise, in 80 characters',
  fullDescription: [
    'One or two lines on what this app solves.',
    '',
    'FEATURES',
    'What the user can now do.',
    '',
    'WHAT THE FREE PLAN INCLUDES',
    'The free tier and any limits, with concrete numbers.',
    '',
    'Payment is charged to your Google Play account. Subscriptions renew automatically unless auto-renew is turned off at least 24 hours before the end of the current period. You can manage or cancel your subscription in Google Play > Subscriptions at any time.',
    '',
    'Terms of use and the privacy policy are available in the app and from the links on this listing.',
  ].join('\n'),
}

/**
 * フィーチャーグラフィック（1024x500）。**Play では公開に必須**。
 *
 * 生成: `build-play-feature-graphic` → `assets/store/play-feature-graphic.png`
 * 生成物は**リポジトリにコミットする**。アイコン（純粋な縮小）と違い、これは配置・
 * 書体・コピーという設計判断を含む成果物なので、派生物ではなく素材として扱う。
 *
 * ⚠️ **文字は小さく写る。** 一覧では横 1024px より遥かに小さく表示され、端は
 * 見切れることがある。ロゴと 2〜3 語だけに絞り、説明文をここに書かない。
 */
const featureGraphic = {
  // アイコンから四隅の地色を抜いてロゴマークとして使う。背景はこの色で塗る
  backgroundColor: '#ffffff',
  titleColor: '#111111',
  subtitleColor: '#555555',
  title: 'App Name',
  // 1 行ずつ。折り返しはしないので短く保つ（2 行まで）
  subtitle: ['短いキャッチコピーを', '2 行までで'],
}

module.exports = { LIMITS, featureGraphic, listings: [ja, en] }
