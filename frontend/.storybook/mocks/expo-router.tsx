import type { ComponentProps, ReactNode } from 'react'
import { Text } from 'react-native'

/**
 * Storybook 用の `expo-router` モック。
 *
 * ■ なぜモックするのか
 *   expo-router は Expo アプリのルーターとして動くことを前提にした大きなパッケージで、
 *   内部に CJS の `require()` が残っており、そのまま Vite で読むと
 *   `ReferenceError: require is not defined` でストーリーが描画できない。
 *   また本来ルーターのコンテキスト（ルートツリー・ナビゲーション状態）を必要とするが、
 *   コンポーネントカタログにアプリのルーティングを持ち込む意味は無い。
 *
 *   Web 側で `next/link` / `next/navigation` をモックしているのとまったく同じ判断。
 *
 * ■ 実装
 *   react-native-web の `Text` は `href` を渡すと `<a>` としてレンダリングされるので、
 *   リンクの見た目・クリック挙動は実物に十分近い。
 */

export type Href = string

type LinkProps = Omit<ComponentProps<typeof Text>, 'href'> & {
  href: Href
  target?: string
  children?: ReactNode
}

export function Link({ href, target, children, ...rest }: LinkProps) {
  return (
    <Text accessibilityRole="link" href={href} target={target} {...rest}>
      {children}
    </Text>
  )
}

export const router = {
  push: () => {},
  replace: () => {},
  back: () => {},
  canGoBack: () => false,
  setParams: () => {},
}

export const useRouter = () => router
export const usePathname = () => '/'
export const useLocalSearchParams = () => ({})
export const useSegments = () => [] as string[]
