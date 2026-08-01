import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}))

import { apiClient, setAuthToken } from './client'
import {
  register,
  login,
  fetchMe,
  logoutLocal,
  fetchAuthConfig,
  updateProfile,
  updatePassword,
  updateEmail,
} from './authApi'
import {
  fetchAccounts,
  createAccount,
  fetchAccount,
  updateAccount,
  deleteAccount,
} from './accountsApi'

describe('API modules', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({})
    vi.mocked(apiClient.post).mockResolvedValue({ token: 't', user: {} })
    vi.mocked(apiClient.put).mockResolvedValue({})
    vi.mocked(apiClient.patch).mockResolvedValue({})
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('authApi calls correct endpoints', async () => {
    await fetchAuthConfig()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/config')

    await register('a@b.c', 'user', 'pass')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'a@b.c',
      username: 'user',
      password: 'pass',
    })

    await login('a@b.c', 'pass')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      login: 'a@b.c',
      password: 'pass',
    })

    await fetchMe()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/me')

    await updateProfile('newname')
    expect(apiClient.patch).toHaveBeenCalledWith('/api/auth/profile', { username: 'newname' })

    await updatePassword('old', 'newpass99')
    expect(apiClient.patch).toHaveBeenCalledWith('/api/auth/password', {
      currentPassword: 'old',
      newPassword: 'newpass99',
    })

    await updateEmail('x@y.z', 'old')
    expect(apiClient.patch).toHaveBeenCalledWith('/api/auth/email', {
      email: 'x@y.z',
      currentPassword: 'old',
    })

    logoutLocal()
    expect(setAuthToken).toHaveBeenCalledWith(null)
  })

  it('accountsApi calls correct endpoints', async () => {
    await fetchAccounts()
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts')

    await createAccount({
      name: 'Checking',
      currency: 'PLN',
      openingBalance: 10,
      accountType: 'BANK',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/accounts', {
      name: 'Checking',
      currency: 'PLN',
      openingBalance: 10,
      accountType: 'BANK',
    })

    await fetchAccount(7)
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/7')

    await updateAccount(7, { name: 'Renamed', description: null })
    expect(apiClient.patch).toHaveBeenCalledWith('/api/accounts/7', {
      name: 'Renamed',
      description: null,
    })

    await deleteAccount(7)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/accounts/7')
  })
})
