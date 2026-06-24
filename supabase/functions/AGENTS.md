# Edge Functions Guidelines

## Module System

- Use `npm:` prefix for npm packages
- Shared code in `_shared/`

## Structure

- One function per directory
- `index.ts` as entry point

## Commands

すべて devenv の **scripts** (PATH 直結) または **tasks**
(`devenv tasks run <name>`) を使用する。Makefile は
**deprecated**（削除済み）。直接 `deno lint` / `deno fmt` /
`supabase functions deploy` での実行は禁止（local 動作確認用の
`supabase functions serve` を除く）。

```bash
# Lint / Format / Type-check (scripts on PATH)
lint-functions            # Deno lint
format-functions          # Deno fmt (auto-fix)
check-functions           # Deno type check (全 functions 自動検出)

# Deploy (devenv tasks)
devenv tasks run -P production deploy:functions      # 本番デプロイ
devenv tasks run -P staging  deploy:functions        # ステージングデプロイ
```

正典: `/.claude/rules/commands.md`
