import type { ComponentProps, ReactNode } from 'react'

/**
 * Storybook 用の `@/shared/lib/i18n` / `@/shared/lib/i18n/navigation`（apps/web）モック。
 *
 * ■ なぜモックするのか
 *   本体は `next-intl/navigation` の `createNavigation(routing)` が返すもので、
 *   **Next.js のルーターコンテキスト**（App Router のセグメント情報）を前提にする。
 *   Storybook にはそれが無いため、`useRouter()` が実行時に落ちる。
 *   `next/link` / `expo-router` をモックしているのとまったく同じ判断。
 *
 * ■ 実装
 *   `Link` は素の `<a>`。ストーリー内でクリックしてもページ遷移させたくないので
 *   `preventDefault` する（カタログの中で 404 に飛ばされるのを防ぐ）。
 *   `useRouter` は no-op を返し、遷移が起きたことは action ログで確認できるように
 *   `console.info` に出す。
 */

type LinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  href: string
  locale?: string
  children?: ReactNode
}

export function Link({ href, locale: _locale, children, onClick, ...rest }: LinkProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        console.info('[storybook] navigate:', href)
        onClick?.(event)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

const noop =
  (label: string) =>
  (...args: unknown[]) => {
    console.info(`[storybook] router.${label}`, ...args)
  }

export function useRouter() {
  return {
    push: noop('push'),
    replace: noop('replace'),
    refresh: noop('refresh'),
    back: noop('back'),
    forward: noop('forward'),
    prefetch: noop('prefetch'),
  }
}

export function usePathname() {
  return '/'
}

export function redirect(href: string) {
  console.info('[storybook] redirect:', href)
}

export function getPathname({ href }: { href: string }) {
  return href
}
