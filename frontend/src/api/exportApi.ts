import { apiClient } from './client'

export type AuditLogEntry = {
  id: number
  entityType: string
  entityId: number
  action: string
  before: unknown
  after: unknown
  createdAt: string
}

export async function fetchFullExport(): Promise<unknown> {
  return apiClient.get('/api/export/full?format=json')
}

export async function fetchAuditLogs(params?: {
  entityType?: string
  limit?: number
}): Promise<AuditLogEntry[]> {
  const search = new URLSearchParams()
  if (params?.entityType) search.set('entityType', params.entityType)
  if (params?.limit != null) search.set('limit', String(params.limit))
  const qs = search.toString()
  return apiClient.get<AuditLogEntry[]>(`/api/audit-logs${qs ? `?${qs}` : ''}`)
}
