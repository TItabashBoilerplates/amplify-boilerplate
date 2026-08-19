# Storage 画像ポリシー（S3 の画像は必ず「表示サイズに合わせて」配信する）

**CRITICAL / NON-NEGOTIABLE**: **フロントエンド（Web / Mobile）で表示する画像のうち、
Amplify Storage（S3）に置いてあるものを、元サイズのまま配信してはならない。**
`getUrl()` が返した署名付き URL をそのまま `<img>` / `expo-image` に渡すのは禁止。

実装は `frontend/packages/storage-image`（共通ヘルパ）と各アプリの `@/shared/ui` の
**`StorageImage`** に用意してある。**新しく書くのは呼び出し側だけ**で、URL の組み立てを自作しない。

| 対象 | 使うもの |
|---|---|
| Web（Next.js） | `@/shared/ui` の **`StorageImage`** |
| Mobile（Expo） | `@/shared/ui` の **`StorageImage`** |
| URL だけ欲しい（OGP・メール・API レスポンス等） | `@workspace/storage-image` の `snapImageWidth` / `buildDerivativePath` / `createSignedImageUrl` |

---

## 0. なぜ強制するか

画像は**アプリの転送量の大半を占める**。元画像をそのまま配ると、

- 表示 40px のアバターのために 4MB の JPEG が転送される（**S3 + CloudFront のデータ転送課金**になる）
- LCP が落ちる（モバイル回線ほど致命的）
- 端末側でのデコード・リサイズも無駄に走る

そして**この不具合はレビューで見つからない**。無変換でも画面は正しく表示され、ビルドも型チェックも
lint も通る。気づけるのは請求が上がったとき、あるいは「遅い」と報告されたときだけなので、
**書く時点で強制する**（＋ `storage-image.policy.test.ts` が CI で止める）。

---

## 1. 配信方式（プラットフォームごと）

### 1.1 Web（Next.js / Amplify Hosting）— `next/image` を必ず通す

**Amplify Hosting は Next.js 13 以降の画像最適化をビルトインで提供する**（追加設定不要）。
`next/image` を通すだけで、**表示幅ちょうどにリサイズされ、対応ブラウザには WebP / AVIF** が返る。

```tsx
import { StorageImage } from '@/shared/ui'

// 公開アセット（安定 URL）: srcset がフルに効く
<StorageImage src={publicCoverUrl} width={1200} height={630}
  sizes="(max-width: 768px) 100vw, 1200px" alt="" />

// 非公開: サーバー側で署名して URL だけ渡す（幅は署名時に確定する）
const signedUrl = await createSignedImageUrl({ path: 'media/u1/avatar.jpg', width: 96 })
<StorageImage signedUrl={signedUrl} width={96} height={96} alt="" />
```

**制約（実測値を超えると最適化が失敗する）**:

| 項目 | 上限 |
|---|---|
| 最適化後の画像 | **4.3 MB** |
| Lambda@Edge の画像レスポンス | **1 MB** |

→ 上限を超えるサイズの原本を扱うなら、**アップロード時に上限内へ縮小しておく**（§3）。

**`next.config.ts` の設定が要る**:

- S3 / CloudFront のホストを `images.remotePatterns` に登録する（登録しないと 400 で落ちる）
- `deviceSizes` / `imageSizes` は `IMAGE_WIDTH_LADDER`（§2）と**一致させる**

### 1.2 Mobile（Expo）— 幅の段に丸めた派生を要求する

モバイルには `next/image` も srcset も無い。**表示サイズ（dp）× 端末の DPR** を実ピクセル幅として
1 枚だけ要求する。`StorageImage` が `PixelRatio` を掛けて幅の段に丸めるところまでやる。

```tsx
import { StorageImage } from '@/shared/ui'
import { buildDerivativePath } from '@workspace/storage-image'

// resolveUrl には **丸めた実ピクセル幅**が渡ってくる（PixelRatio は掛け済み）
<StorageImage
  width={320}
  height={180}
  resolveUrl={(pixelWidth) => cdnUrlFor(buildDerivativePath('public/hero/cover.jpg', pixelWidth))}
/>
```

Mobile 側の `StorageImage` は **`resolveUrl(pixelWidth)`** を受け取る（丸めた実ピクセル幅が渡る）。
派生の path 規約は `buildDerivativePath(path, width)`（`media/u1/avatar.jpg` → `media/u1/avatar@128w.jpg`）が
単一の正本で、**生成する側（Lambda）と読む側で同じ規則を 2 か所に書かない**。

**サーバー側でリサイズする仕組みが必要**で、本リポジトリは **方式 A（アップロード時に派生を作る）を
実装済み**（`amplify/functions/image-derivatives`）。**追加の設定なしに `ampx sandbox` で動く。**

