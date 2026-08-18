import type { AuthResult } from '@workspace/auth/api'

/**
 * Web 固有のフォーム props 型
 *
 * `AuthResult` など**プラットフォーム非依存の契約は `@workspace/auth/api` が正本**。
 * ここには Web の UI にしか存在しない props だけを置く。
 */
export type { AuthResult }

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
