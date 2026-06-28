import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken, setUnauthorizedHandler } from "./client";

describe("taxReportApi", () => {
  beforeEach(() => {
    setAuthToken("export-token");
    setUnauthorizedHandler(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetchTaxReportCsvBlob sends auth header on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(["saleDate,symbol\n"]), { status: 200 }),
    );

    const { fetchTaxReportCsvBlob } = await import("./taxReportApi");
    const blob = await fetchTaxReportCsvBlob(2025, "PLN");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/stats\/tax-report\/export\?year=2025&currency=PLN&format=csv/),
      expect.objectContaining({
        headers: { Authorization: "Bearer export-token" },
      }),
    );
    expect(blob.size).toBeGreaterThan(0);
  });

  it("throws API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "year must be an integer between 2000 and 2100" }), {
        status: 400,
      }),
    );

    const { fetchTaxReportCsvBlob } = await import("./taxReportApi");
    await expect(fetchTaxReportCsvBlob(1999)).rejects.toThrow(
      "year must be an integer between 2000 and 2100",
    );
  });

  it("calls unauthorized handler on 401", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    const { fetchTaxReportCsvBlob } = await import("./taxReportApi");
    await expect(fetchTaxReportCsvBlob(2025)).rejects.toThrow("Unauthorized");
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("downloadTaxReportCsv triggers browser download", async () => {
    const click = vi.fn();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:tax-report"),
      revokeObjectURL,
    });
    const link = document.createElement("a");
    vi.spyOn(document, "createElement").mockReturnValue(link);
    vi.spyOn(link, "click").mockImplementation(click);

    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(["saleDate,symbol\n"]), { status: 200 }),
    );

    const { downloadTaxReportCsv } = await import("./taxReportApi");
    await downloadTaxReportCsv(2025, "PLN");

    expect(link.download).toBe("tax-report-2025.csv");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tax-report");
  });
});
