/**
 * Mobile 認証の型
 *
 * **Cognito を呼ぶ API 層は `@workspace/auth/api`（Web と共有）が正本**。
 * `.claude/rules/auth.md` §5 が「Web と Mobile で同じ関数をコピペしない」と
 * 定めているため、ここでは型を再輸出するだけで実装は持たない。
 */
export type {
  AuthErrorKey,
  AuthFailure,
  AuthResult,
  AuthSuccess,
  SignInNextStep,
  SignUpNextStep,
} from '@workspace/auth/api'
export type { AuthSuccessKey, AuthValidationKey } from '@workspace/auth/validation'
