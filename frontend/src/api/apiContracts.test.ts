import { describe, expect, it } from 'vitest'
import {
  authConfigFixture,
  authUserFixture,
  validateApiContractFixtures,
} from './fixtures/apiContracts'
import type { AuthConfig, AuthUser } from './authApi'

describe('API contract fixtures', () => {
  it('validates fixture shapes against frontend types', () => {
    expect(() => validateApiContractFixtures()).not.toThrow()
  })

  it('auth user fixture matches AuthUser type fields', () => {
    const user: AuthUser = authUserFixture
    expect(user.email).toContain('@')
    expect(user.username.length).toBeGreaterThan(0)
  })

  it('auth config fixture matches AuthConfig type fields', () => {
    const config: AuthConfig = authConfigFixture
    expect(typeof config.allowRegister).toBe('boolean')
  })
})
