import { apiClient } from "./client";
import { downloadBlob } from "../utils/downloadBlob";

export async function fetchTaxReportCsvBlob(
  year: number,
  currency = "PLN",
): Promise<Blob> {
  const params = new URLSearchParams({ year: String(year), currency, format: "csv" });
  return apiClient.getBlob(`/api/stats/tax-report/export?${params}`);
}

export async function downloadTaxReportCsv(year: number, currency = "PLN"): Promise<void> {
  const blob = await fetchTaxReportCsvBlob(year, currency);
  downloadBlob(blob, `tax-report-${year}.csv`);
}
