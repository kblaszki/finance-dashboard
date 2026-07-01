export const TAX_CHECKLIST_ITEMS = [
  { key: "pit38", label: "Review PIT-38 capital gains" },
  { key: "belka", label: "Review Belka on interest/coupons" },
  { key: "pit_zg", label: "Prepare PIT/ZG foreign income" },
  { key: "rental", label: "Complete rental income section" },
  { key: "crypto", label: "Review crypto disposals (PIT scale)" },
  { key: "property_sales", label: "Record property sales" },
  { key: "attachments", label: "Attach cost evidence documents" },
] as const;

export type TaxChecklistItemKey = (typeof TAX_CHECKLIST_ITEMS)[number]["key"];

export function pitFilingDeadline(taxYear: number): string {
  return `${taxYear + 1}-04-30`;
}

export function taxCalendarDeadlines(taxYear: number): Array<{ date: string; title: string; description: string }> {
  return [
    {
      date: `${taxYear + 1}-02-28`,
      title: "PIT advance reminders",
      description: "Review tax advances and provisions recorded in liabilities (FR-029).",
    },
    {
      date: pitFilingDeadline(taxYear),
      title: "Annual PIT filing deadline",
      description: "Submit PIT return for tax year (standard deadline 30 April).",
    },
    {
      date: `${taxYear + 1}-04-30`,
      title: "Belka settlement check",
      description: "Verify Belka withheld vs due on interest and coupons (FR-027).",
    },
  ];
}
