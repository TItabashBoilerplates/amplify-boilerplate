# Pre-existing 型エラーの解消（schema.ts 再生成 + vitest.config.ts 型整合）

## メタ情報
- **状態**: completed
- **優先度**: medium
- **作成日**: 2026-04-28
- **更新日**: 2026-04-28
- **担当エージェント**: task-executor
- **完了コミット**: `e48ca42 fix(frontend): unblock type-check (vitest dedupe + native-ui paths)`

## 概要

`task 0001-rename-ui-web-to-ui.md` 実行時に検出された **rename 起因ではない pre-existing 型エラー**を解消する。これらは HEAD `ea4dea7` 時点で既に存在していたものであり、リファクタリングの一連のコミットを進めるためにいったん別タスクへ分離した。

主因は次の 2 つ:

1. **`frontend/packages/types/schema.ts` が空** → Supabase Docker が起動していない or `devenv tasks run model:build` が未実行
2. **`frontend/vitest.config.ts` の rolldown/rollup プラグイン型不整合** → `vitest` / `vite` の依存ツールチェイン更新による drift

これらの結果として frontend で 17 件の TS エラーが発生し、`type-check-frontend` および `ci-check` が red になっている。

## 完了条件

- [ ] `frontend/packages/types/schema.ts` に Supabase の最新スキーマ（`users`, `subscriptions` 含む）が反映されている
- [ ] `apps/web/src/entities/user/model/types.ts` の `Tables<'users'>` が解決できる
- [ ] `apps/web/src/features/subscription/api/getSubscription.ts` が `subscriptions` テーブルにアクセスできる
- [ ] `frontend/vitest.config.ts` がプラグイン型不整合なくビルドできる
- [ ] `type-check-frontend` が green
- [ ] `ci-check` が green
- [ ] `test-frontend` が green

## サブタスク

- [ ] `supabase-start` で Supabase ローカル（Docker）を起動
- [ ] `devenv tasks run model:build` を実行して `frontend/packages/types/schema.ts` および `supabase/functions/shared/types/supabase/schema.ts` を再生成
- [ ] 再生成された schema.ts が `users` / `subscriptions` 等のテーブル型を含むことを確認
- [ ] `frontend/vitest.config.ts` の rolldown/rollup プラグイン型不整合を調査し、適切な型キャストまたはツールチェイン更新で解消
  - 必要に応じて `vitest`, `vite`, 関連プラグインのバージョンを Context7 / WebSearch で調査して整合性を取る
- [ ] `type-check-frontend` で 0 エラーになることを確認
- [ ] `ci-check` を実行し全 green を確認

## 依存関係

- **前提タスク**: なし（task 0001 とは独立）
- **ブロッカー**: Supabase Docker が起動可能であること（DB ポート 5432, ローカル env 設定）

## 技術メモ

### Pre-existing エラー詳細（task 0001 で検出）

```
apps/web/src/entities/user/model/types.ts(6,27): TS2344
apps/web/src/entities/user/model/types.ts(11,34): TS2344
apps/web/src/entities/user/ui/UserAvatar.tsx(38,10): TS2339 'display_name'
apps/web/src/entities/user/ui/UserAvatar.tsx(38,56): TS2339 'account_name'
apps/web/src/entities/user/ui/UserAvatar.tsx(43,46): TS2339 'display_name'
apps/web/src/entities/user/ui/UserAvatar.tsx(43,67): TS2339 'account_name'
apps/web/src/features/subscription/api/getSubscription.ts(21,11): TS2769 'subscriptions'
apps/web/src/features/subscription/api/getSubscription.ts(35-44): TS2339 各 columns
```

### 再生成コマンド

```bash
# 1. Supabase 起動（Docker）
supabase-start

# 2. 型再生成（model:build = model:frontend + model:functions）
devenv tasks run model:build

# 3. 検証
type-check-frontend
ci-check
```

### auto-generated.md ルール

`schema.ts` は `.claude/rules/auto-generated.md` により**手動編集禁止**。再生成のみで解消すること。

### vitest.config.ts の型問題

`frontend/vitest.config.ts` の `defineConfig` 引数で rolldown/rollup の Plugin 型が drift している可能性がある。
- Context7 で `vitest` / `vite` の最新 API を確認
- 必要に応じて `as Plugin` などの型キャストではなく、依存バージョン整合で解決

## 進捗ログ

（task-executor が実行時に追記）

## 関連ファイル

- `frontend/packages/types/schema.ts` (auto-generated, regenerate via `model:build`)
- `supabase/functions/shared/types/supabase/schema.ts` (auto-generated)
- `frontend/apps/web/src/entities/user/model/types.ts`
- `frontend/apps/web/src/entities/user/ui/UserAvatar.tsx`
- `frontend/apps/web/src/features/subscription/api/getSubscription.ts`
- `frontend/vitest.config.ts`
