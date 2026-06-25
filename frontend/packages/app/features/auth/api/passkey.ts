/**
 * Passkey（WebAuthn）クライアント操作（Web/Native 共通・Amplify Cognito）
 *
 * パスワードレスのもう一つの first-factor。Email OTP と共存する。
 * - 登録はサインイン済みユーザーに対してのみ可能（サインアップ時は不可）。
 *   OTP がブートストラップの first-factor になる。
 * - サインインは `USER_AUTH` フロー + `preferredChallenge: 'WEB_AUTHN'`。
 *
 * バックエンドで `loginWith.webAuthn` を有効化していないと動作しない
 * （`frontend/packages/backend/amplify/auth/resource.ts`）。
 *
 * @see https://docs.amplify.aws/nextjs/build-a-backend/auth/manage-users/manage-webauthn-credentials/
 */
import {
  associateWebAuthnCredential,
  deleteWebAuthnCredential,
  listWebAuthnCredentials,
  signIn,
} from 'aws-amplify/auth'

/** 一覧表示用に最小化した passkey 資格情報 */
export interface PasskeyCredential {
  credentialId: string
  friendlyCredentialName: string
  relyingPartyId: string
  createdAt?: Date
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred'
}

/**
 * サインイン済みユーザーに passkey を登録する（ブラウザの WebAuthn セレモニーを起動）。
 */
export async function registerPasskey(): Promise<{ success: true } | { error: string }> {
  try {
    await associateWebAuthnCredential()
    return { success: true }
  } catch (error) {
    console.error('Failed to register passkey:', error)
    return { error: toMessage(error) }
  }
}

/**
 * サインイン済みユーザーの passkey 一覧を取得する。
 */
export async function listPasskeys(): Promise<
  { success: true; credentials: PasskeyCredential[] } | { error: string }
> {
  try {
    const { credentials } = await listWebAuthnCredentials()
    return { success: true, credentials: credentials as PasskeyCredential[] }
  } catch (error) {
    console.error('Failed to list passkeys:', error)
    return { error: toMessage(error) }
  }
}

/**
 * passkey を 1 件削除する。
 */
export async function deletePasskey(
  credentialId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await deleteWebAuthnCredential({ credentialId })
    return { success: true }
  } catch (error) {
    console.error('Failed to delete passkey:', error)
    return { error: toMessage(error) }
  }
}

/**
 * passkey でサインインする（`USER_AUTH` + `WEB_AUTHN`）。
 */
export async function signInWithPasskey(
  email: string
): Promise<{ success: true; isSignedIn: boolean } | { error: string }> {
  try {
    const { nextStep } = await signIn({
      username: email,
      options: { authFlowType: 'USER_AUTH', preferredChallenge: 'WEB_AUTHN' },
    })
    return { success: true, isSignedIn: nextStep.signInStep === 'DONE' }
  } catch (error) {
    console.error('Failed to sign in with passkey:', error)
    return { error: toMessage(error) }
  }
}
