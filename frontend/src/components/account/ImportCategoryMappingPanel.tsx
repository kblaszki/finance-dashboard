import { useMemo, useState } from "react";
import type { Category } from "../../api/categoriesApi";
import type {
  ImportCategoryMapping,
  ImportCategoryPreview,
} from "../../api/transactionsApi";

type Decision =
  | { kind: "undecided" }
  | { kind: "map"; categoryId: number }
  | { kind: "create" }
  | { kind: "none" };

function categoryPathLabels(
  categories: Category[],
): Map<number, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const cache = new Map<number, string | null>();

  function pathFor(id: number, stack: Set<number>): string | null {
    if (cache.has(id)) return cache.get(id)!;
    if (stack.has(id)) {
      cache.set(id, null);
      return null;
    }
    const cat = byId.get(id);
    if (!cat) {
      cache.set(id, null);
      return null;
    }
    stack.add(id);
    let path: string | null;
    if (cat.parentId == null) {
      path = cat.name;
    } else {
      const parent = pathFor(cat.parentId, stack);
      path = parent ? `${parent}/${cat.name}` : null;
    }
    stack.delete(id);
    cache.set(id, path);
    return path;
  }

  const result = new Map<number, string>();
  for (const cat of categories) {
    const path = pathFor(cat.id, new Set());
    if (path) result.set(cat.id, path);
  }
  return result;
}

function initialDecisions(
  categories: ImportCategoryPreview[],
): Record<string, Decision> {
  const out: Record<string, Decision> = {};
  for (const cat of categories) {
    const key = `${cat.ledgerType}\0${cat.path}`;
    out[key] = cat.suggestedCategoryId
      ? { kind: "map", categoryId: cat.suggestedCategoryId }
      : { kind: "undecided" };
  }
  return out;
}

function decisionSelectValue(decision: Decision): string {
  if (decision.kind === "map") return `map:${decision.categoryId}`;
  if (decision.kind === "create") return "create";
  if (decision.kind === "none") return "none";
  return "";
}

function parseSelectValue(value: string): Decision {
  if (value === "") return { kind: "undecided" };
  if (value === "create") return { kind: "create" };
  if (value === "none") return { kind: "none" };
  if (value.startsWith("map:")) {
    const id = Number(value.slice(4));
    if (Number.isInteger(id) && id >= 1) {
      return { kind: "map", categoryId: id };
    }
  }
  return { kind: "undecided" };
}

type Props = {
  previewCategories: ImportCategoryPreview[];
  ownedCategories: Category[];
  rowCount: number;
  busy: boolean;
  onConfirm: (mappings: ImportCategoryMapping[]) => void;
  onCancel: () => void;
};

export function ImportCategoryMappingPanel(props: Props) {
  const {
    previewCategories,
    ownedCategories,
    rowCount,
    busy,
    onConfirm,
    onCancel,
  } = props;

  const [decisions, setDecisions] = useState(() =>
    initialDecisions(previewCategories),
  );

  const pathLabels = useMemo(
    () => categoryPathLabels(ownedCategories),
    [ownedCategories],
  );

  const allDecided = previewCategories.every((cat) => {
    const key = `${cat.ledgerType}\0${cat.path}`;
    return decisions[key]?.kind !== "undecided" && decisions[key] != null;
  });

  function setDecision(cat: ImportCategoryPreview, value: string) {
    const key = `${cat.ledgerType}\0${cat.path}`;
    setDecisions((prev) => ({ ...prev, [key]: parseSelectValue(value) }));
  }

  function handleImport() {
    if (!allDecided) return;
    const mappings: ImportCategoryMapping[] = previewCategories.map((cat) => {
      const key = `${cat.ledgerType}\0${cat.path}`;
      const decision = decisions[key]!;
      if (decision.kind === "map") {
        return {
          path: cat.path,
          ledgerType: cat.ledgerType,
          action: "map",
          categoryId: decision.categoryId,
        };
      }
      if (decision.kind === "create") {
        return { path: cat.path, ledgerType: cat.ledgerType, action: "create" };
      }
      return { path: cat.path, ledgerType: cat.ledgerType, action: "none" };
    });
    onConfirm(mappings);
  }

  return (
    <section className="card form-section-gap" aria-label="Import category mapping">
      <h2 className="section-title">Map import categories</h2>
      <p className="muted">
        Review each category used in the CSV ({rowCount} row
        {rowCount === 1 ? "" : "s"}). Choose an existing category, create the
        path, or import without a category.
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Path</th>
              <th>Type</th>
              <th className="num">Rows</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {previewCategories.map((cat) => {
              const key = `${cat.ledgerType}\0${cat.path}`;
              const decision = decisions[key] ?? { kind: "undecided" as const };
              const options = ownedCategories.filter(
                (c) => c.ledgerType === cat.ledgerType,
              );
              return (
                <tr key={key}>
                  <td>{cat.path}</td>
                  <td>
                    <span className="badge">{cat.ledgerType}</span>
                  </td>
                  <td className="num">{cat.rowCount}</td>
                  <td>
                    <select
                      aria-label={`Mapping for ${cat.path}`}
                      value={decisionSelectValue(decision)}
                      onChange={(e) => setDecision(cat, e.target.value)}
                      disabled={busy}
                    >
                      <option value="">Choose…</option>
                      <option value="create">Create new path</option>
                      <option value="none">No category</option>
                      {options.map((opt) => (
                        <option key={opt.id} value={`map:${opt.id}`}>
                          Map to {pathLabels.get(opt.id) ?? opt.name}
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
      <p className="form-section-gap">
        <button
          type="button"
          className="btn-primary"
          disabled={!allDecided || busy}
          onClick={handleImport}
        >
          {busy ? "Importing…" : "Import"}
        </button>{" "}
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </p>
    </section>
  );
}