| 方式 | 内容 | 本リポジトリ |
|---|---|---|
| **A: アップロード時に派生を作る** | S3 の作成イベントで Lambda を起動し、`IMAGE_WIDTH_LADDER` の各幅の派生を書き出す | ✅ **採用・実装済み** |
| **B: Dynamic Image Transformation for Amazon CloudFront**（AWS Solution。旧 Serverless Image Handler） | CloudFront + Lambda(≤6MB) / ECS(≤100MB) でリクエスト時に変換。Rekognition の smart crop も可 | 幅・切り抜きが**動的**に要るとき、または原本が多く事前生成が無駄になるときに乗り換える |

**A を選んだ理由**: 幅の段は固定（`IMAGE_WIDTH_LADDER`）なのでリクエストごとの変換コストが要らず、
Web / Mobile が同じ派生を共有でき、別スタック（AWS Solution）の運用が増えない。

**画像ライブラリに sharp ではなく jimp を使っている**のは、sharp がネイティブバイナリを含み
esbuild でバンドルできず、デプロイに **Docker かレイヤー**が要るため。boilerplate は
`ampx sandbox` だけで動く状態を保ちたい。アップロード時に固定の段を数枚作るだけなので
スループット差は制約にならず、必要になったら **handler 1 ファイルを差し替える**だけでよい
（path 規約は `@workspace/storage-image/ladder` が持つので他は変わらない）。

> **無限ループに注意**: 派生の書き戻しも同じ S3 作成イベントを起こす。handler は
> `isDerivativePath()` で自分の出力を弾いている。**外すと料金だけが増え続ける。**

---

## 2. 幅は「段」に丸める（キャッシュのため）

`@workspace/storage-image` の **`IMAGE_WIDTH_LADDER`** が生成しうる幅の全集合で、
`snapImageWidth()` が要求幅を「要求以上で最小の段」に丸める。

1px 刻みの幅をそのまま投げると実質すべてキャッシュミスになり、変換のたびにオリジンへ取りに行く
（速度も転送量も悪化する）。**幅を自分で計算して渡さない。**

この段は `apps/web/next.config.ts` の `images.imageSizes` + `images.deviceSizes` と
**一致していなければならない**。ズレたら `storage-image.policy.test.ts` が落ちる。

---

## 3. アップロード時の規約

- **原本をそのまま置かない。** 表示に必要な最大幅（既定は `IMAGE_WIDTH_LADDER` の最大値）へ
  縮小してから `uploadData` する。**Amplify Hosting の最適化上限（4.3MB / 1MB）を超える原本を
  Web に出さない**（§1.1）。
- **HEIC / HEIF をそのまま配らない**（ブラウザが表示できない）。アップロード時に JPEG / WebP へ変換する。
- **EXIF を落とす**（位置情報が入ったまま公開されうる）。
- パスは RESTful な階層に置く（`.claude/rules/aws-first.md` / storage の path 規約）:
  `media/{entity_id}/avatar.jpg` / `public/hero/cover.jpg`。

---

## 4. 非公開（既定）と公開の扱い

本リポジトリの Storage 既定は **非公開**（`media/{entity_id}/*` は本人のみ）。

| 公開性 | Web | Mobile |
|---|---|---|
| **非公開（既定）** | サーバー側で `createSignedImageUrl({ path, width })` → `<StorageImage signedUrl={...} />` | サーバーで発行した URL を `resolveUrl` から返す |
| **公開**（`allow.guest().to(['read'])` を明示したパスのみ） | `<StorageImage src={...} />` | `resolveUrl` で `buildDerivativePath` の URL を返す |

**署名 URL の注意**:

- `getUrl()` の既定有効期限は **900 秒（15 分）**。**この URL は毎回変わる**ので、
  `next/image` の最適化キャッシュはヒットしない（＝ 1 枚ぶんの最適化コストが毎回かかる）。
  **一覧に大量に並ぶ画像を署名 URL で出さない** — 一覧用サムネイルは公開パス（CloudFront 経由）に置く。
- **署名は必ずサーバー側**（Server Component / Server Action / Route Handler）で行う。
- 署名 URL を **DB に保存しない**（期限切れの URL がデータとして残る）。

---

## 5. URL の保存方法

**DB（Amplify Data）には `path` を保存する。完全な URL を保存しない。**

URL ごと保存すると、バケット移行・CloudFront ドメイン変更・公開/非公開の切り替えで
**全レコードが一斉に壊れる**。署名 URL なら期限切れで即座に壊れる。

```ts
// ✅ CORRECT
Avatar: a.model({ imagePath: a.string().required() })   // 'media/<identityId>/avatar.jpg'

// ❌ WRONG
Avatar: a.model({ imageUrl: a.string().required() })    // 署名 URL / CloudFront URL を直接保存
```

---

## 6. 禁止パターン

```tsx
// ❌ 署名 URL をそのまま表示する（無変換 = 元サイズが転送される）
const { url } = await getUrl({ path })
<img src={url.toString()} />
<Image src={url.toString()} width={40} height={40} alt="" unoptimized />

// ❌ URL を文字列で組み立てる
const url = `https://${bucket}.s3.${region}.amazonaws.com/${path}`

