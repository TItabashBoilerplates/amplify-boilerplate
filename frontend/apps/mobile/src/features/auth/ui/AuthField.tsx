import { Input, InputField, Pressable, Text, VStack } from '@workspace/native-ui/components'
import { useState } from 'react'

/**
 * ラベル付き入力欄（必要ならパスワード表示切替つき）
 *
 * **フォントサイズは `@workspace/native-ui` の `InputField` 側で 16px 以上に
 * 固定**されている（`packages/native-ui/components/input/variants.ts`）。
 * ここで `text-sm` 等に上書きしないこと。
 */
export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType = 'default',
  autoComplete,
  textContentType,
  isDisabled,
  isInvalid,
  toggleLabels,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  secure?: boolean
  keyboardType?: 'default' | 'email-address' | 'number-pad'
  autoComplete?: 'email' | 'password' | 'new-password' | 'one-time-code'
  textContentType?: 'emailAddress' | 'password' | 'newPassword' | 'oneTimeCode'
  isDisabled?: boolean
  isInvalid?: boolean
  /** パスワード欄の表示切替ラベル（i18n 済みの文字列を渡す） */
  toggleLabels?: { show: string; hide: string }
}) {
  const [visible, setVisible] = useState(false)
  const isSecure = secure && !visible

  return (
    <VStack className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <Input isDisabled={isDisabled} isInvalid={isInvalid}>
        <InputField
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          editable={!isDisabled}
        />
        {secure && toggleLabels ? (
          <Pressable
            onPress={() => setVisible((previous) => !previous)}
            accessibilityRole="button"
            accessibilityLabel={visible ? toggleLabels.hide : toggleLabels.show}
            className="pl-2"
          >
            <Text className="text-sm text-muted-foreground">
              {visible ? toggleLabels.hide : toggleLabels.show}
            </Text>
          </Pressable>
        ) : null}
      </Input>
    </VStack>
  )
}
