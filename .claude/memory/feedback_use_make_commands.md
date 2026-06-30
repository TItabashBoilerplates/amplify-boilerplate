---
name: devenv コマンド必須
description: 品質チェック（lint, format, type-check, test, build）は必ず devenv のコマンド（scripts または `devenv tasks run`）を使用。Makefile は deprecated で使わない。直接ツール実行も禁止。
type: feedback
---

品質チェック（lint, format, type-check, test, build, ci-check）は **必ず devenv コマンドを使用**すること。

- **Scripts** (PATH): `lint`, `format`, `type-check`, `ci-check`, `lint-frontend`, `format-backend-py`, `type-check-frontend`, ...
- **Tasks** (pipeline): `devenv tasks run app:migrate-dev`, `devenv tasks run model:build`, `devenv tasks run deploy:functions`, ...

**Why:**
- 元々 Makefile を使っていたが、2026-04 に devenv tasks/scripts への一本化を実施 (Makefile は deprecated)。
- 直接 `pnpm run biome`, `uv run ruff`, `npx tsc` 等を叩くと環境差異・CI 不整合・profile (env) 未読み込みのリスクがある。
- devenv profile (既定 local / `-P dev` / `-P staging` / `-P production`) と組み合わせることで、env 切替を含めた一貫した実行環境が保証される。

**How to apply:**
- コード変更後の品質確認時、`pnpm run biome`, `uv run ruff`, `npx tsc` 等を直接実行しない。
- `make X` も使わない（Makefile は deprecation stub になっており、使うと案内のみ表示される）。
- 代わりに `lint`, `format`, `type-check`, `ci-check` などの devenv scripts を使う。
- マイグレーション・デプロイなど pipeline 系は `devenv tasks run <namespace:name>` を使う。
- direnv 未活性のセッションでは `devenv shell -- <command>` 経由で呼び出す。
