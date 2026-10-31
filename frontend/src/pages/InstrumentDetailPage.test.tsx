import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstrumentDetailPage } from "./InstrumentDetailPage";

vi.mock("../api/instrumentsApi", () => ({
  fetchInstrumentHistory: vi.fn(),
}));

import { fetchInstrumentHistory } from "../api/instrumentsApi";

const historyPayload = {
  instrument: {
    id: 7,
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
  },
  currency: "USD",
  months: 12,
  year: null,
  oldestYear: 2016,
  newestYear: 2026,
  from: "2025-10-31",
  to: "2026-10-31",
  series: [
    { asOf: "2026-10-01", close: 180 },
    { asOf: "2026-10-15", close: 190 },
  ],
  backfilled: false,
};

function renderDetail(id = "7") {
  return render(
    <MemoryRouter initialEntries={[`/markets/${id}`]}>
      <Routes>
        <Route path="/markets/:instrumentId" element={<InstrumentDetailPage />} />
        <Route path="/markets" element={<div>Markets list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InstrumentDetailPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchInstrumentHistory).mockResolvedValue(historyPayload);
  });

  it("loads history and shows symbol", async () => {
    renderDetail();
    await waitFor(() => {
      expect(fetchInstrumentHistory).toHaveBeenCalledWith(7, { months: 12 });
    });
    expect(await screen.findByRole("heading", { name: "AAPL" })).toBeTruthy();
    expect(screen.getByText(/Apple Inc/)).toBeTruthy();
  });

  it("changes months range", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "AAPL" });
    fireEvent.change(screen.getByLabelText("Price history range"), {
      target: { value: "3" },
    });
    await waitFor(() => {
      expect(fetchInstrumentHistory).toHaveBeenCalledWith(7, { months: 3 });
    });
  });

  it("pages calendar years", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "AAPL" });
    fireEvent.change(screen.getByLabelText("Price history range"), {
      target: { value: "year" },
    });
    await waitFor(() => {
      expect(fetchInstrumentHistory).toHaveBeenCalledWith(7, { year: 2026 });
    });
    fireEvent.click(screen.getByLabelText("Previous year"));
    await waitFor(() => {
      expect(fetchInstrumentHistory).toHaveBeenCalledWith(7, { year: 2025 });
    });
  });
});