// ❌ 幅を段に丸めずに渡す（キャッシュが効かない）
width={containerWidth * devicePixelRatio}

// ❌ next.config.ts の images.remotePatterns を設定せずに next/image を使う（400 で落ちる）
// ❌ images.deviceSizes / imageSizes を IMAGE_WIDTH_LADDER とズラす
// ❌ クライアント側で署名する / 署名 URL を DB に保存する
// ❌ 完全な URL を DB に保存する（移行・ドメイン変更で全行が壊れる）
// ❌ 原本（4MB の JPEG / HEIC / EXIF 付き）をそのまま S3 に置いて配る
```

---

## 7. チェックリスト（画像を表示する実装をしたら必ず）

| # | 確認 |
|---|---|
| 1 | Storage の画像を `StorageImage` 以外で表示していないか |
| 2 | Web は `next/image` を通っているか（`unoptimized` で逃げていないか） |
| 3 | Mobile 向けの派生が生成される path に置いているか（`image-derivatives` の対象拡張子か） |
| 4 | 非公開画像の署名は**サーバー側**か。一覧に大量の署名 URL を並べていないか |
| 5 | `width` / `height` は表示サイズに基づいているか（元サイズを丸投げしていないか） |
| 6 | 幅を自前計算せず `snapImageWidth` / `StorageImage` に任せているか |
| 7 | DB に保存しているのは `path` か（完全な URL でないか） |
| 8 | アップロード時に縮小 / 形式変換 / EXIF 除去をしているか |
| 9 | `next.config.ts` の `remotePatterns` / `imageSizes` / `deviceSizes` が揃っているか |
| 10 | 新しい表示状態を足したなら Storybook のストーリーがあるか（`.claude/rules/ui-testing.md`） |
| 11 | `unit-test` が通るか（`storage-image.test.ts` / `storage-image.policy.test.ts`） |

---

## 8. 実装の置き場所

```
frontend/packages/storage-image/
├── src/index.ts                      # 幅の段・派生 path 規約・署名（共通・単体テスト必須）
│                                     #   IMAGE_WIDTH_LADDER / MAX_IMAGE_WIDTH / snapImageWidth
│                                     #   buildDerivativePath / createSignedImageUrl
│                                     #   IMAGE_OPTIMIZER_LIMITS（Amplify Hosting の 4.3MB / 1MB）
├── src/storage-image.test.ts
└── src/storage-image.policy.test.ts  # 本ポリシーの静的検査（消さない）

frontend/apps/web/src/shared/ui/storage-image/StorageImage.tsx     # next/image 経路
frontend/apps/mobile/src/shared/ui/storage-image/StorageImage.tsx  # resolveUrl(pixelWidth) 経路
frontend/apps/web/next.config.ts                                   # imageSizes/deviceSizes を段から導出
```

```
frontend/packages/backend/amplify/functions/image-derivatives/
├── resource.ts   # defineFunction（S3 作成イベントで起動）
└── handler.ts    # jimp で IMAGE_WIDTH_LADDER の各幅を書き出す
frontend/packages/backend/amplify/backend.ts   # bucket.addEventNotification + grantReadWrite
```

> **`src/ladder.ts` は `aws-amplify` に依存しない**。派生を生成する Lambda が
> ブラウザ SDK を持ち込まずに同じ規約を import できるようにするため
> （生成側と読む側で規則を 2 か所に書かない）。

---

## 9. 強制事項

このポリシーは**交渉の余地なし**。

- **S3 の画像を元サイズで表示する実装はレビューで却下**する。
- **`storage-image.policy.test.ts` の無効化・削除も却下**する（この不具合は静的検査でしか止まらない）。
- 「開発者から指示が無かった」は理由にならない。**指示を待たずに最初からサイズを合わせる**。
- **`image-derivatives` の無限ループ防止（`isDerivativePath`）を外す変更は却下**する。
- 方式 B（CloudFront の Dynamic Image Transformation）へ乗り換える場合は、別スタックの
  運用が増えるので**実装前にユーザーへ確認**する。

## 参考

- [Amplify Hosting: SSR でサポートされる機能（画像最適化）](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html) — Next.js 13+ は設定不要 / 4.3MB・1MB の上限
- [Amplify Gen2: Storage `getUrl`](https://docs.amplify.aws/react/build-a-backend/storage/download-files/) — 署名 URL（既定 900 秒）
- [Dynamic Image Transformation for Amazon CloudFront](https://aws.amazon.com/solutions/implementations/dynamic-image-transformation-for-amazon-cloudfront/) — リクエスト時変換（Lambda ≤6MB / ECS ≤100MB）
- [Next.js: Image `loader` / `deviceSizes` / `imageSizes` / `remotePatterns`](https://nextjs.org/docs/app/api-reference/components/image)
- `.claude/rules/aws-first.md` / `.claude/rules/ui-testing.md` / `.claude/skills/amplify-gen2/references/storage.md`
