import { createRequire } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-native-web-vite'
import type { PluginOption } from 'vite'

// ESM 環境では __dirname / require が使えないため import.meta.url から作る
const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const WEB_SRC = resolve(__dirname, '../apps/web/src')
const MOBILE_ROOT = resolve(__dirname, '../apps/mobile')

/**
 * apps/mobile の tsconfig は `@/` を **2 段構え**でマップしている:
 *   "@/shared/*": ["./src/shared/*"]  ← FSD レイヤーは src/ 配下
 *   "@/*":        ["./*"]             ← それ以外（assets 等）はアプリ直下
 * TypeScript は「より具体的なパターン」を優先するので、同じ優先順を再現する。
 * これを間違えると `@/assets/images/...` が apps/mobile/src/assets/... を指して壊れる。
 */
const MOBILE_FSD_SEGMENTS = new Set(['app', 'views', 'widgets', 'features', 'entities', 'shared'])

/**
 * apps/web の i18n ナビゲーションの入口。
 *
 * バレル（`@/shared/lib/i18n`）と実体（`.../navigation`）の**両方**が使われている。
 * 片方だけモックすると、もう片方の import が実体を掴んで
 * "invariant expected app router to be mounted" で落ちる。
 */
const WEB_I18N_SOURCES = new Set(['@/shared/lib/i18n', '@/shared/lib/i18n/navigation'])

function mobileBaseFor(subpath: string): string {
  const head = subpath.split('/')[0]
  return MOBILE_FSD_SEGMENTS.has(head) ? join(MOBILE_ROOT, 'src') : MOBILE_ROOT
}

/**
 * `@/` を **import 元のアプリごとに**振り分ける Vite プラグイン。
 *
 * apps/web と apps/mobile は **どちらも `@/` を使うが指す先が違う**:
 *   - apps/web/tsconfig.json    : `"@/*": ["./src/*"]`  → apps/web/src
 *   - apps/mobile/tsconfig.json : `"@/shared/*": ["./src/shared/*"]` 等 → apps/mobile/src
 *
 * Vite の `resolve.alias` はグローバルなので、片方に固定すると
 * **もう片方が黙って別アプリの同名モジュールに解決される**（例: mobile の
 * `@/shared/hooks` が apps/web/src/shared/hooks に解決される）。エラーにならず
 * 「なぜか web の実装が動く」という最悪の壊れ方をするので、importer を見て分岐する。
 *
 * 単一カタログに 2 つのアプリを載せる以上ここは避けられない。将来 3 つ目のアプリを
 * 足すときも、このマップに 1 行足すだけで済むようにしてある。
 */
function fsdAliasPlugin(): PluginOption {
  return {
    name: 'storybook-fsd-alias',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.startsWith('@/') || !importer) return null

      const isMobileImporter = importer.includes(`${sep}apps${sep}mobile${sep}`)

      // apps/web の i18n ナビゲーション（next-intl の createNavigation）は
      // Next.js のルーターコンテキストを前提にしており Storybook では落ちる。
      // 実体の解決より前にモックへ差し替える。
      if (!isMobileImporter && WEB_I18N_SOURCES.has(source)) {
        return resolve(__dirname, './mocks/web-i18n-navigation.tsx')
      }

      const subpath = source.slice(2)
      const base = isMobileImporter ? mobileBaseFor(subpath) : WEB_SRC

      // 拡張子解決や条件付き exports は Vite 本体に任せる（skipSelf で無限再帰を防ぐ）
      const resolved = await this.resolve(join(base, subpath), importer, {
        ...options,
        skipSelf: true,
      })
      return resolved
    },
  }
}

