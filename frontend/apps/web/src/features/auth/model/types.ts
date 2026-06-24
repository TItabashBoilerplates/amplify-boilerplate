/**
 * 認証フォームの状態
 */
export interface AuthFormState {
  success: boolean
  message: string
}

/**
 * OTP送信フォームのプロパティ
 */
export interface LoginFormProps {
  /**
   * 送信後のリダイレクト先（オプション）
   */
  redirectTo?: string

  /**
   * カスタムCSSクラス
   */
  className?: string
}

/**
 * OTP検証フォームのプロパティ
 */
export interface VerifyOTPFormProps {
  /**
   * メールアドレス（親コンポーネントから渡される）
   */
  email: string

  /**
   * 送信後のリダイレクト先（オプション）
   */
  redirectTo?: string

  /**
   * カスタムCSSクラス
   */
  className?: string
}
