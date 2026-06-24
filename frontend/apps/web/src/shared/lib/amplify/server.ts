import { createServerRunner } from '@aws-amplify/adapter-nextjs'
import outputs from 'amplify-outputs'

/**
 * Amplify サーバーサイドランナー（Next.js App Router 用）。
 *
 * Server Component / Route Handler / Server Action から Amplify の API
 * （`getCurrentUser` / `fetchAuthSession` 等の `aws-amplify/auth/server`）を
 * Cookie コンテキスト付きで実行するためのラッパーを提供する。
 *
 * @example
 * ```ts
 * import { cookies } from 'next/headers'
 * import { getCurrentUser } from 'aws-amplify/auth/server'
 * import { runWithAmplifyServerContext } from '@/shared/lib/amplify/server'
 *
 * const user = await runWithAmplifyServerContext({
 *   nextServerContext: { cookies },
 *   operation: (contextSpec) => getCurrentUser(contextSpec),
 * })
 * ```
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/server-side-rendering/
 */
export const { runWithAmplifyServerContext } = createServerRunner({
  config: outputs,
})
