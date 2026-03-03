type FxRatesPlnPerUnit = {
  asOf: string
  plnPerUnit: Record<string, number>
}

let cached: { value: FxRatesPlnPerUnit; fetchedAtMs: number } | null = null

function normalizeCurrency(code: string): string {
  return String(code || "").trim().toUpperCase()
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n)
}

async function fetchJson(url: string): Promise<any> {
  const fetchFn = (globalThis as any).fetch as undefined | ((...args: any[]) => Promise<any>)
  if (!fetchFn) {
    throw new Error("Global fetch() is not available (requires Node 18+).")
  }

  const res = await fetchFn(url, {
    headers: { Accept: "application/json" },
  })
  if (!res?.ok) {
    const status = res?.status ?? "unknown"
    throw new Error(`FX request failed (status ${status})`)
  }
  return await res.json()
}

export async function getFxRatesPlnPerUnit(opts?: {
  ttlMs?: number
}): Promise<FxRatesPlnPerUnit> {
  const ttlMs = opts?.ttlMs ?? 6 * 60 * 60 * 1000
  const now = Date.now()

  if (cached && now - cached.fetchedAtMs < ttlMs) {
    return cached.value
  }

  // NBP table A: mid is PLN per 1 unit foreign currency
  const nbp = await fetchJson("https://api.nbp.pl/api/exchangerates/tables/A?format=json")
  const table = Array.isArray(nbp) ? nbp[0] : null
  const rates = (table?.rates ?? []) as Array<{ code?: string; mid?: number }>
  const effectiveDate = String(table?.effectiveDate ?? new Date().toISOString().slice(0, 10))

  const plnPerUnit: Record<string, number> = { PLN: 1 }
  for (const r of rates) {
    const code = normalizeCurrency(String(r.code ?? ""))
    if (!code) continue
    if (isFiniteNumber(r.mid) && r.mid > 0) {
      plnPerUnit[code] = r.mid
    }
  }

  const value: FxRatesPlnPerUnit = { asOf: effectiveDate, plnPerUnit }
  cached = { value, fetchedAtMs: now }
  return value
}

export function convertAmount(amount: number, fromCurrency: string, toCurrency: string, plnPerUnit: Record<string, number>): number {
  const from = normalizeCurrency(fromCurrency)
  const to = normalizeCurrency(toCurrency)

  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number")
  }
  if (from === to) return amount

  const fromRate = plnPerUnit[from]
  const toRate = plnPerUnit[to]

  if (!isFiniteNumber(fromRate) || fromRate <= 0) {
    throw new Error(`Missing FX rate for currency ${from}`)
  }
  if (!isFiniteNumber(toRate) || toRate <= 0) {
    throw new Error(`Missing FX rate for currency ${to}`)
  }

  // Cross-rate via PLN (NBP base)
  // amount(from) * PLN/fromUnit / (PLN/toUnit) = amount(to)
  return (amount * fromRate) / toRate
}

export function getMissingCurrencies(currencies: Iterable<string>, plnPerUnit: Record<string, number>): string[] {
  const missing = new Set<string>()
  for (const c of currencies) {
    const code = normalizeCurrency(c)
    if (!code) continue
    if (!plnPerUnit[code]) missing.add(code)
  }
  return [...missing].sort()
}

