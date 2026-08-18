'use client'

import {
  getPasswordIssues,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@workspace/auth/validation'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

/**
 * パスワード入力欄（表示切替 + 要件チェックリスト）
 *
 * ## なぜチェックリストを出すか
 *
 * Cognito のパスワードポリシーを満たさないと `InvalidPasswordException` で弾かれる。
 * **何が足りないのかを出さないと、ユーザーは何度も推測して入力し直すことになる**。
 * 要件は `@workspace/auth/validation` が単一の正本として持っており、Web / Mobile で共有する
 * （backend の `Policies.PasswordPolicy` と一対一に対応させる）。
 *
 * ## なぜ表示切替を付けるか
 *
 * 12 文字以上 + 大小英字 + 数字 + 記号を**見えないまま**正確に打たせるのは非現実的で、
 * 打ち間違いによるログイン失敗を増やす。パスワードマネージャを使わないユーザーへの
 * 実質的な救済になる。
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  disabled,
  showRequirements = false,
  value,
  onValueChange,
}: {
  name: string
  label: string
  autoComplete: 'current-password' | 'new-password'
  disabled?: boolean
  /** 要件チェックリストを表示する（新規パスワード入力欄で使う） */
  showRequirements?: boolean
  value?: string
  onValueChange?: (value: string) => void
}) {
  const t = useTranslations('Auth')
  // id は `name` をそのまま使う（フォーム内で一意）。`useId()` はレンダーごとに
  // 変わる値なので、E2E（Maestro）のセレクタが安定しない。
  const inputId = name
  const [visible, setVisible] = useState(false)
  const [internalValue, setInternalValue] = useState('')

  const currentValue = value ?? internalValue
  const issues = getPasswordIssues(currentValue)

  const requirements = [
    {
      key: 'too_short' as const,
      label: t('requirements.minLength', { count: PASSWORD_MIN_LENGTH }),
    },
    { key: 'missing_lowercase' as const, label: t('requirements.lowercase') },
    { key: 'missing_uppercase' as const, label: t('requirements.uppercase') },
    { key: 'missing_digit' as const, label: t('requirements.digit') },
    { key: 'missing_symbol' as const, label: t('requirements.symbol') },
  ]

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          maxLength={PASSWORD_MAX_LENGTH}
          className="pr-10"
          value={currentValue}
          onChange={(event) => {
            setInternalValue(event.target.value)
            onValueChange?.(event.target.value)
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((previous) => !previous)}
          disabled={disabled}
          // ラベルは i18n。スクリーンリーダーには「表示 / 非表示」が伝わる必要がある
          aria-label={visible ? t('hidePassword') : t('showPassword')}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {showRequirements && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {requirements.map((requirement) => {
            const satisfied = currentValue.length > 0 && !issues.includes(requirement.key)
            return (
              <li key={requirement.key} className="flex items-center gap-1.5">
                {satisfied ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                )}
                <span className={satisfied ? 'text-foreground' : undefined}>
                  {requirement.label}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
