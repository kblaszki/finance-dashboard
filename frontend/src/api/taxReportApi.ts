const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

import { getAuthToken } from "./client";

export async function downloadTaxReportCsv(year: number, currency = "PLN"): Promise<void> {
  const params = new URLSearchParams({ year: String(year), currency, format: "csv" });
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/stats/tax-report/export?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let message = `Export failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tax-report-${year}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
