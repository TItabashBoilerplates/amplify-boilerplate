/**
 * 実行中のプラットフォーム名を Rust 側から取得する。
 *
 * `@tauri-apps/api` は **Tauri の WebView の中でしか動かない**（ブラウザで開いた
 * dev server には IPC が無い）。トップレベルで import すると Vite の `pnpm run dev` や
 * ブラウザでの UI 確認が落ちるので、Tauri のグローバルがあるときだけ動的 import する。
 *
 * プラットフォーム名だけのために `@tauri-apps/plugin-os` を足さない
 * （`.claude/rules/minimal-implementation.md`: 依存を 1 つ増やす = 保守対象を 1 つ増やす）。
 * `src-tauri` 側の `platform_label` コマンドを呼ぶ形にして、
 * フロント ↔ Rust の IPC 経路もこの 1 か所で示す。
 */
export async function getPlatformLabel(): Promise<string | null> {
  // Tauri が WebView に注入するグローバル。無ければ通常のブラウザで開かれている。
  if (!('__TAURI_INTERNALS__' in window)) return null

  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string>('platform_label')
}
