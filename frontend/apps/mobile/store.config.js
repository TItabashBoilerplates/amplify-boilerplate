/**
 * EAS Metadata（App Store の掲載情報を Git 管理する）。**Apple 専用**。
 *
 * 反映: `mobile-metadata`（= `eas metadata:push`）
 *   先に `mobile-release-ios` でバイナリを 1 度提出しておくこと。
 * 参照: https://docs.expo.dev/eas/metadata/
 *
 * ⚠️ **スクリーンショットは EAS Metadata の対象外**（公式の対応表で "Upload screenshots ✗"）。
 *    画像は `store-push-ios-screenshots` が App Store Connect API へ直接送る。
 * ⚠️ **Google Play はこのファイルの対象外**。Play 側は `play.config.js`。
 *
 * ## ASO 設計（Apple 公式仕様に基づく）
 *
 * - 検索インデックスの対象は **title / subtitle / keywords の 3 つだけ**。
 *   description と promoText は **ランキングに影響しない**ので、キーワードを詰め込まず
 *   読み手の意思決定（コンバージョン）に使う。
 * - Apple は **同一ロケール内で** title + subtitle + keywords の語を組み合わせて
 *   検索クエリを作る。したがって **同じ語を複数フィールドに書くのは純粋な無駄**。
 *   例: title に「写真」があるなら keywords は「共有」だけでよい（→「写真 共有」に当たる）。
 * - keywords は **カンマ区切り・スペースなしで合計 100 文字**。
 * - 各ストアフロントで **主ロケールと副ロケールの両方が索引される**が、
 *   **ロケールをまたいで語は結合されない**ので、各ロケール単独で成立させる。
 *
 * ## 上限（超えると push が落ちる）
 *
 * | フィールド | 上限 |
 * |---|---|
 * | title | 30 |
 * | subtitle | 30 |
 * | keywords | 100（カンマ込み） |
 * | promoText | 170 |
 * | description | 4000 |
 */

/**
 * どの App Store バージョンへ流すか。**`app.json` の版を正本にする。**
 *
 * ここを書かないと eas-cli は versionString を持たないまま appStoreVersions を
 * 更新しようとして落ちる（"You must provide a value for the attribute 'versionString'"）。
 * しかも**掲載情報の本体（description / keywords / releaseNotes）はこのバージョンに
 * ぶら下がる**ので、失敗するとアプリ名と年齢レーティングだけ入って本文が空になる。
 *
 * 直書きせず app.json から取るのは、ビルドの CFBundleShortVersionString とずれると
 * **そのビルドを App Store バージョンに紐付けられない**ため。
 */
const { version } = require('./app.json').expo

