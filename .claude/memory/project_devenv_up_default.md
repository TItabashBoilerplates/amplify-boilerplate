---
name: devenv up の既定起動セット
description: devenv up は軽量セット (Supabase + backend + storybook) のみを起動する。frontend monorepo apps (web/mobile) は opt-in process で別途指定が必要。
type: project
---

`devenv up` (profile 指定なし = local 既定) は **軽量セット** のみを起動する設計:
- Supabase (Docker, `supabase:start` task が backend の `before` で自動先行)
- backend (FastAPI, port 4040)
- storybook (port 6006)

**Why:**
- 全アプリ並列起動は重すぎる (Next.js + Expo + Storybook + backend = メモリ・CPU 大量消費)
- 大半の作業 (API/DB) は web/mobile が起動していなくても進められる
- 必要なときだけ frontend apps を opt-in で乗せる方が現実的

**How to apply:**
- `frontend/apps/<name>` 配下の各アプリは `start.enable = false` で **opt-in process** として登録
- 個別起動: `devenv up web` / `devenv up mobile` / `devenv up backend storybook web`
- preset script: `dev-web` / `dev-mobile` / `dev-all` (devenv.nix の `frontendApps` から自動生成)
- 新規アプリ追加時は `devenv.nix` の `frontendApps` attrset に 1 行追加するだけで、process / `dev-<name>` script / `dev-all` がすべて連動する
- Expo の対話的 TUI が必要な場合は別ターミナルで `mobile-ios` / `mobile-android` 等を叩く (devenv 外、Expo TUI 直接起動)
