import { useMemo, useState } from "react";
import type {
  AmountSignMode,
  ColumnMapping,
  SuggestedColumnMapping,
} from "../../api/transactionsApi";

type Props = {
  headers: string[];
  sampleRows: string[][];
  suggestedMapping: SuggestedColumnMapping;
  busy: boolean;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
};

type FieldKey = "occurredAt" | "amount" | "description" | "type" | "categoryPath";

const FIELD_LABELS: Record<FieldKey, string> = {
  occurredAt: "Date (required)",
  amount: "Amount (required)",
  description: "Description",
  type: "Type (INCOME/EXPENSE)",
  categoryPath: "Category path",
};

function optionalIndex(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function parseSignedAmountPreview(raw: string): number | null {
  const t = String(raw ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  let s = t;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function previewType(
  amountRaw: string,
  typeRaw: string | null,
  amountSignMode: AmountSignMode,
): { type: "INCOME" | "EXPENSE"; amount: number } | null {
  if (typeRaw != null && typeRaw.trim()) {
    const t = typeRaw.trim().toUpperCase();
    if (t === "INCOME" || t === "EXPENSE") {
      const signed = parseSignedAmountPreview(amountRaw);
      if (signed == null) return null;
      return { type: t, amount: Math.abs(signed) };
    }
    return null;
  }
  const signed = parseSignedAmountPreview(amountRaw);
  if (signed == null || signed === 0) return null;
  const abs = Math.abs(signed);
  if (amountSignMode === "negativeIsExpense") {
    return { type: signed < 0 ? "EXPENSE" : "INCOME", amount: abs };
  }
  return { type: signed < 0 ? "INCOME" : "EXPENSE", amount: abs };
}

export function ImportColumnMappingPanel(props: Props) {
  const { headers, sampleRows, suggestedMapping, busy, onConfirm, onCancel } =
    props;

  const [occurredAt, setOccurredAt] = useState<string>(
    suggestedMapping.occurredAt != null
      ? String(suggestedMapping.occurredAt)
      : "",
  );
  const [amount, setAmount] = useState<string>(
    suggestedMapping.amount != null ? String(suggestedMapping.amount) : "",
  );
  const [description, setDescription] = useState<string>(
    suggestedMapping.description != null
      ? String(suggestedMapping.description)
      : "",
  );
  const [type, setType] = useState<string>(
    suggestedMapping.type != null ? String(suggestedMapping.type) : "",
  );
  const [categoryPath, setCategoryPath] = useState<string>(
    suggestedMapping.categoryPath != null
      ? String(suggestedMapping.categoryPath)
      : "",
  );
  const [amountSignMode, setAmountSignMode] = useState<AmountSignMode>(
    suggestedMapping.amountSignMode ?? "negativeIsExpense",
  );

  const typeMapped = type !== "";
  const canSubmit =
    occurredAt !== "" &&
    amount !== "" &&
    occurredAt !== amount &&
    (typeMapped || amountSignMode === "negativeIsExpense" || amountSignMode === "negativeIsIncome");

  const previewRows = useMemo(() => {
    const dateIdx = occurredAt === "" ? null : Number(occurredAt);
    const amountIdx = amount === "" ? null : Number(amount);
    const descIdx = description === "" ? null : Number(description);
    const typeIdx = type === "" ? null : Number(type);
    if (dateIdx == null || amountIdx == null) return [];
    return sampleRows.map((row) => {
      const amountRaw = row[amountIdx] ?? "";
      const typeRaw = typeIdx != null ? (row[typeIdx] ?? null) : null;
      const computed = previewType(amountRaw, typeRaw, amountSignMode);
      return {
        date: row[dateIdx] ?? "",
        description: descIdx != null ? (row[descIdx] ?? "") : "",
        amountRaw,
        type: computed?.type ?? "?",
        amount: computed?.amount ?? null,
      };
    });
  }, [
    sampleRows,
    occurredAt,
    amount,
    description,
    type,
    amountSignMode,
  ]);

  function columnSelect(
    field: FieldKey,
    value: string,
    onChange: (v: string) => void,
    required: boolean,
  ) {
    return (
      <label key={field}>
        {FIELD_LABELS[field]}
        <select
          className="field-control"
          aria-label={FIELD_LABELS[field]}
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{required ? "Choose…" : "— None —"}</option>
          {headers.map((h, i) => (
            <option key={`${field}-${i}`} value={String(i)}>
              {h || `(column ${i + 1})`}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function handleContinue() {
    if (!canSubmit) return;
    const mapping: ColumnMapping = {
      occurredAt: Number(occurredAt),
      amount: Number(amount),
      description: optionalIndex(description === "" ? null : Number(description)),
      type: optionalIndex(type === "" ? null : Number(type)),
      categoryPath: optionalIndex(
        categoryPath === "" ? null : Number(categoryPath),
      ),
    };
    if (mapping.type == null) {
      mapping.amountSignMode = amountSignMode;
    }
    onConfirm(mapping);
  }

  return (
    <section className="card form-section-gap" aria-label="Import column mapping">
      <h2 className="section-title">Map CSV columns</h2>
      <p className="muted">
        This file is not a ledger export. Map columns to ledger fields, then
        continue to category mapping.
      </p>

      <div className="auth-form">
        {columnSelect("occurredAt", occurredAt, setOccurredAt, true)}
        {columnSelect("amount", amount, setAmount, true)}
        {columnSelect("description", description, setDescription, false)}
        {columnSelect("type", type, setType, false)}
        {columnSelect("categoryPath", categoryPath, setCategoryPath, false)}
      </div>

      {!typeMapped && (
        <fieldset className="form-section-gap" disabled={busy}>
          <legend>Amount sign meaning</legend>
          <label>
            <input
              type="radio"
              name="amountSignMode"
              checked={amountSignMode === "negativeIsExpense"}
              onChange={() => setAmountSignMode("negativeIsExpense")}
            />{" "}
            Negative = expense (bank / ROR)
          </label>{" "}
          <label>
            <input
              type="radio"
              name="amountSignMode"
              checked={amountSignMode === "negativeIsIncome"}
              onChange={() => setAmountSignMode("negativeIsIncome")}
            />{" "}
            Negative = income (credit card)
          </label>
        </fieldset>
      )}

      {previewRows.length > 0 && (
        <div className="table-wrap form-section-gap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Raw amount</th>
                <th>Type</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i}>
                  <td>{row.date}</td>
                  <td>{row.description}</td>
                  <td>{row.amountRaw}</td>
                  <td>
                    <span className="badge">{row.type}</span>
                  </td>
                  <td className="num">
                    {row.amount != null ? row.amount.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="form-section-gap">
        <button
          type="button"
          className="btn-primary"
          disabled={!canSubmit || busy}
          onClick={handleContinue}
        >
          {busy ? "Working…" : "Continue"}
        </button>{" "}
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </p>
    </section>
  );
}
