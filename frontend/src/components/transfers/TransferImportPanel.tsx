import { useEffect, useMemo, useState } from "react";
import type { Account } from "../../api/accountsApi";
import type {
  TransferAccountMapping,
  TransferAccountPreview,
  TransferImportRowPreview,
} from "../../api/transfersApi";
import { formatMoney } from "../../utils/format";

type Props = {
  accountsPreview: TransferAccountPreview[];
  ownedAccounts: Account[];
  rowCount: number;
  rows: TransferImportRowPreview[] | null;
  busy: boolean;
  accountById: Map<number, Account>;
  onContinue: (mappings: TransferAccountMapping[]) => void;
  onImport: (mappings: TransferAccountMapping[], skipRows: number[]) => void;
  onCancel: () => void;
};

function mappingKey(name: string, currency: string): string {
  return `${currency}\0${name}`;
}

export function TransferImportPanel(props: Props) {
  const {
    accountsPreview,
    ownedAccounts,
    rowCount,
    rows,
    busy,
    accountById,
    onContinue,
    onImport,
    onCancel,
  } = props;

  const [selections, setSelections] = useState<Record<string, number | "">>(
    () => {
      const init: Record<string, number | ""> = {};
      for (const account of accountsPreview) {
        const key = mappingKey(account.name, account.currency);
        init[key] = account.suggestedAccountId ?? "";
      }
      return init;
    },
  );

  const [includeRows, setIncludeRows] = useState<Record<number, boolean>>({});

  const step = rows == null ? 1 : 2;

  const mappingsReady = accountsPreview.every((account) => {
    const key = mappingKey(account.name, account.currency);
    const value = selections[key];
    return typeof value === "number" && value >= 1;
  });

  const currentMappings = useMemo((): TransferAccountMapping[] => {
    return accountsPreview.map((account) => {
      const key = mappingKey(account.name, account.currency);
      return {
        name: account.name,
        currency: account.currency,
        accountId: selections[key] as number,
      };
    });
  }, [accountsPreview, selections]);

  useEffect(() => {
    if (rows == null) return;
    const next: Record<number, boolean> = {};
    for (const row of rows) {
      next[row.row] = !row.duplicate;
    }
    setIncludeRows(next);
  }, [rows]);

  function isIncluded(row: TransferImportRowPreview): boolean {
    if (includeRows[row.row] !== undefined) return includeRows[row.row]!;
    return !row.duplicate;
  }

  const importCount = rows?.filter((row) => isIncluded(row)).length ?? 0;

  function handleContinue() {
    if (!mappingsReady) return;
    onContinue(currentMappings);
  }

  function handleImport() {
    if (!rows || !mappingsReady) return;
    const skipRows = rows.filter((row) => !isIncluded(row)).map((row) => row.row);
    onImport(currentMappings, skipRows);
  }

  return (
    <section className="card form-section-gap" aria-label="Import transfers">
      <h2 className="section-title">
        {step === 1 ? "Map import accounts" : "Review transfers"}
      </h2>
      <p className="muted">
        {step === 1
          ? `Map each account used in the CSV (${rowCount} transfer row${rowCount === 1 ? "" : "s"}) to one of your existing accounts with the same currency.`
          : "Duplicates are unchecked by default. Re-enable a row to import it again."}
      </p>

      {step === 1 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name in file</th>
                <th>Currency</th>
                <th className="num">Rows</th>
                <th>Your account</th>
              </tr>
            </thead>
            <tbody>
              {accountsPreview.map((account) => {
                const key = mappingKey(account.name, account.currency);
                const options = ownedAccounts.filter(
                  (a) => a.currency === account.currency,
                );
                return (
                  <tr key={key}>
                    <td>{account.name}</td>
                    <td>
                      <span className="badge">{account.currency}</span>
                    </td>
                    <td className="num">{account.rowCount}</td>
                    <td>
                      <select
                        className="field-control"
                        aria-label={`Mapping for ${account.name} ${account.currency}`}
                        value={selections[key] === "" ? "" : String(selections[key])}
                        disabled={busy}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setSelections((prev) => ({
                            ...prev,
                            [key]: raw === "" ? "" : Number(raw),
                          }));
                        }}
                      >
                        <option value="">Choose…</option>
                        {options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {step === 2 && rows && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Import</th>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th className="num">Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const from = accountById.get(row.fromAccountId);
                const to = accountById.get(row.toAccountId);
                return (
                  <tr key={row.row}>
                    <td>
                      <input
                        type="checkbox"
                        className="field-control"
                        aria-label={`Include row ${row.row}`}
                        checked={isIncluded(row)}
                        disabled={busy}
                        onChange={(e) =>
                          setIncludeRows((prev) => ({
                            ...prev,
                            [row.row]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td>{row.occurredAt.slice(0, 10)}</td>
                    <td>{from?.name ?? `#${row.fromAccountId}`}</td>
                    <td>{to?.name ?? `#${row.toAccountId}`}</td>
                    <td className="num">
                      {formatMoney(
                        row.amountFrom,
                        from?.currency ?? to?.currency ?? "PLN",
                      )}
                      {from && to && from.currency !== to.currency
                        ? ` → ${formatMoney(row.amountTo, to.currency)}`
                        : ""}
                    </td>
                    <td>
                      {row.duplicate && (
                        <span className="badge">Duplicate</span>
                      )}{" "}
                      {row.description ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="form-section-gap">
        {step === 1 ? (
          <button
            type="button"
            className="btn-primary"
            disabled={!mappingsReady || busy}
            onClick={handleContinue}
          >
            {busy ? "Loading…" : "Continue"}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={handleImport}
          >
            {busy
              ? "Importing…"
              : `Import ${importCount} transfer${importCount === 1 ? "" : "s"}`}
          </button>
        )}{" "}
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
