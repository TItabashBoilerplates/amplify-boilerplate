/**
 * ソーシャルログイン（外部 IdP）クライアント操作（Web/Native 共通・Amplify Cognito）
 *
 * Cognito Hosted UI 経由の OAuth リダイレクトでサインインする。リダイレクト完了後の
 * 結果は `Hub` の `signInWithRedirect` / `signInWithRedirect_failure` イベントで受ける
 * （`@workspace/auth` の AuthProvider が購読済み）。
 *
 * バックエンドで `loginWith.externalProviders` を有効化し、各 IdP の secret を登録して
 * いないと動作しない（`frontend/packages/backend/amplify/auth/resource.ts`）。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/auth/connect-your-frontend/sign-in/
 */
import { signInWithRedirect } from 'aws-amplify/auth'

/** 本リポジトリのテンプレートで有効化できる外部プロバイダ */
export type SocialProvider = 'Google' | 'Apple' | 'Facebook' | 'Amazon'

/**
 * 外部 IdP へリダイレクトしてサインインを開始する。
 *
 * 成功時はブラウザが IdP へ遷移するため、`{ success: true }` は「リダイレクトを開始した」
 * ことを意味する（実際のサインイン完了は Hub イベントで通知される）。
 */
export async function signInWithSocial(
  provider: SocialProvider
): Promise<{ success: true } | { error: string }> {
  try {
    await signInWithRedirect({ provider })
    return { success: true }
  } catch (error) {
    console.error(`Failed to start sign-in with ${provider}:`, error)
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' }
  }
}
