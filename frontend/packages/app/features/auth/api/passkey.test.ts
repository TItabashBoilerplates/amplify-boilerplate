import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('aws-amplify/auth', () => ({
  associateWebAuthnCredential: vi.fn(),
  listWebAuthnCredentials: vi.fn(),
  deleteWebAuthnCredential: vi.fn(),
  signIn: vi.fn(),
}))

import {
  associateWebAuthnCredential,
  deleteWebAuthnCredential,
  listWebAuthnCredentials,
  signIn,
} from 'aws-amplify/auth'
import { deletePasskey, listPasskeys, registerPasskey, signInWithPasskey } from './passkey'

const mocked = {
  associate: vi.mocked(associateWebAuthnCredential),
  list: vi.mocked(listWebAuthnCredentials),
  remove: vi.mocked(deleteWebAuthnCredential),
  signIn: vi.mocked(signIn),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('registerPasskey', () => {
  it('returns success when the credential is associated', async () => {
    mocked.associate.mockResolvedValueOnce(undefined)
    await expect(registerPasskey()).resolves.toEqual({ success: true })
    expect(mocked.associate).toHaveBeenCalledOnce()
  })

  it('returns the error message on failure', async () => {
    mocked.associate.mockRejectedValueOnce(new Error('not signed in'))
    await expect(registerPasskey()).resolves.toEqual({ error: 'not signed in' })
  })
})

describe('listPasskeys', () => {
  it('returns the credentials list', async () => {
    const credentials = [
      { credentialId: 'c1', friendlyCredentialName: 'MacBook', relyingPartyId: 'localhost' },
    ]
    mocked.list.mockResolvedValueOnce({ credentials } as never)
    await expect(listPasskeys()).resolves.toEqual({ success: true, credentials })
  })

  it('returns the error message on failure', async () => {
    mocked.list.mockRejectedValueOnce(new Error('boom'))
    await expect(listPasskeys()).resolves.toEqual({ error: 'boom' })
  })
})

describe('deletePasskey', () => {
  it('deletes by credentialId', async () => {
    mocked.remove.mockResolvedValueOnce(undefined)
    await expect(deletePasskey('c1')).resolves.toEqual({ success: true })
    expect(mocked.remove).toHaveBeenCalledWith({ credentialId: 'c1' })
  })

  it('returns the error message on failure', async () => {
    mocked.remove.mockRejectedValueOnce(new Error('nope'))
    await expect(deletePasskey('c1')).resolves.toEqual({ error: 'nope' })
  })
})

describe('signInWithPasskey', () => {
  it('uses USER_AUTH + WEB_AUTHN and reports signed-in', async () => {
    mocked.signIn.mockResolvedValueOnce({ nextStep: { signInStep: 'DONE' } } as never)
    await expect(signInWithPasskey('a@b.com')).resolves.toEqual({
      success: true,
      isSignedIn: true,
    })
    expect(mocked.signIn).toHaveBeenCalledWith({
      username: 'a@b.com',
      options: { authFlowType: 'USER_AUTH', preferredChallenge: 'WEB_AUTHN' },
    })
  })

  it('reports not-yet-signed-in for a non-DONE next step', async () => {
    mocked.signIn.mockResolvedValueOnce({
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE' },
    } as never)
    await expect(signInWithPasskey('a@b.com')).resolves.toEqual({
      success: true,
      isSignedIn: false,
    })
  })

  it('returns the error message on failure', async () => {
    mocked.signIn.mockRejectedValueOnce(new Error('no passkey'))
    await expect(signInWithPasskey('a@b.com')).resolves.toEqual({ error: 'no passkey' })
  })
})
