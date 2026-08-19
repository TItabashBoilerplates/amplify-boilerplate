import tsParser from '@typescript-eslint/parser'
import { fsdConfig } from '@workspace/eslint-config/fsd'

/**
 * デスクトップアプリの ESLint 設定（FSD 境界検査）。
 *
 * ## パーサと resolver を自分で用意する必要がある
 *
 * web は `eslint-config-next`、mobile は `eslint-config-expo` が
 * **パーサと `import/resolver` の両方**を連れてくるが、desktop は Vite なので
 * どちらも無い。そして**どちらが欠けても「エラーにならず、検査されない」**:
 *
 * - パーサが無い       … `.ts` / `.tsx` を解析できない
 * - resolver が無い    … `@/views/home` のようなエイリアスを解決できず、
 *                        `eslint-plugin-boundaries` が **external 依存とみなして
 *                        黙って飛ばす**
 *
 * 実際に resolver 無しの状態では、`shared` から `views` を import する
 * 明確な違反を仕込んでも exit 0 で通ってしまった。**「lint が通った」は
 * 「検査された」を意味しない**ので、設定を変えたら必ずわざと違反を作って
 * 落ちることを確認すること。
 */
export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      // tsconfig.json の paths（`@/*`）を解決させる
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
  },
  fsdConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'src-tauri/**'],
  },
]
