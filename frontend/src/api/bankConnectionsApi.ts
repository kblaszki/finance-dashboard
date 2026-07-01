import { apiClient } from './client'

export type BankConnection = {
  id: number
  accountId: number
  accountName: string | null
  accountCurrency: string | null
  bankCode: string
  status: string
  consentExpiresAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  stubNote?: string
}

export async function fetchBankConnections(): Promise<BankConnection[]> {
  return apiClient.get<BankConnection[]>('/api/bank-connections')
}

export async function createBankConnection(input: {
  accountId: number
  bankCode: string
}): Promise<BankConnection> {
  return apiClient.post<BankConnection>('/api/bank-connections', input)
}

export async function authorizeBankConnection(id: number): Promise<BankConnection> {
  return apiClient.post<BankConnection>(`/api/bank-connections/${id}/authorize`, {})
}

export async function deleteBankConnection(id: number): Promise<void> {
  await apiClient.delete(`/api/bank-connections/${id}`)
}
