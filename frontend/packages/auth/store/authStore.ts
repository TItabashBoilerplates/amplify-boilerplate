import { create } from 'zustand'

/**
 * 認証ユーザー情報（Cognito / Amplify Auth）
 *
 * `aws-amplify/auth` の `getCurrentUser()` + `fetchUserAttributes()` から組み立てる、
 * フレームワーク・プラットフォーム非依存の最小ユーザー表現。
 */
export interface AuthUser {
  /** Cognito の sub（一意なユーザーID） */
  userId: string
  /** サインインに使ったユーザー名（Email OTP の場合は email） */
  username: string
  /** メールアドレス（属性が取得できた場合） */
  email?: string
}

/**
 * 認証状態の型定義
 */
export interface AuthState {
  /** 現在のユーザー情報（未認証なら null） */
  user: AuthUser | null

  /** 認証済みかどうか */
  isAuthenticated: boolean

  /**
   * 認証ユーザーを設定（null で未認証）。
   * `isAuthenticated` は user の有無から自動導出する。
   */
  setUser: (user: AuthUser | null) => void

  /** 認証状態をリセット */
  reset: () => void
}

/**
 * 認証状態管理用 Zustand ストア
 *
 * Amplify (Cognito) の認証状態をグローバルに管理する。
 * `AuthProvider` / `NativeAuthProvider` からのみ更新され、コンポーネントからは
 * セレクタ付きフック（`useAuthUser` / `useIsAuthenticated`）で読み取る。
 *
 * @example
 * ```tsx
 * const user = useAuthUser()
 * const isAuthenticated = useIsAuthenticated()
 * ```
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
    }),

  reset: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}))
