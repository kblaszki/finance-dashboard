import { apiClient } from "./client";

export type TaxCalendarResponse = {
  taxYear: number;
  deadlines: Array<{ date: string; title: string; description: string }>;
  checklist: Array<{
    key: string;
    label: string;
    completed: boolean;
    completedAt: string | null;
  }>;
  correctionNeeded: boolean;
};

export function fetchTaxCalendar(year: number) {
  const q = new URLSearchParams({ year: String(year) });
  return apiClient.get<TaxCalendarResponse>(`/api/tax-calendar?${q}`);
}

export function updateTaxChecklistItem(taxYear: number, itemKey: string, completed: boolean) {
  return apiClient.put<TaxCalendarResponse["checklist"]>("/api/tax-checklist", {
    taxYear,
    itemKey,
    completed,
  });
}
