---
description: "Research-First policy: Always verify documentation before implementation"
alwaysApply: true
globs: []
---
# Research-First Development

**MANDATORY**: 実装前に必ず公式ドキュメントを確認すること。

## 禁止事項

- 推測・記憶・一般知識に基づく実装
- 「たぶんこうだろう」という推測での実装
- 古いAPIやパターンの使用

## 調査が必須な場面

- ライブラリ/フレームワークの使用時
- 認証・セキュリティ機能の実装
- ビルドツール・設定ファイルの編集
- CLI ツールの使用

## 調査方法

1. Context7 MCP で最新ドキュメント取得
2. WebSearch で現在のベストプラクティス確認
3. WebFetch で公式ドキュメント直接参照

