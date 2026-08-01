import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { fetchAccounts, type Account } from "../api/accountsApi";
import { useAsyncData } from "../hooks/useAsyncData";

export const CURRENCY_STORAGE_KEY = "finance-dashboard:currency";

type CurrencyContextValue = {
  /** All accounts for the signed-in user (single fetch shared across pages). */
  accounts: Account[] | null;
  accountsError: string | null;
  accountsLoading: boolean;
  /** Distinct account currencies, sorted. */
  currencies: string[];
  /** Selected currency; empty string when the user has no accounts. */
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

  const currencies = useMemo(() => {
    if (!accounts) return [];
    return [...new Set(accounts.map((a) => a.currency))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [accounts]);

  const [selected, setSelected] = useState<string>(
    () => localStorage.getItem(CURRENCY_STORAGE_KEY) ?? "",
  );

  const currency =
    currencies.length === 0
      ? ""
      : currencies.includes(selected)
        ? selected
        : currencies[0]!;

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