const config: StorybookConfig = {
  // ============================================================
  // Framework: react-native-web-vite
  //
  // Web (shadcn/ui) と Mobile (gluestack-ui + NativeWind v5) を **1 つのカタログ**に載せる。
  //
  // かつてここは `@storybook/nextjs`（Webpack）で、「NativeWind v5 は Metro でしか動かないので
  // Mobile のストーリーは登録できない」とされていたが、これは誤り。正確には:
  //
  //   - Metro が必要なのは **ネイティブ (iOS/Android)** 向けのビルドだけ。
  //     CSS を JS のスタイルレジストリへコンパイルする必要があるため。
  //   - **Web では不要**。react-native-css は `runtime.ts -> ./web` で web 実装に解決され、
  //     `useCssElement` が className を react-native-web の `$$css` エスケープハッチ
  //     （`{ $$css: true, className: '...' }`）に載せる。CSS は普通の Tailwind 出力を使う。
  //   - この経路に乗せるのに必要なのは **`react-native-css/babel` の import 書き換えプラグイン**だけ。
  //     `import { View } from 'react-native'` を `react-native-css/components/View` に差し替え、
  //     className を解釈できるラッパーコンポーネントに繋ぐ。
  //
  // 従来 Mobile が「全部無スタイル」で表示されていた理由:
  //   `@storybook/nextjs` は SWC パイプラインでこの Babel プラグインが動かないため import が
  //   書き換わらず、生の react-native-web の `View` に className が渡る。
  //   react-native-web の `createDOMProps` は className を **自前の StyleSheet 出力で上書き**
  //   するので（`domProps.className = StyleSheet(...)[0]`）、渡した className は捨てられる。
  //   Tailwind 側は `.bg-primary` 等を正しく生成できていたので「CSS が当たらない」ように見えた。
  //
  // 参考: react-native-css の README にある "officially only supports Metro" は
  //       **CSS アセットパイプライン（ネイティブ向け）**の話であって、web 対応の話ではない。
  //       同パッケージには `src/babel/react-native-web.ts` / `src/web/` が同梱されている。
  // ============================================================
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      pluginReactOptions: {
        // ------------------------------------------------------------
        // Babel の対象範囲（`modulesToTranspile` ではなく `exclude` を直接指定している）
        //
        // framework は `modulesToTranspile` から exclude 正規表現を組み立てるが、
        // `pluginReactOptions` の方が後勝ちでマージされるので、細かい制御が要るここでは
        // exclude を自前で書く。既定は
        //   /\/node_modules\/(?!react-native|@react-native|expo|@expo)/
        // で「node_modules は原則対象外、ただし RN / Expo 系だけ対象」という意味。
        //
        // ここでの変更点は 2 つ:
        //
        //  1. `@gluestack-ui` / `nativewind` を **追加**で対象にする。
        //     gluestack-ui は内部で react-native のプリミティブを描画するため、外すと
        //     gluestack 側が描画する要素だけ className が効かない、という分かりにくい崩れ方をする。
        //
        //  2. `react-native-web` 本体は **対象外に戻す**（← これが無いと本番ビルドが壊れる）。
        //     react-native-css の import 書き換えプラグインは
        //     `react-native-web/dist/...` への **相対 import まで**書き換える
        //     （`src/babel/react-native-web.ts` の `parseReactNativeWebSource`）。
        //     その結果 react-native-web 内部の `./FlatList` が
        //     `react-native-css/components/FlatList` を指し、その FlatList はまた
        //     `react-native`（= react-native-web）を import するので循環参照になる。
        //     dev（ESM で遅延評価）では表面化しないが、Rollup の本番ビルドでは
        //     2 つの束縛が 1 つに畳まれて
        //       `const FlatList$1 = copyComponentProperties(FlatList$1, ...)`
        //     という自己参照になり、**全ストーリーが**
        //     `ReferenceError: Cannot access 'FlatList$1' before initialization`
        //     で落ちる（storybook build は成功するのでブラウザで開くまで気づけない）。
        //
        //     アプリ側のコード（packages/native-ui / stories）の `react-native` import は
        //     引き続き書き換わるので、className の解決には影響しない。
        // ------------------------------------------------------------
        exclude:
          /\/node_modules\/(?:react-native-web\/|(?!react-native|@react-native|expo|@expo|@gluestack-ui|nativewind))/,
        babel: {
          // react-native-css の公式 preset。中身は
          //   1. import 書き換えプラグイン（react-native / react-native-web -> react-native-css/components）
          //   2. react-native-worklets/plugin（reanimated 4 を使うコンポーネント用）
          // framework 側が babelrc / configFile を無効化するので、
          // apps/mobile/babel.config.js が混ざる心配はない（= ここで明示する必要がある）。
          presets: [require.resolve('react-native-css/babel')],
        },
      },
    },
  },

  stories: [
    // ============================================
    // PACKAGES - Web UI (shadcn/ui + MagicUI)
    // ============================================
    {
      directory: '../packages/ui/src/components',
      files: '*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Packages/UI Web/Components',
    },
    {
      directory: '../packages/ui/src/magicui',
      files: '**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Packages/UI Web/MagicUI',
    },

    // ============================================
    // PACKAGES - Mobile UI (gluestack-ui + NativeWind v5)
    // ============================================
    {
      directory: '../packages/native-ui/components',
      files: '**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Packages/UI Mobile/Components',
    },

    {
      directory: '../packages/native-ui/layout',
      files: '**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Packages/UI Mobile/Layout',
    },

    // ============================================
    // FSD LAYERS (apps/mobile) — Expo アプリ側のカタログ
    //
    // `views`（画面まるごと）も **UI/UX デバッグ目的で**登録している。
    // ただしこれは実機描画ではないので、**ストア用スクリーンショットには使えない**
    // （提出用は `screenshots-mobile` = Maestro + simulator/emulator で撮る）。
    // ============================================
    {
      directory: '../apps/mobile/src/views',
      files: '**/ui/**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Apps/Mobile/Views',
    },
    {
      directory: '../apps/mobile/src/widgets',
      files: '**/ui/**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Apps/Mobile/Widgets',
    },
    {
      directory: '../apps/mobile/src/features',
      files: '**/ui/**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Apps/Mobile/Features',
    },
    {
      directory: '../apps/mobile/src/entities',
      files: '**/ui/**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Apps/Mobile/Entities',
    },
    {
      directory: '../apps/mobile/src/shared/ui',
      files: '**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Apps/Mobile/Shared',
    },

    // ============================================
    // FSD LAYERS (apps/web)
    // ============================================
    {
      directory: '../apps/web/src/widgets',
      files: '**/ui/**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Widgets',
    },
    {
      directory: '../apps/web/src/entities',
      files: '**/ui/**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Entities',
    },
    {
      directory: '../apps/web/src/features',
      files: '**/ui/**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Features',
    },

    {
      directory: '../apps/web/src/views',
      files: '**/ui/**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Views',
    },

    {
      directory: '../apps/web/src/shared/ui',
      files: '**/*.stories.@(js|jsx|ts|tsx)',
      titlePrefix: 'Shared',
    },
  ],

  addons: ['@storybook/addon-docs', '@storybook/addon-themes'],

  typescript: {
    reactDocgen: 'react-docgen',
    check: false,
  },

  staticDirs: ['../apps/web/public'],

  // Vite 設定:
  //   - `@workspace/*` は各パッケージの package.json の `exports` を Vite が解決するので
  //     alias 不要（Webpack builder 時代に必要だった subpath alias のミラーは削除済み）。
  //   - `@/` は **web と mobile で指す先が違う**ため単純な alias では解決できない → 下記プラグイン。
  //     framework が同梱する vite-tsconfig-paths はリポジトリルートの
  //     solution-style tsconfig（`files: []` + `references` のみ）を見るため paths を拾えない。
  viteFinal: async (config) => {
    const { default: tailwindcss } = await import('@tailwindcss/vite')

    config.plugins ??= []
    config.plugins.push(tailwindcss(), fsdAliasPlugin())

    // expo-router は Expo アプリのルーターとして動く前提の大きなパッケージで、
    // 内部の CJS `require()` が Vite で解決できず
    // `ReferenceError: require is not defined` になる。カタログにアプリのルーティングを
    // 持ち込む意味も無いので、Web 側で next/link をモックしているのと同じくモックする。
    // 完全一致（`/^expo-router$/`）にしてサブパスは巻き込まない。
    // 既存 alias（framework が入れる react-native -> react-native-web 等）を落とさないよう、
    // オブジェクト形式なら配列形式へ変換してから追記する。
    config.resolve ??= {}
    const existing = config.resolve.alias ?? []
    config.resolve.alias = [
      ...(Array.isArray(existing)
        ? existing
        : Object.entries(existing).map(([find, replacement]) => ({ find, replacement }))),
      { find: /^expo-router$/, replacement: resolve(__dirname, './mocks/expo-router.tsx') },
      // apps/web の i18n ナビゲーション（next-intl の createNavigation）は
      // Next.js の App Router コンテキストを前提にしており、Storybook では
      // `useRouter()` が "invariant expected app router to be mounted" で落ちる。
      // fsdAliasPlugin 側でも同じ差し替えをしているが、プラグインの解決順に
      // 依存しないよう alias でも明示する（片方だけだと無言で実体が使われる）。
      {
        find: /^@\/shared\/lib\/i18n(\/navigation)?$/,
        replacement: resolve(__dirname, './mocks/web-i18n-navigation.tsx'),
      },
    ]

    return config
  },
}

export default config
