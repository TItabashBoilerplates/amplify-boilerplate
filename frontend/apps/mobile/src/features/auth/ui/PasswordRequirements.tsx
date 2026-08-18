import { getPasswordIssues, PASSWORD_MIN_LENGTH } from '@workspace/auth/validation'
import { Text, VStack } from '@workspace/native-ui/components'
import { useI18n } from '@/shared/hooks'

/**
 * パスワード要件のチェックリスト
 *
 * Supabase 側の要件（`minimum_password_length` / `password_requirements`）を
 * 満たさないと 422 で弾かれる。**何が足りないかを出さないと、ユーザーは
 * 推測して何度も入力し直すことになる。**
 *
 * 判定規則は `@workspace/auth/validation` が単一の正本（Web と共有）。
 */
export function PasswordRequirements({ password }: { password: string }) {
  const { t } = useI18n()
  const issues = getPasswordIssues(password)

  const requirements = [
    { key: 'too_short', label: t('auth.requirements.minLength', { count: PASSWORD_MIN_LENGTH }) },
    { key: 'missing_lowercase', label: t('auth.requirements.lowercase') },
    { key: 'missing_uppercase', label: t('auth.requirements.uppercase') },
    { key: 'missing_digit', label: t('auth.requirements.digit') },
    { key: 'missing_symbol', label: t('auth.requirements.symbol') },
  ] as const

  return (
    <VStack className="gap-1">
      {requirements.map((requirement) => {
        const satisfied = password.length > 0 && !issues.includes(requirement.key)
        return (
          <Text
            key={requirement.key}
            className={satisfied ? 'text-xs text-foreground' : 'text-xs text-muted-foreground'}
          >
            {satisfied ? '✓' : '・'} {requirement.label}
          </Text>
        )
      })}
    </VStack>
  )
}
