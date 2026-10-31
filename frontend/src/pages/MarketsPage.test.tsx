import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketsPage } from "./MarketsPage";

vi.mock("../api/instrumentsApi", () => ({
  searchInstruments: vi.fn(),
  addInstrumentToAllowlist: vi.fn(),
}));

vi.mock("../api/watchlistApi", () => ({
  fetchWatchlist: vi.fn(),
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
}));

import {
  addInstrumentToAllowlist,
  searchInstruments,
} from "../api/instrumentsApi";
import {
  addToWatchlist,
  fetchWatchlist,
  removeFromWatchlist,
} from "../api/watchlistApi";

const instrument = {
  id: 1,
  symbol: "AAPL",
  name: "Apple Inc",
  exchange: "NASDAQ",
  micCode: "XNAS",
  country: "United States",
  currency: "USD",
  assetClass: "STOCK",
  provider: "twelve_data",
  providerSymbol: "AAPL",
  allowlisted: true,
};

const catalogInstrument = {
  id: 2,
  symbol: "TSLA",
  name: "Tesla Inc",
  exchange: "NASDAQ",
  micCode: "XNAS",
  country: "United States",
  currency: "USD",
  assetClass: "STOCK",
  provider: "twelve_data",
  providerSymbol: "TSLA",
  allowlisted: false,
};

function renderMarkets() {
  return render(
    <MemoryRouter initialEntries={["/markets"]}>
      <Routes>
        <Route path="/markets" element={<MarketsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MarketsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchWatchlist).mockResolvedValue([]);
    vi.mocked(searchInstruments).mockImplementation(async (params) => {
      if (params.scope === "catalog") return [catalogInstrument];
      return [instrument];
    });
    vi.mocked(addInstrumentToAllowlist).mockResolvedValue({
      ...catalogInstrument,
      allowlisted: true,
    });
    vi.mocked(addToWatchlist).mockResolvedValue({
      instrumentId: 1,
      createdAt: "2026-10-30T00:00:00.000Z",
      instrument,
      lastClose: 190.12,
      asOf: "2026-10-29",
    });
    vi.mocked(removeFromWatchlist).mockResolvedValue(undefined);
  });

  it("searches allowlist and adds to watchlist", async () => {
    renderMarkets();
    expect(
      await screen.findByText(/No favorites yet/),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "AAPL" },
    });
    await waitFor(() => {
      expect(searchInstruments).toHaveBeenCalledWith({
        q: "AAPL",
        limit: 25,
        scope: "allowlist",
      });
    });
    expect(await screen.findByText("Apple Inc")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(addToWatchlist).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(fetchWatchlist).toHaveBeenCalled();
    });
  });

  it("searches catalog and adds to allowlist", async () => {
    renderMarkets();

    fireEvent.change(screen.getByLabelText("Catalog search"), {
      target: { value: "TSLA" },
    });
    await waitFor(() => {
      expect(searchInstruments).toHaveBeenCalledWith({
        q: "TSLA",
        limit: 25,
        scope: "catalog",
      });
    });
    expect(await screen.findByText("Tesla Inc")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add to markets" }));
    await waitFor(() => {
      expect(addInstrumentToAllowlist).toHaveBeenCalledWith(2);
    });
  });

  it("shows watchlist last close and remove", async () => {
    vi.mocked(fetchWatchlist).mockResolvedValue([
      {
        instrumentId: 1,
        createdAt: "2026-10-30T00:00:00.000Z",
        instrument,
        lastClose: 190.12,
        asOf: "2026-10-29",
      },
    ]);
    renderMarkets();
    expect(await screen.findByText("2026-10-29")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(removeFromWatchlist).toHaveBeenCalledWith(1);
    });
  });
});
