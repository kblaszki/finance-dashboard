import { ChartCard } from "../ui/ChartCard";
import type { RollupRow } from "../../utils/statisticsRollup";
import { CategoryBars } from "./CategoryBars";

export function BreakdownPanel(props: {
  title: string;
  rows: RollupRow[];
  currency: string;
  tone: "positive" | "negative" | "neutral";
  emptyLabel: string;
  subtitle: string;
  byLabel?: string;
}) {
  const {
    title,
    rows,
    currency,
    tone,
    emptyLabel,
    subtitle,
    byLabel = "category",
  } = props;
  return (
    <ChartCard
      title={`${title} by ${byLabel}`}
      subtitle={subtitle}
      size="sm"
    >
      <CategoryBars
        rows={rows}
        currency={currency}
        tone={tone}
        emptyLabel={emptyLabel}
      />
    </ChartCard>
  );
}
