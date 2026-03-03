export function formatMoney(value: number, currency: string, locale = 'pl-PL') {
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

