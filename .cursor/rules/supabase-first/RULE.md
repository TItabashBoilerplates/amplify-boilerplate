---
description: "Supabase-First architecture: Prioritize supabase-js over backend services"
alwaysApply: true
globs: []
---
# Supabase-First Architecture

**MANDATORY**: データ操作は supabase-js を優先。バックエンドは最後の手段。

## 優先順位

1. **supabase-js / @supabase/ssr** (DEFAULT)
2. Edge Functions (必要な場合のみ)
3. backend-py (最後の手段)

## supabase-js を使用すべき場面

- CRUD操作 + RLSポリシー
- リアルタイム購読
- 認証フロー
- ファイルアップロード

## backend-py を使用すべき場面

- 複雑なトランザクション
- AI/ML処理 (LangChain)
- 長時間バックグラウンドジョブ
- Python専用ライブラリが必要な場合

## Storage Policy

- **デフォルト: Private buckets**
- `createSignedUrl` でファイルアクセス
- パス形式: `{resource}/{id}/{filename}`

