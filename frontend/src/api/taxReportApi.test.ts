import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "./client";

describe("downloadTaxReportCsv", () => {
  const click = vi.fn();
  const revokeObjectURL = vi.fn();
  let link: HTMLAnchorElement;

  beforeEach(() => {
    setAuthToken("export-token");
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:tax-report"),
      revokeObjectURL,
    });
    link = document.createElement("a");
    vi.spyOn(document, "createElement").mockReturnValue(link);
    vi.spyOn(link, "click").mockImplementation(click);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads CSV with auth header on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(["saleDate,symbol\n"]), { status: 200 }),
    );

    const { downloadTaxReportCsv } = await import("./taxReportApi");
    await downloadTaxReportCsv(2025, "PLN");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/stats\/tax-report\/export\?year=2025&currency=PLN&format=csv/),
      expect.objectContaining({
        headers: { Authorization: "Bearer export-token" },
      }),
    );
    expect(link.download).toBe("tax-report-2025.csv");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tax-report");
  });

  it("throws API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "year must be an integer between 2000 and 2100" }), {
        status: 400,
      }),
    );

    const { downloadTaxReportCsv } = await import("./taxReportApi");
    await expect(downloadTaxReportCsv(1999)).rejects.toThrow(
      "year must be an integer between 2000 and 2100",
    );
  });
});
