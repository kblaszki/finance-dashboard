import { useMemo, useState } from "react";
import type {
  AmountSignMode,
  ColumnMapping,
  CsvImportPreset,
  NamedColumnMapping,
  SuggestedColumnMapping,
} from "../../api/transactionsApi";

type Props = {
  headers: string[];
  sampleRows: string[][];
  suggestedMapping: SuggestedColumnMapping;
  presets: CsvImportPreset[];
  matchingPresetId: number | null;
  busy: boolean;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
  onSavePreset: (name: string, mapping: ColumnMapping) => Promise<void>;
  onUpdatePreset: (
    presetId: number,
    mapping: ColumnMapping,
  ) => Promise<void>;
  onDeletePreset: (presetId: number) => Promise<void>;
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

function headerIndex(headers: string[], name: string): number | null {
  const key = name.trim().toLowerCase();
  const i = headers.findIndex((h) => h.trim().toLowerCase() === key);
  return i >= 0 ? i : null;
}

function applyNamedMapping(
  headers: string[],
  named: NamedColumnMapping,
): { ok: true; fields: Record<FieldKey, string>; amountSignMode: AmountSignMode } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  const resolve = (name: string | null | undefined): string => {
    if (name == null || name === "") return "";
    const idx = headerIndex(headers, name);
    if (idx == null) {
      missing.push(name);
      return "";
    }
    return String(idx);
  };
  const occurredAt = resolve(named.occurredAt);
  const amount = resolve(named.amount);
  const description = resolve(named.description ?? null);
  const type = resolve(named.type ?? null);
  const categoryPath = resolve(named.categoryPath ?? null);
  if (!occurredAt || !amount || missing.length > 0) {
    return { ok: false, missing: [...new Set(missing.length ? missing : [named.occurredAt, named.amount].filter(Boolean))] };
  }
  return {
    ok: true,
    fields: { occurredAt, amount, description, type, categoryPath },
    amountSignMode: named.amountSignMode ?? "negativeIsExpense",
  };
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

function initialFromProps(
  headers: string[],
  suggestedMapping: SuggestedColumnMapping,
  presets: CsvImportPreset[],
  matchingPresetId: number | null,
): {
  occurredAt: string;
  amount: string;
  description: string;
  type: string;
  categoryPath: string;
  amountSignMode: AmountSignMode;
  selectedPresetId: string;
  presetMsg: string | null;
  presetErr: string | null;
} {
  const fallback = {
    occurredAt:
      suggestedMapping.occurredAt != null
        ? String(suggestedMapping.occurredAt)
        : "",
    amount:
      suggestedMapping.amount != null ? String(suggestedMapping.amount) : "",
    description:
      suggestedMapping.description != null
        ? String(suggestedMapping.description)
        : "",
    type: suggestedMapping.type != null ? String(suggestedMapping.type) : "",
    categoryPath:
      suggestedMapping.categoryPath != null
        ? String(suggestedMapping.categoryPath)
        : "",
    amountSignMode: suggestedMapping.amountSignMode ?? "negativeIsExpense",
    selectedPresetId: "",
    presetMsg: null as string | null,
    presetErr: null as string | null,
  };
  if (matchingPresetId == null) return fallback;
  const preset = presets.find((p) => p.id === matchingPresetId);
  if (!preset) return fallback;
  const result = applyNamedMapping(headers, preset.mapping);
  if (!result.ok) {
    return {
      ...fallback,
      selectedPresetId: String(matchingPresetId),
      presetErr: `Preset "${preset.name}" needs columns: ${result.missing.join(", ")}`,
    };
  }
  return {
    occurredAt: result.fields.occurredAt,
    amount: result.fields.amount,
    description: result.fields.description,
    type: result.fields.type,
    categoryPath: result.fields.categoryPath,
    amountSignMode: result.amountSignMode,
    selectedPresetId: String(matchingPresetId),
    presetMsg: `Loaded preset “${preset.name}”.`,
    presetErr: null,
  };
}

export function ImportColumnMappingPanel(props: Props) {
  const {
    headers,
    sampleRows,
    suggestedMapping,
    presets,
    matchingPresetId,
    busy,
    onConfirm,
    onCancel,
    onSavePreset,
    onUpdatePreset,
    onDeletePreset,
  } = props;

  const initial = initialFromProps(
    headers,
    suggestedMapping,
    presets,
    matchingPresetId,
  );

  const [occurredAt, setOccurredAt] = useState(initial.occurredAt);
  const [amount, setAmount] = useState(initial.amount);
  const [description, setDescription] = useState(initial.description);
  const [type, setType] = useState(initial.type);
  const [categoryPath, setCategoryPath] = useState(initial.categoryPath);
  const [amountSignMode, setAmountSignMode] = useState(initial.amountSignMode);
  const [selectedPresetId, setSelectedPresetId] = useState(
    initial.selectedPresetId,
  );
  const [presetMsg, setPresetMsg] = useState<string | null>(initial.presetMsg);
  const [presetErr, setPresetErr] = useState<string | null>(initial.presetErr);
  const [saveName, setSaveName] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);

  function applyPreset(preset: CsvImportPreset) {
    setPresetErr(null);
    setPresetMsg(null);
    const result = applyNamedMapping(headers, preset.mapping);
    if (!result.ok) {
      setPresetErr(
        `Preset "${preset.name}" needs columns: ${result.missing.join(", ")}`,
      );
      return;
    }
    setOccurredAt(result.fields.occurredAt);
    setAmount(result.fields.amount);
    setDescription(result.fields.description);
    setType(result.fields.type);
    setCategoryPath(result.fields.categoryPath);
    setAmountSignMode(result.amountSignMode);
    setPresetMsg(`Loaded preset “${preset.name}”.`);
  }

  const typeMapped = type !== "";
  const canSubmit =
    occurredAt !== "" &&
    amount !== "" &&
    occurredAt !== amount &&
    (typeMapped ||
      amountSignMode === "negativeIsExpense" ||
      amountSignMode === "negativeIsIncome");

  const currentMapping = (): ColumnMapping | null => {
    if (!canSubmit) return null;
    const mapping: ColumnMapping = {
      occurredAt: Number(occurredAt),
      amount: Number(amount),
      description: optionalIndex(
        description === "" ? null : Number(description),
      ),
      type: optionalIndex(type === "" ? null : Number(type)),
      categoryPath: optionalIndex(
        categoryPath === "" ? null : Number(categoryPath),
      ),
    };
    if (mapping.type == null) {
      mapping.amountSignMode = amountSignMode;
    }
    return mapping;
  };

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
          disabled={busy || presetBusy}
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
    const mapping = currentMapping();
    if (!mapping) return;
    onConfirm(mapping);
  }

  async function handleSaveAs() {
    const mapping = currentMapping();
    if (!mapping) return;
    const name = saveName.trim();
    if (!name) {
      setPresetErr("Enter a name to save this mapping.");
      return;
    }
    setPresetBusy(true);
    setPresetErr(null);
    setPresetMsg(null);
    try {
      await onSavePreset(name, mapping);
      setSaveName("");
      setPresetMsg(`Saved preset “${name}”.`);
    } catch (err) {
      setPresetErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPresetBusy(false);
    }
  }

  async function handleOverwrite() {
    const mapping = currentMapping();
    const id = Number(selectedPresetId);
    if (!mapping || !Number.isInteger(id) || id < 1) return;
    setPresetBusy(true);
    setPresetErr(null);
    setPresetMsg(null);
    try {
      await onUpdatePreset(id, mapping);
      setPresetMsg("Updated selected preset.");
    } catch (err) {
      setPresetErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPresetBusy(false);
    }
  }

  async function handleDelete() {
    const id = Number(selectedPresetId);
    if (!Number.isInteger(id) || id < 1) return;
    const preset = presets.find((p) => p.id === id);
    if (
      !window.confirm(
        `Delete preset “${preset?.name ?? id}”? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPresetBusy(true);
    setPresetErr(null);
    setPresetMsg(null);
    try {
      await onDeletePreset(id);
      setSelectedPresetId("");
      setPresetMsg("Deleted preset.");
    } catch (err) {
      setPresetErr(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPresetBusy(false);
    }
  }

  return (
    <section className="card form-section-gap" aria-label="Import column mapping">
      <h2 className="section-title">Map CSV columns</h2>
      <p className="muted">
        This file is not a ledger export. Map columns to ledger fields, then
        continue to category mapping. Saved presets are stored for this account.
      </p>

      {presets.length > 0 && (
        <label className="form-section-gap">
          Use saved preset
          <select
            className="field-control"
            aria-label="Use saved preset"
            value={selectedPresetId}
            disabled={busy || presetBusy}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedPresetId(value);
              if (!value) return;
              const preset = presets.find((p) => p.id === Number(value));
              if (preset) applyPreset(preset);
            }}
          >
            <option value="">Choose…</option>
            {presets.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {presetErr && <p className="error-banner">{presetErr}</p>}
      {presetMsg && <p className="success-banner">{presetMsg}</p>}

      <div className="auth-form">
        {columnSelect("occurredAt", occurredAt, setOccurredAt, true)}
        {columnSelect("amount", amount, setAmount, true)}
        {columnSelect("description", description, setDescription, false)}
        {columnSelect("type", type, setType, false)}
        {columnSelect("categoryPath", categoryPath, setCategoryPath, false)}
      </div>

      {!typeMapped && (
        <fieldset className="form-section-gap" disabled={busy || presetBusy}>
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

      <div className="form-actions-row form-section-gap">
        <label>
          Save as preset
          <input
            type="text"
            className="field-control"
            aria-label="Preset name"
            value={saveName}
            disabled={busy || presetBusy || !canSubmit}
            maxLength={80}
            placeholder="e.g. mBank ROR"
            onChange={(e) => setSaveName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || presetBusy || !canSubmit || !saveName.trim()}
          onClick={() => void handleSaveAs()}
        >
          Save
        </button>
        {selectedPresetId !== "" && (
          <>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || presetBusy || !canSubmit}
              onClick={() => void handleOverwrite()}
            >
              Update selected
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || presetBusy}
              onClick={() => void handleDelete()}
            >
              Delete selected
            </button>
          </>
        )}
      </div>

      <p className="form-section-gap">
        <button
          type="button"
          className="btn-primary"
          disabled={!canSubmit || busy || presetBusy}
          onClick={handleContinue}
        >
          {busy ? "Working…" : "Continue"}
        </button>{" "}
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || presetBusy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </p>
    </section>
  );
}
