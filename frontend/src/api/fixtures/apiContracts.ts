import type { AuthConfig, AuthUser } from '../authApi'

export const authUserFixture: AuthUser = {
  id: 1,
  email: 'user@example.com',
  username: 'user',
}

export const authConfigFixture: AuthConfig = {
  allowRegister: true,
}

function assertAuthUserShape(value: AuthUser): void {
  if (typeof value.id !== 'number') throw new Error('authUser.id')
  if (typeof value.email !== 'string') throw new Error('authUser.email')
  if (typeof value.username !== 'string') throw new Error('authUser.username')
}

function assertAuthConfigShape(value: AuthConfig): void {
  if (typeof value.allowRegister !== 'boolean') throw new Error('authConfig.allowRegister')
}

export function validateApiContractFixtures(): void {
  assertAuthUserShape(authUserFixture)
  assertAuthConfigShape(authConfigFixture)
}
