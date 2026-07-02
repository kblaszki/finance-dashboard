export function formatMoney(value: number, currency: string, locale = 'en-US') {
  const n = Number(value)
  const ccy = String(currency || '').toUpperCase()

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: ccy,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0)
  } catch {
    const safe = Number.isFinite(n) ? n : 0
    return `${safe.toFixed(2)} ${ccy || ''}`.trim()
  }
}

export function formatPercent(
  value: number | null | undefined,
  options?: { decimals?: number; signed?: boolean },
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const decimals = options?.decimals ?? 2
  const signed = options?.signed ?? false
  const sign = signed && value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

