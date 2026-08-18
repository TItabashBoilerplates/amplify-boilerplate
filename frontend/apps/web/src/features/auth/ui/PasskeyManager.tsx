'use client'

import {
  deletePasskey,
  listPasskeys,
  type PasskeyCredential,
  registerPasskey,
} from '@workspace/app'
import { useMutation, useQuery, useQueryClient } from '@workspace/query'
import { Button } from '@workspace/ui/components/button'
import { KeyRound, Loader2, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AuthMessage } from './AuthMessage'

/**
 * passkey（WebAuthn）管理コンポーネント（サインイン済みユーザー向け）。
 *
 * 登録済み passkey の一覧表示・新規登録・削除を行う。設定 / アカウント画面に置く想定。
 * バックエンドで `loginWith.webAuthn` を有効化していないと登録に失敗する。
 *
 * ## なぜ useEffect ではなく TanStack Query か
 *
 * これは**サーバーステートの取得**であり、本リポジトリが採用している層は
 * TanStack Query（`@workspace/query`）である（`.claude/rules/minimal-implementation.md` §3.4）。
 * `useEffect` + `useState` で取得を組むと、キャッシュ・重複排除・再取得を自前で書き直すことになり、
 * effect 内の同期 setState によるカスケードレンダーも招く（React の
 * "You Might Not Need an Effect"）。
 */
export interface PasskeyManagerProps {
  className?: string
}

const passkeyKeys = { list: () => ['auth', 'passkeys'] as const }

export function PasskeyManager({ className }: PasskeyManagerProps) {
  const t = useTranslations('Auth')
  const queryClient = useQueryClient()

  const {
    data: credentials = [],
    isPending,
    error: listError,
  } = useQuery<PasskeyCredential[], Error>({
    queryKey: passkeyKeys.list(),
    queryFn: async () => {
      const result = await listPasskeys()
      if ('error' in result) {
        // エラーを握りつぶさない（`.claude/rules/error-handling.md`）。
        // throw することで TanStack Query の error 状態に載る。
        console.error('[auth] listPasskeys failed:', result.error)
        throw new Error(result.error)
      }
      return result.credentials
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: passkeyKeys.list() })

  const register = useMutation<void, Error>({
    mutationFn: async () => {
      const result = await registerPasskey()
      if ('error' in result) {
        console.error('[auth] registerPasskey failed:', result.error)
        throw new Error(result.error)
      }
    },
    onSuccess: invalidate,
  })

  const remove = useMutation<void, Error, string>({
    mutationFn: async (credentialId) => {
      const result = await deletePasskey(credentialId)
      if ('error' in result) {
        console.error('[auth] deletePasskey failed:', result.error)
        throw new Error(result.error)
      }
    },
    onSuccess: invalidate,
  })

  const busy = register.isPending || remove.isPending
  const error = listError ?? register.error ?? remove.error

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="font-semibold text-lg">{t('passkeysTitle')}</h3>
        </div>
        <Button type="button" size="sm" disabled={busy} onClick={() => register.mutate()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('addPasskey')}
        </Button>
      </div>

      {error && <AuthMessage tone="error">{error.message}</AuthMessage>}

      {isPending ? (
        <p className="text-muted-foreground text-sm">{t('loadingPasskeys')}</p>
      ) : credentials.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noPasskeys')}</p>
      ) : (
        <ul className="space-y-2">
          {credentials.map((credential) => (
            <li
              key={credential.credentialId}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <span className="truncate font-medium text-sm">
                {credential.friendlyCredentialName || credential.credentialId}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={t('deletePasskey')}
                onClick={() => remove.mutate(credential.credentialId)}
              >
                <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
