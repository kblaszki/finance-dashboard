import { type FormEvent, useState } from "react";
import type { Category, CategoryLedgerType } from "../../api/categoriesApi";
import {
  createCategoryDescriptionRule,
  deleteCategoryDescriptionRule,
  type CategoryDescriptionRule,
} from "../../api/categoryDescriptionRulesApi";

type CashTxType = "INCOME" | "EXPENSE";

export function DescriptionRulesPanel(props: {
  rules: CategoryDescriptionRule[] | null;
  rulesLoading: boolean;
  rulesError: string | null;
  categories: Category[];
  nameById: Map<number, string>;
  onReload: () => void;
  onActionError: (message: string | null) => void;
}) {
  const [rulePattern, setRulePattern] = useState("");
  const [ruleLedgerType, setRuleLedgerType] = useState<CashTxType>("EXPENSE");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleBusy, setRuleBusy] = useState(false);

  const ruleCategoryOptions = props.categories.filter(
    (c) => c.ledgerType === (ruleLedgerType as CategoryLedgerType),
  );

  async function handleCreateRule(e: FormEvent) {
    e.preventDefault();
    props.onActionError(null);
    const pattern = rulePattern.trim();
    const categoryId = Number(ruleCategoryId);
    if (!pattern) {
      props.onActionError("Rule pattern required");
      return;
    }
    if (!Number.isInteger(categoryId) || categoryId < 1) {
      props.onActionError("Choose a category for the rule");
      return;
    }
    setRuleBusy(true);
    try {
      await createCategoryDescriptionRule({
        pattern,
        ledgerType: ruleLedgerType,
        categoryId,
      });
      setRulePattern("");
      setRuleCategoryId("");
      props.onReload();
    } catch (err) {
      props.onActionError(
        err instanceof Error ? err.message : "Create rule failed",
      );
    } finally {
      setRuleBusy(false);
    }
  }

  async function handleDeleteRule(rule: CategoryDescriptionRule) {
    if (!window.confirm(`Delete rule “${rule.pattern}”?`)) return;
    props.onActionError(null);
    try {
      await deleteCategoryDescriptionRule(rule.id);
      props.onReload();
    } catch (err) {
      props.onActionError(
        err instanceof Error ? err.message : "Delete rule failed",
      );
    }
  }

  return (
    <section
      className="card form-section-gap"
      aria-label="Description category rules"
    >
      <h2 className="section-title">Description rules</h2>
      <p className="muted">
        If an import description contains the pattern, suggest this category
        (rules beat ledger history). Confirming a map on import also saves an
        exact-description rule.
      </p>
      {props.rulesError && (
        <p className="error-banner">{props.rulesError}</p>
      )}
      {props.rulesLoading ? (
        <p className="muted">Loading rules…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Type</th>
                <th>Category</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(props.rules ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No description rules yet.
                  </td>
                </tr>
              ) : (
                (props.rules ?? []).map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.pattern}</td>
                    <td>
                      <span className="badge">{rule.ledgerType}</span>
                    </td>
                    <td>
                      {props.nameById.get(rule.categoryId) ??
                        `#${rule.categoryId}`}
                    </td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="btn-danger"
                        aria-label={`Delete rule ${rule.pattern}`}
                        onClick={() => void handleDeleteRule(rule)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <form
        className="form-section-gap"
        onSubmit={(e) => void handleCreateRule(e)}
      >
        <div className="form-actions-row">
          <input
            className="field-control"
            placeholder="Pattern (contains)"
            value={rulePattern}
            onChange={(e) => setRulePattern(e.target.value)}
            aria-label="Rule pattern"
            disabled={ruleBusy}
          />
          <select
            className="field-control"
            value={ruleLedgerType}
            onChange={(e) => {
              setRuleLedgerType(e.target.value as CashTxType);
              setRuleCategoryId("");
            }}
            aria-label="Rule ledger type"
            disabled={ruleBusy}
          >
            <option value="EXPENSE">EXPENSE</option>
            <option value="INCOME">INCOME</option>
          </select>
          <select
            className="field-control"
            value={ruleCategoryId}
            onChange={(e) => setRuleCategoryId(e.target.value)}
            aria-label="Rule category"
            disabled={ruleBusy}
          >
            <option value="">Category…</option>
            {ruleCategoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary" disabled={ruleBusy}>
            {ruleBusy ? "Adding…" : "Add rule"}
          </button>
        </div>
      </form>
    </section>
  );
}
