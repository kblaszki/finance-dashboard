import { apiClient } from './client'

export type AssetValuation = {
  id: number
  accountId: number | null
  accountName: string | null
  instrumentId: number | null
  instrumentSymbol: string | null
  valuedOn: string
  value: number
  currency: string
  source: string
  description: string | null
  createdAt: string
}

export type AssetValuationInput = {
  accountId?: number
  instrumentId?: number
  value: number
  currency: string
  date: string
  source?: string
  description?: string
}

export async function fetchAssetValuations(params?: {
  accountId?: number
  instrumentId?: number
  from?: string
  to?: string
}): Promise<AssetValuation[]> {
  const search = new URLSearchParams()
  if (params?.accountId != null) search.set('accountId', String(params.accountId))
  if (params?.instrumentId != null) search.set('instrumentId', String(params.instrumentId))
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  const qs = search.toString()
  return apiClient.get<AssetValuation[]>(`/api/asset-valuations${qs ? `?${qs}` : ''}`)
}

export async function createAssetValuation(input: AssetValuationInput): Promise<AssetValuation> {
  return apiClient.post<AssetValuation>('/api/asset-valuations', input)
}

export async function deleteAssetValuation(id: number): Promise<void> {
  await apiClient.delete(`/api/asset-valuations/${id}`)
}
