import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `"use server"` ファイルが async 関数以外を export していないことを守る。
 *
 * ## なぜこの検査が要るか
 *
 * Next.js は `"use server"` ファイルからの export を **async 関数に限定**している
 * （export されたものは全てクライアントから呼べる RPC エンドポイントになるため、
 * 定数や同期関数を置く場所ではない）。
 *
 * **この違反は型チェックでも lint でも Storybook でも検出できない。**
 * `tsc --noEmit` は通り、Biome も ESLint も通り、単体テストも通る。
 * 壊れるのは `next build`（Turbopack）だけで、しかもエラーの出方が
 *
 *   Error: Only async functions are allowed to be exported in a "use server" file.
 *   → The export X was not found in module ... The module has no exports at all.
 *
 * という形になる。**違反した 1 つの定数のせいでモジュール全体の export が消える**ので、
 * そのファイルを import している箇所が芋づる式に壊れ、原因が非常に分かりにくい。
 *
 * 本リポジトリの認証は現在クライアント側で `aws-amplify/auth` を直接呼ぶため
 * Server Action を持たない。**それでもこの検査を先に置いておく**のは、
 * 最初の Server Action を書いた人が踏むまで誰も気づけない類の罠だからである
 * （`ci:check` は lint / format / type-check のみで `next build` を含まない）。
 *
 * @see https://nextjs.org/docs/app/api-reference/directives/use-server
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = resolve(HERE, '../..')

/** コメントと文字列リテラルの影響を避けるため、ブロック/行コメントだけ落とす */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

/** 先頭の `'use server'` / `"use server"` ディレクティブを持つファイル */
function isServerActionFile(source: string): boolean {
  return /^\s*(?:'use server'|"use server")/.test(source)
}

const serverActionFiles = collectFiles(SRC_ROOT).filter((file) =>
  isServerActionFile(readFileSync(file, 'utf8'))
)

const allSourceFiles = collectFiles(SRC_ROOT)

describe('"use server" ファイルの export', () => {
  /**
   * ファイル収集そのものが壊れていないことの確認。
   *
   * shadcn 版は「Server Action が 1 つ以上ある」ことを検査していたが、本リポジトリは
   * まだ Server Action を持たない（認証はクライアントから `aws-amplify/auth` を呼ぶ）。
   * 「0 件だから常に緑」と「収集が壊れていて常に緑」を区別できないと検査の意味が無いので、
   * **収集器が動いていること**を代わりに固定する。
   */
  it('ソースの収集が動いている（glob が壊れていないことの確認）', () => {
    expect(allSourceFiles.length).toBeGreaterThan(0)
  })

  /**
   * 1 ファイル 1 テストで回す。`it.each` を使わないのは、Server Action が 0 件のときに
   * 空配列を渡すことになり、「検査したが 0 件」と「検査自体が消えた」の区別が
   * 付かなくなるため（上の収集テストと合わせて両方を担保する）。
   */
  for (const file of serverActionFiles) {
    it(`${relative(SRC_ROOT, file)} は async 関数以外を export していない`, () => {
      const code = stripComments(readFileSync(file, 'utf8'))

      // `export const` / `export let` / `export var` は値の export になるため不可
      const valueExports = code.match(/^\s*export\s+(?:const|let|var)\s+\w+/gm) ?? []

      // `export function` は async でなければ不可（`export async function` のみ許可）
      const syncFunctionExports = code.match(/^\s*export\s+function\s+\w+/gm) ?? []

      // `export { X }` の再 export も、何を出しているか静的に追えないため不可
      const namedReExports = code.match(/^\s*export\s*\{[^}]*\}/gm) ?? []

      expect(
        [...valueExports, ...syncFunctionExports, ...namedReExports],
        `"use server" ファイルは async 関数のみ export できる。` +
          `定数や型は model/ など別モジュールへ移すこと`
      ).toEqual([])
    })
  }
})
