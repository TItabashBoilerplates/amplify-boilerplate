'use client'

import {
  deletePasskey,
  listPasskeys,
  type PasskeyCredential,
  registerPasskey,
} from '@workspace/app'
import { Button } from '@workspace/ui/components/button'
import { KeyRound, Loader2, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

/**
 * passkey（WebAuthn）管理コンポーネント（サインイン済みユーザー向け）。
 *
 * 登録済み passkey の一覧表示・新規登録・削除を行う。設定/プロフィール画面に置く想定。
 * バックエンドで `loginWith.webAuthn` を有効化していないと登録に失敗する。
 *
 * Hydration 回避のため mounted ガードを使い、クライアントでのみデータ取得する
 * （`frontend/CLAUDE.md` の Rule 2）。
 */
export interface PasskeyManagerProps {
  className?: string
}

export function PasskeyManager({ className }: PasskeyManagerProps) {
  const t = useTranslations('auth')
  const [mounted, setMounted] = useState(false)
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await listPasskeys()
    if ('error' in result) {
      setError(result.error)
    } else {
      setCredentials(result.credentials)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setMounted(true)
    void refresh()
  }, [refresh])

  const handleRegister = async () => {
    setBusy(true)
    setError('')
    const result = await registerPasskey()
    if ('error' in result) {
      setError(result.error)
    } else {
      await refresh()
    }
    setBusy(false)
  }

  const handleDelete = async (credentialId: string) => {
    setBusy(true)
    setError('')
    const result = await deletePasskey(credentialId)
    if ('error' in result) {
      setError(result.error)
    } else {
      await refresh()
    }
    setBusy(false)
  }

  if (!mounted) return null

  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('passkeysTitle')}</h3>
        </div>
        <Button type="button" size="sm" disabled={busy} onClick={handleRegister}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('addPasskey')}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loadingPasskeys')}</p>
      ) : credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noPasskeys')}</p>
      ) : (
        <ul className="space-y-2">
          {credentials.map((credential) => (
            <li
              key={credential.credentialId}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <span className="truncate text-sm font-medium">
                {credential.friendlyCredentialName || credential.credentialId}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={t('deletePasskey')}
                onClick={() => handleDelete(credential.credentialId)}
              >
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
