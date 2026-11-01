import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrokerageHoldingsPanel } from "./BrokerageHoldingsPanel";

vi.mock("../../api/holdingsApi", () => ({
  fetchAccountHoldings: vi.fn(),
}));

vi.mock("../../api/assetTradesApi", () => ({
  fetchAssetTrades: vi.fn(),
  createAssetTrade: vi.fn(),
  deleteAssetTrade: vi.fn(),
}));

vi.mock("../../api/instrumentsApi", () => ({
  searchInstruments: vi.fn().mockResolvedValue([]),
}));

import { fetchAccountHoldings } from "../../api/holdingsApi";
import { createAssetTrade, fetchAssetTrades } from "../../api/assetTradesApi";

describe("BrokerageHoldingsPanel", () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(fetchAccountHoldings).mockResolvedValue({
      accountId: 1,
      currency: "USD",
      holdingsValue: 220,
      holdings: [
        {
          id: 1,
          accountId: 1,
          instrumentId: 7,
          symbol: "AAPL",
          name: "Apple",
          quantity: 2,
          lastClose: 110,
          lastCloseAsOf: "2026-01-15",
          marketValue: 220,
          currency: "USD",
        },
      ],
    });
    vi.mocked(fetchAssetTrades).mockResolvedValue({
      items: [
        {
          id: 9,
          accountId: 1,
          instrumentId: 7,
          side: "BUY",
          quantity: 2,
          unitPrice: 100,
          commission: 0,
          currency: "USD",
          occurredAt: "2026-01-10T12:00:00.000Z",
          settlementDate: null,
          notes: null,
          createdAt: "2026-01-10T12:00:00.000Z",
          instrumentSymbol: "AAPL",
          instrumentName: "Apple",
        },
      ],
      nextCursor: null,
    });
  });

  it("shows holdings MTM and records a trade", async () => {
    const onChanged = vi.fn();
    vi.mocked(createAssetTrade).mockResolvedValue({
      id: 10,
      accountId: 1,
      instrumentId: 7,
      side: "BUY",
      quantity: 1,
      unitPrice: 50,
      commission: 0,
      currency: "USD",
      occurredAt: "2026-01-11T12:00:00.000Z",
      settlementDate: null,
      notes: null,
      createdAt: "2026-01-11T12:00:00.000Z",
      instrumentSymbol: "AAPL",
      instrumentName: "Apple",
    });

    render(
      <BrokerageHoldingsPanel
        accountId={1}
        currency="USD"
        onChanged={onChanged}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Mark-to-market/)).toBeTruthy();
    });
    expect(screen.getAllByText(/AAPL/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/Unit price/), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Record trade/i }));
    await waitFor(() => {
      expect(screen.getByText(/Pick an instrument/i)).toBeTruthy();
    });
  });
});
