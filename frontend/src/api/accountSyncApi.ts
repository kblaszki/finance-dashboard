import { apiClient } from './client'

export type AccountSyncSetting = {
  id: number
  accountId: number
  accountName: string | null
  accountType: string | null
  provider: string
  syncEnabled: boolean
  syncIntervalHours: number
  lastSyncAt: string | null
  lastSyncStatus: string | null
  configJson: string | null
  createdAt: string
  updatedAt: string
}

export type AccountSyncInput = {
  provider?: string
  syncEnabled?: boolean
  syncIntervalHours?: number
  configJson?: string | null
}

export async function fetchAccountSyncSettings(): Promise<AccountSyncSetting[]> {
  return apiClient.get<AccountSyncSetting[]>('/api/account-sync')
}

export async function upsertAccountSyncSetting(
  accountId: number,
  input: AccountSyncInput,
): Promise<AccountSyncSetting> {
  return apiClient.put<AccountSyncSetting>(`/api/account-sync/${accountId}`, input)
}

export async function runAccountSync(accountId: number): Promise<unknown> {
  return apiClient.post(`/api/account-sync/${accountId}/run`, {})
}
