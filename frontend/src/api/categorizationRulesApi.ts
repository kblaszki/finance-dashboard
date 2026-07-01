import { apiClient } from './client'

export type CategorizationRule = {
  id: number
  categoryId: number
  categoryName: string | null
  pattern: string
  matchType: 'contains' | 'regex'
  priority: number
  active: boolean
  createdAt: string
}

export type CategorizationRuleInput = {
  categoryId: number
  pattern: string
  matchType?: 'contains' | 'regex'
  priority?: number
  active?: boolean
}

export async function fetchCategorizationRules(): Promise<CategorizationRule[]> {
  return apiClient.get<CategorizationRule[]>('/api/categorization-rules')
}

export async function createCategorizationRule(
  input: CategorizationRuleInput,
): Promise<CategorizationRule> {
  return apiClient.post<CategorizationRule>('/api/categorization-rules', input)
}

export async function updateCategorizationRule(
  id: number,
  input: Partial<CategorizationRuleInput>,
): Promise<CategorizationRule> {
  return apiClient.put<CategorizationRule>(`/api/categorization-rules/${id}`, input)
}

export async function deleteCategorizationRule(id: number): Promise<void> {
  await apiClient.delete(`/api/categorization-rules/${id}`)
}
