'use client'

import outputs from 'amplify-outputs'
import { Amplify } from 'aws-amplify'

/**
 * クライアント側で Amplify を初期化する。
 *
 * `ssr: true` により、認証トークンをブラウザの Cookie ストアに保存し、
 * Server Component からも `runWithAmplifyServerContext` 経由でセッションを
 * 参照できるようにする。
 *
 * root layout で一度だけマウントする（描画は行わない）。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/server-side-rendering/
 */
Amplify.configure(outputs, { ssr: true })

export function ConfigureAmplifyClientSide() {
  return null
}
