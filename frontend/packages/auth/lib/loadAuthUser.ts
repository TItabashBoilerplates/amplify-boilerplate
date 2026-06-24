import { clientLogger } from '@workspace/logger/client'
import { fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth'
import type { AuthUser } from '../store/authStore'

const logger = clientLogger.child({ lib: 'loadAuthUser' })

/**
 * 現在の Cognito ユーザーを取得して `AuthUser` に正規化する。
 *
 * 未認証時 `getCurrentUser()` は throw する（= 正常な制御フロー）。その場合は
 * `null` を返す。それ以外の予期しない例外はログに残したうえで `null`。
 *
 * web / native 両方の AuthProvider から共有利用する（DRY）。
 */
export async function loadAuthUser(): Promise<AuthUser | null> {
  try {
    const { userId, username } = await getCurrentUser()

    let email: string | undefined
    try {
      const attributes = await fetchUserAttributes()
      email = attributes.email
    } catch (error) {
      // 属性取得はベストエフォート（必須ではない）
      logger.debug('fetchUserAttributes failed; continuing without email', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return { userId, username, email }
  } catch {
    // 未認証（getCurrentUser が throw）— 想定内の状態
    return null
  }
}
