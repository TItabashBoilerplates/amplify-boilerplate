---
description: "S3 images must be delivered at display size - never serve originals"
alwaysApply: false
globs: ["frontend/**/*.tsx"]
---
# Storage Images (S3)

**MANDATORY**: **S3 の画像を元サイズのまま配信してはならない。**
`getUrl()` の署名 URL をそのまま `<img>` / `expo-image` に渡すのは禁止。

正本: `/.claude/rules/storage-images.md`

## 使うもの

`@/shared/ui` の **`StorageImage`**（Web / Mobile 共通）。URL 組み立てを自作しない。

- **Web**: `next/image` を必ず通す。Amplify Hosting が Next.js 13+ の画像最適化を
  ビルトインで提供する（上限: 最適化後 4.3MB / Lambda@Edge レスポンス 1MB）。
  `next.config.ts` の `images.remotePatterns` に S3 / CloudFront のホストを登録する
- **Mobile**: 幅の段に丸めた派生を要求する。サーバー側リサイズ（アップロード時の派生生成 or
  Dynamic Image Transformation for CloudFront）が要るので**実装前にユーザーへ確認**

## 規約

- 幅は `IMAGE_WIDTH_LADDER` の段に丸める（`snapImageWidth`）。1px 刻みはキャッシュが総崩れ
- **DB には `path` を保存する。完全な URL / 署名 URL を保存しない**
- 署名は**サーバー側**。一覧に大量の署名 URL を並べない（毎回キャッシュミス）
- アップロード時に縮小 / JPEG・WebP へ変換 / EXIF 除去
