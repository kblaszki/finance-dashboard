import { apiClient } from './client'

export type CouponScheduleType = 'coupon' | 'amortization'

export type CouponSchedule = {
  id: number
  accountId: number
  accountName: string | null
  instrumentId: number
  instrumentSymbol: string | null
  instrumentType: string | null
  scheduleType: CouponScheduleType
  paymentOn: string
  amount: number
  currency: string
  description: string | null
  incomeEventId: number | null
  recorded: boolean
  createdAt: string
}

export type CouponScheduleInput = {
  accountId: number
  instrumentId: number
  scheduleType: CouponScheduleType
  amount: number
  currency: string
  date: string
  description?: string
}

export async function fetchCouponSchedules(params?: {
  accountId?: number
  instrumentId?: number
  from?: string
  to?: string
}): Promise<CouponSchedule[]> {
  const search = new URLSearchParams()
  if (params?.accountId != null) search.set('accountId', String(params.accountId))
  if (params?.instrumentId != null) search.set('instrumentId', String(params.instrumentId))
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  const qs = search.toString()
  return apiClient.get<CouponSchedule[]>(`/api/coupon-schedules${qs ? `?${qs}` : ''}`)
}

export async function createCouponSchedule(input: CouponScheduleInput): Promise<CouponSchedule> {
  return apiClient.post<CouponSchedule>('/api/coupon-schedules', input)
}

export async function recordCouponScheduleIncome(id: number): Promise<CouponSchedule> {
  return apiClient.post<CouponSchedule>(`/api/coupon-schedules/${id}/record-income`, {})
}

export async function deleteCouponSchedule(id: number): Promise<void> {
  await apiClient.delete(`/api/coupon-schedules/${id}`)
}
