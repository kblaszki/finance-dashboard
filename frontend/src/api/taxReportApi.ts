import { getApiBaseUrl, getAuthToken } from "./client";

export async function downloadTaxReportCsv(year: number, currency = "PLN"): Promise<void> {
  const params = new URLSearchParams({ year: String(year), currency, format: "csv" });
  const token = getAuthToken();
  const response = await fetch(`${getApiBaseUrl()}/api/stats/tax-report/export?${params}`, {
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
