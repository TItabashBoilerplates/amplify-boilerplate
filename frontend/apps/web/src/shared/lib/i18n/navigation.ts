import { createNavigation } from 'next-intl/navigation'
import { routing } from '@/shared/config/i18n'

/**
 * ロケール対応のナビゲーション API
 * Feature Sliced Design の shared/lib レイヤーに配置
 *
 * Next.js の標準ナビゲーション API のラッパー
 * 自動的にロケールを考慮したナビゲーションを提供
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
