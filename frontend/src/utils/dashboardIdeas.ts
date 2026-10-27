import type { NetWorth, PeriodSummary } from "../api/statisticsApi";
import { formatMoney, formatPercent } from "./format";

export type DashboardIdea = {
  id: string;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
};

export function buildDashboardIdeas(input: {
  currency: string;
  summary: PeriodSummary | null;
  netWorth: NetWorth | null;
}): DashboardIdea[] {
  const { currency, summary, netWorth } = input;
  const ideas: DashboardIdea[] = [];

  if (summary && summary.net > 0) {
    ideas.push({
      id: "surplus",
      title: "Use the monthly surplus",
      body: `This month’s net is ${formatMoney(summary.net, currency)}. Review where the surplus sits across accounts before the next contribution.`,
      href: "/statistics",
      linkLabel: "Open statistics",
    });
  }

  if (summary && summary.income > 0) {
    const rate = (summary.net / summary.income) * 100;
    ideas.push({
      id: "savings-rate",
      title: "Check your savings rhythm",
      body: `Savings ratio this month is ${formatPercent(rate, { decimals: 1 })}. Compare it with prior months on the statistics page.`,
      href: "/statistics",
      linkLabel: "Compare periods",
    });
  }

  if (netWorth && netWorth.liabilities > 0) {
    ideas.push({
      id: "liabilities",
      title: "Review credit balances",
      body: `Liabilities of ${formatMoney(netWorth.liabilities, currency)} reduce net worth. Confirm card balances and upcoming payments.`,
      href: "/accounts",
      linkLabel: "View accounts",
    });
  } else if (netWorth) {
    ideas.push({
      id: "allocation",
      title: "Review account mix",
      body: "Cash balances are grouped by account type on this page. Revisit whether each sleeve still matches how you use the money.",
      href: "/accounts",
      linkLabel: "Manage accounts",
    });
  }

  if (ideas.length === 0) {
    ideas.push({
      id: "transfers",
      title: "Move cash between accounts",
      body: "Internal transfers keep ledgers tidy when you rebalance cash across bank and brokerage accounts.",
      href: "/transfers",
      linkLabel: "Open transfers",
    });
  }

  return ideas.slice(0, 3);
}
