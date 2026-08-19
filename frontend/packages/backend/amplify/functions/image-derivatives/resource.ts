import { defineFunction } from '@aws-amplify/backend'

/**
 * S3 の作成イベントで**幅の段ごとの派生画像**を書き出す Lambda。
 *
 * `.claude/rules/storage-images.md` §1.2 の **方式 A（アップロード時に派生を作る）**。
 * Mobile には `next/image` も srcset も無いため、表示サイズに合わせて配るには
 * 「その幅の実体」がバケットに存在している必要がある。
 *
 * ## なぜ sharp ではなく jimp か
 *
 * sharp はネイティブバイナリを含むため esbuild でバンドルできず、デプロイ時に
 * **Docker（`bundling.nodeModules`）か Lambda レイヤー**が要る。boilerplate は
 * `ampx sandbox` だけで動く状態を保ちたいので、**純 JS の jimp**（MIT / 週 200 万 DL 超 /
 * 型同梱）を使う。アップロード時に固定の段を数枚作るだけなので、スループット差は
 * 実運用の制約にならない。処理量が増えたら **この 1 ファイルを sharp に差し替える**
 * （path 規約は `@workspace/storage-image/ladder` が持つので他は変わらない）。
 *
 * ## 注意
 *
 * - `memoryMB` は画像デコードのピークに効く。Lambda は**メモリに比例して CPU も増える**
 *   ので、小さくすると単に遅くなる（時間課金なのでコストはあまり変わらない）。
 * - 派生の書き戻しが再びイベントを起こすため、handler が `isDerivativePath` で自分の
 *   出力を弾く。**弾かないと無限ループになり料金だけが増え続ける。**
 */
export const imageDerivatives = defineFunction({
  name: 'image-derivatives',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 120,
  memoryMB: 1536,
})
