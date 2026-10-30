import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CurrencyProvider,
  CURRENCY_STORAGE_KEY,
  FX_REPORTING_CURRENCIES,
  useCurrency,
} from "./currency";

vi.mock("../api/accountsApi", () => ({
  fetchAccounts: vi.fn(),
}));

import { fetchAccounts } from "../api/accountsApi";

function Probe() {
  const { currencies, currency } = useCurrency();
  return (
    <div>
      <span data-testid="codes">{currencies.join(",")}</span>
      <span data-testid="selected">{currency}</span>
    </div>
  );
}

describe("CurrencyProvider reporting whitelist", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("offers PLN/EUR/USD when any account exists, not only held currencies", async () => {
    vi.mocked(fetchAccounts).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        accountType: "BANK",
        name: "Euro only",
        currency: "EUR",
        cashBalance: 10,
        openingBalance: 10,
        openingCashAsOf: null,
        description: null,
        totalBalance: 10,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(
      <CurrencyProvider>
        <Probe />
      </CurrencyProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("codes").textContent).toBe(
        FX_REPORTING_CURRENCIES.join(","),
      );
    });
    expect(screen.getByTestId("selected").textContent).toBe("EUR");
  });

  it("honors stored reporting currency even when not held", async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, "PLN");
    vi.mocked(fetchAccounts).mockResolvedValue([
      {
        id: 1,
        userId: 1,
        accountType: "BANK",
        name: "USD cash",
        currency: "USD",
        cashBalance: 1,
        openingBalance: 1,
        openingCashAsOf: null,
        description: null,
        totalBalance: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(
      <CurrencyProvider>
        <Probe />
      </CurrencyProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).toBe("PLN");
    });
  });

  it("returns empty currencies when the user has no accounts", async () => {
    vi.mocked(fetchAccounts).mockResolvedValue([]);

    render(
      <CurrencyProvider>
        <Probe />
      </CurrencyProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("codes").textContent).toBe("");
    });
    expect(screen.getByTestId("selected").textContent).toBe("");
  });
});
