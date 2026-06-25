import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('aws-amplify/auth', () => ({
  signInWithRedirect: vi.fn(),
}))

import { signInWithRedirect } from 'aws-amplify/auth'
import { signInWithSocial } from './social'

const mockedRedirect = vi.mocked(signInWithRedirect)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('signInWithSocial', () => {
  it('starts a redirect for the given provider', async () => {
    mockedRedirect.mockResolvedValueOnce(undefined)
    await expect(signInWithSocial('Google')).resolves.toEqual({ success: true })
    expect(mockedRedirect).toHaveBeenCalledWith({ provider: 'Google' })
  })

  it('returns the error message on failure', async () => {
    mockedRedirect.mockRejectedValueOnce(new Error('provider not configured'))
    await expect(signInWithSocial('Apple')).resolves.toEqual({
      error: 'provider not configured',
    })
  })
})
