import { Box, Text } from '@workspace/native-ui/components'

/**
 * 認証フォームの結果表示（成功 / エラー共通）
 *
 * 各フォームに同じ Box + クラス文字列をコピペしないための共有部品
 * （`.claude/rules/clean-code.md` / `form-controls.md` §6）。
 *
 * `accessibilityLiveRegion` を付けているのは、送信結果を**視覚以外でも**伝えるため。
 * スクリーンリーダー利用者は文字色の変化に気づけない。
 */
export function AuthMessage({ tone, message }: { tone: 'success' | 'error'; message: string }) {
  return (
    <Box
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className={
        tone === 'success'
          ? 'rounded-md border border-primary/40 bg-primary/5 p-3'
          : 'rounded-md border border-destructive/40 bg-destructive/5 p-3'
      }
    >
      <Text className={tone === 'success' ? 'text-foreground' : 'text-destructive'}>{message}</Text>
    </Box>
  )
}
