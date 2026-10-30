import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { fetchAccounts, type Account } from "../api/accountsApi";
import { useAsyncData } from "../hooks/useAsyncData";

export const CURRENCY_STORAGE_KEY = "finance-dashboard:currency";

/** NBP reporting currencies for net worth / cashflow KPIs (matches backend FX allow-list). */
export const FX_REPORTING_CURRENCIES = ["EUR", "PLN", "USD"] as const;

type CurrencyContextValue = {
  /** All accounts for the signed-in user (single fetch shared across pages). */
  accounts: Account[] | null;
  accountsError: string | null;
  accountsLoading: boolean;
  /** Reporting currencies offered in the top bar (empty until the user has accounts). */
  currencies: string[];
  /** Selected reporting currency; empty string when the user has no accounts. */
  currency: string;
  setCurrency: (code: string) => void;
  /** Re-fetch accounts (call after account create/update/delete). */
  refreshAccounts: () => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider(props: { children: React.ReactNode }) {
  const loadAccounts = useCallback(() => fetchAccounts(), []);
  const {
    data: accounts,
    error: accountsError,
    loading: accountsLoading,
    reload: refreshAccounts,
  } = useAsyncData(loadAccounts);

  const currencies = useMemo((): string[] => {
    if (!accounts || accounts.length === 0) return [];
    return [...FX_REPORTING_CURRENCIES];
  }, [accounts]);

  const [selected, setSelected] = useState<string>(
    () => localStorage.getItem(CURRENCY_STORAGE_KEY) ?? "",
  );

  const currency = useMemo(() => {
    if (currencies.length === 0) return "";
    if (currencies.includes(selected)) return selected;
    const held = accounts
      ? [...new Set(accounts.map((a) => a.currency))]
      : [];
    const heldPreferred = held.find((code) => currencies.includes(code));
    return heldPreferred ?? currencies[0]!;
  }, [accounts, currencies, selected]);

  const setCurrency = useCallback((code: string) => {
    setSelected(code);
    localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  }, []);

  const value = useMemo(
    () => ({
      accounts,
      accountsError,
      accountsLoading,
      currencies,
      currency,
      setCurrency,
      refreshAccounts,
    }),
    [
      accounts,
      accountsError,
      accountsLoading,
      currencies,
      currency,
      setCurrency,
      refreshAccounts,
    ],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {props.children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