module.exports = () => {
  // 法務ページ（プライバシーポリシー / 利用規約）を置く本番 Web オリジン。
  // **モジュール先頭ではなくここで読む** — 先頭で読むと最初の評価時の値に固定され、
  // 呼び出し時に設定しても効かない（実際にテストで露見した）。
  const baseUrl = process.env.STORE_WEB_BASE_URL

  // 雛形のまま push して壊れた URL やプレースホルダを登録しないよう、ここで落とす。
  if (!baseUrl) {
    throw new Error(
      'STORE_WEB_BASE_URL is not set. Set it to the production web origin ' +
        '(e.g. https://example.com) before running `mobile-metadata`. ' +
        'See docs/store/submission-checklist.md.'
    )
  }

  return {
    configVersion: 0,
    apple: {
      version,
      copyright: `${new Date().getFullYear()} Your Company`,
      // https://developer.apple.com/app-store/categories/ の値を使う
      categories: ['PRODUCTIVITY'],
      /**
       * 年齢レーティングのアンケート（App Store Connect の Age Rating）。
       *
       * **省略しない。** 2026-01-31 以降、年齢レーティングの質問に答えていないと
       * **アップデートを提出できない**。ここに書いておけば `mobile-metadata`
       * （= `eas metadata:push`）が App Store Connect の
       * `ageRatingDeclarations` へ反映するので、画面で答える必要は無い。
       *
       * 値は下記が「最も制限のない回答」。**実装に合わせて正直に答えること**
       * （申告と実態が食い違うと審査で落ちる。とくにユーザー投稿・チャット・
       * Web ビューを持つアプリは NONE のままにしない）。
       *
       * 各項目は 'NONE' / 'INFREQUENT_OR_MILD' / 'FREQUENT_OR_INTENSE'。
       *
       * ⚠️ **EAS Metadata が扱えない新しい申告がある。** App Store Connect API には
       * `socialMedia` / `socialMediaAgeRestricted` / `ageAssurance` /
       * `userGeneratedContent` / `messagingAndChat` / `lootBox` 等が増えているが、
       * EAS Metadata のスキーマは未対応。とくに **2026 年 9 月以降は
       * 「ソーシャル機能の有無」の申告が提出の必須条件**になるため、
       * 該当する場合は App Store Connect の画面で追加回答が要る
       * （`store-preflight` が案内する）。
       */
      advisory: {
        alcoholTobaccoOrDrugUseOrReferences: 'NONE',
        contests: 'NONE',
        gamblingSimulated: 'NONE',
        horrorOrFearThemes: 'NONE',
        matureOrSuggestiveThemes: 'NONE',
        medicalOrTreatmentInformation: 'NONE',
        profanityOrCrudeHumor: 'NONE',
        sexualContentGraphicAndNudity: 'NONE',
        sexualContentOrNudity: 'NONE',
        violenceCartoonOrFantasy: 'NONE',
        violenceRealistic: 'NONE',
        violenceRealisticProlongedGraphicOrSadistic: 'NONE',
        gambling: false,
        // Web ビューで任意の URL を開けるなら true にする（申告漏れが多い）
        unrestrictedWebAccess: false,
        // Kids カテゴリに出す場合のみ 'FIVE_AND_UNDER' 等を設定する
        kidsAgeBand: null,
        ageRatingOverride: 'NONE',
        koreaAgeRatingOverride: 'NONE',
      },
      info: {
        // ── 主ロケール ────────────────────────────────────────────────────
        ja: {
          // 検索で最も重みが大きい。ブランド + 最上位キーワード
          title: 'アプリ名',
          // title に次いで重い。**title と語を重複させない**
          subtitle: '一番の価値を 30 文字で言い切る',
          // カンマ区切り・スペースなし・合計 100 文字。title/subtitle の語は入れない
          keywords: ['キーワード1', 'キーワード2'],
          // 検索対象外。既存ユーザーへの告知やキャンペーンに使う（審査不要で差し替え可）
          promoText: '',
          // 検索対象外。読み手の意思決定に使う
          description: [
            'このアプリが解決することを 1〜2 行で。',
            '',
            '■ 主な機能',
            '・機能 1',
            '・機能 2',
          ].join('\n'),
          releaseNotes: '初回リリース',
          keywordsLocale: undefined,
          privacyPolicyUrl: `${baseUrl}/privacy`,
          // 定期購入があるなら **利用規約(EULA)の URL は必須**（Apple 3.1.2）
          termsOfUseUrl: `${baseUrl}/terms`,
          supportUrl: `${baseUrl}/support`,
          marketingUrl: baseUrl,
        },
        // ── 副ロケール（各ロケール単独で検索が成立するよう独立して組む）────
        'en-US': {
          title: 'App Name',
          subtitle: 'The clearest promise, briefly',
          keywords: ['keyword1', 'keyword2'],
          promoText: '',
          description: [
            'One or two lines on what this app solves.',
            '',
            'FEATURES',
            '- Feature 1',
            '- Feature 2',
          ].join('\n'),
          releaseNotes: 'Initial release',
          privacyPolicyUrl: `${baseUrl}/privacy`,
          termsOfUseUrl: `${baseUrl}/terms`,
          supportUrl: `${baseUrl}/support`,
          marketingUrl: baseUrl,
        },
      },
    },
  }
}
