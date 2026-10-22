import { Link } from "react-router-dom";

export type SetupChecklistProps = {
  hasAccounts: boolean;
  hasCategories: boolean;
  hasCashActivity: boolean;
  /** First account id for the “record a transaction” link. */
  firstAccountId?: number | null;
  compact?: boolean;
};

export function isSetupComplete(props: {
  hasAccounts: boolean;
  hasCategories: boolean;
  hasCashActivity: boolean;
}): boolean {
  return props.hasAccounts && props.hasCategories && props.hasCashActivity;
}

/** Heuristic: any ledger activity vs opening (MVP checklist step 3). */
export function hasCashActivityFromAccounts(
  accounts: Array<{ cashBalance: number; openingBalance: number }>,
): boolean {
  return accounts.some((a) => a.cashBalance !== a.openingBalance);
}

type Step = {
  id: string;
  label: string;
  done: boolean;
  to: string;
};

function buildSteps(props: SetupChecklistProps): Step[] {
  const ledgerTo =
    props.firstAccountId != null
      ? `/accounts/${props.firstAccountId}`
      : "/accounts";
  return [
    {
      id: "account",
      label: "Add an account",
      done: props.hasAccounts,
      to: "/accounts",
    },
    {
      id: "categories",
      label: "Add income or expense categories",
      done: props.hasCategories,
      to: "/categories",
    },
    {
      id: "transaction",
      label: "Record a transaction",
      done: props.hasCashActivity,
      to: ledgerTo,
    },
  ];
}

export function SetupChecklist(props: SetupChecklistProps) {
  const steps = buildSteps(props);
  const pending = steps.filter((s) => !s.done);

  if (props.compact) {
    if (pending.length === 0) return null;
    const next = pending[0]!;
    return (
      <p className="setup-checklist setup-checklist--compact empty-state" role="status">
        Next: <Link to={next.to}>{next.label}</Link>
        {pending.length > 1 ? ` (${pending.length} steps left)` : null}
      </p>
    );
  }

  return (
    <section className="card setup-checklist form-section-gap" aria-label="Getting started">
      <h2 className="section-title">Getting started</h2>
      <p className="muted">
        New workspaces start empty. Complete these steps to see the dashboard
        fill in.
      </p>
      <ol className="setup-checklist__list">
        {steps.map((step) => (
          <li
            key={step.id}
            className={
              step.done
                ? "setup-checklist__item setup-checklist__item--done"
                : "setup-checklist__item"
            }
          >
            <span className="setup-checklist__mark" aria-hidden="true">
              {step.done ? "✓" : "○"}
            </span>
            {step.done ? (
              <span>{step.label}</span>
            ) : (
              <Link to={step.to}>{step.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
