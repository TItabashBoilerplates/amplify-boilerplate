---
description: "App Store / Google Play review invariants that code must uphold"
alwaysApply: false
globs: ["frontend/apps/mobile/**"]
---
# Store Review Invariants

正本: `/.claude/rules/store-review.md`

ここに挙げた配線は**壊してもアプリは普通に動く**（ビルドも型も lint も通る）。
気づけるのは審査でリジェクトされたときだけなので、静的検査で CI に止めさせる。

## コードで守るもの

- **第三者 AI へ personal data を送る前に、提供者名と目的を開示して明示的な同意を取る**
  （5.1.2(i)）。同意は端末ローカル。読み取り失敗は未同意として扱う
- **privacy manifest**（`ios.privacyManifests`）を実態と一致させる
- **`targetSdkVersion` 36 以上**（Expo の既定は 35。書かなくてもビルドは通り、
  Play へのアップロードだけが弾かれる）
- **メール + パスワードでのログイン**（OTP のみは 2.1(a) でリジェクト。`/.claude/rules/auth.md`）
- **パスワード再設定 / メールアドレス再設定 / アプリ内アカウント削除**の導線
- ペイウォールに価格・期間・自動更新の明示・購入の復元・EULA / プライバシーポリシー
- 掲載情報（`store.config.js` / `play.config.js`）と実装を一致させる（2.3.1）

## `app.json` を触ったら生成物を実測する

`expo prebuild` して `plutil` / `grep` で確認する。config plugin の適用順で
無言に上書きされることがあり、警告は出ても失敗しない。
