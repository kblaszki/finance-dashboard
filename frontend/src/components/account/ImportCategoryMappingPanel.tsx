import { useMemo, useState } from "react";
import type { Category } from "../../api/categoriesApi";
import type {
  ImportCategoryMapping,
  ImportCategoryPreview,
  ImportDescriptionMapping,
  ImportDescriptionSuggestion,
} from "../../api/transactionsApi";

type PathDecision =
  | { kind: "undecided" }
  | { kind: "map"; categoryId: number }
  | { kind: "create" }
  | { kind: "none" };

type DescDecision =
  | { kind: "undecided" }
  | { kind: "map"; categoryId: number }
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

function initialPathDecisions(
  categories: ImportCategoryPreview[],
): Record<string, PathDecision> {
  const out: Record<string, PathDecision> = {};
  for (const cat of categories) {
    const key = `${cat.ledgerType}\0${cat.path}`;
    out[key] = cat.suggestedCategoryId
      ? { kind: "map", categoryId: cat.suggestedCategoryId }
      : { kind: "undecided" };
  }
  return out;
}

function initialDescDecisions(
  suggestions: ImportDescriptionSuggestion[],
): Record<string, DescDecision> {
  const out: Record<string, DescDecision> = {};
  for (const s of suggestions) {
    const key = `${s.ledgerType}\0${s.descriptionKey}`;
    out[key] = s.suggestedCategoryId
      ? { kind: "map", categoryId: s.suggestedCategoryId }
      : { kind: "undecided" };
  }
  return out;
}

function pathSelectValue(decision: PathDecision): string {
  if (decision.kind === "map") return `map:${decision.categoryId}`;
  if (decision.kind === "create") return "create";
  if (decision.kind === "none") return "none";
  return "";
}

function descSelectValue(decision: DescDecision): string {
  if (decision.kind === "map") return `map:${decision.categoryId}`;
  if (decision.kind === "none") return "none";
  return "";
}

function parsePathSelectValue(value: string): PathDecision {
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

function parseDescSelectValue(value: string): DescDecision {
  if (value === "") return { kind: "undecided" };
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
  descriptionSuggestions: ImportDescriptionSuggestion[];
  ownedCategories: Category[];
  rowCount: number;
  busy: boolean;
  onConfirm: (
    categoryMappings: ImportCategoryMapping[],
    descriptionMappings: ImportDescriptionMapping[],
  ) => void;
  onCancel: () => void;
};

export function ImportCategoryMappingPanel(props: Props) {
  const {
    previewCategories,
    descriptionSuggestions,
    ownedCategories,
    rowCount,
    busy,
    onConfirm,
    onCancel,
  } = props;

  const [pathDecisions, setPathDecisions] = useState(() =>
    initialPathDecisions(previewCategories),
  );
  const [descDecisions, setDescDecisions] = useState(() =>
    initialDescDecisions(descriptionSuggestions),
  );

  const pathLabels = useMemo(
    () => categoryPathLabels(ownedCategories),
    [ownedCategories],
  );

  const pathsDecided = previewCategories.every((cat) => {
    const key = `${cat.ledgerType}\0${cat.path}`;
    return pathDecisions[key]?.kind !== "undecided" && pathDecisions[key] != null;
  });
  const descsDecided = descriptionSuggestions.every((s) => {
    const key = `${s.ledgerType}\0${s.descriptionKey}`;
    return descDecisions[key]?.kind !== "undecided" && descDecisions[key] != null;
  });
  const allDecided = pathsDecided && descsDecided;

  function setPathDecision(cat: ImportCategoryPreview, value: string) {
    const key = `${cat.ledgerType}\0${cat.path}`;
    setPathDecisions((prev) => ({
      ...prev,
      [key]: parsePathSelectValue(value),
    }));
  }

  function setDescDecision(s: ImportDescriptionSuggestion, value: string) {
    const key = `${s.ledgerType}\0${s.descriptionKey}`;
    setDescDecisions((prev) => ({
      ...prev,
      [key]: parseDescSelectValue(value),
    }));
  }

  function handleImport() {
    if (!allDecided) return;
    const categoryMappings: ImportCategoryMapping[] = previewCategories.map(
      (cat) => {
        const key = `${cat.ledgerType}\0${cat.path}`;
        const decision = pathDecisions[key]!;
        if (decision.kind === "map") {
          return {
            path: cat.path,
            ledgerType: cat.ledgerType,
            action: "map",
            categoryId: decision.categoryId,
          };
        }
        if (decision.kind === "create") {
          return {
            path: cat.path,
            ledgerType: cat.ledgerType,
            action: "create",
          };
        }
        return { path: cat.path, ledgerType: cat.ledgerType, action: "none" };
      },
    );
    const descriptionMappings: ImportDescriptionMapping[] =
      descriptionSuggestions.map((s) => {
        const key = `${s.ledgerType}\0${s.descriptionKey}`;
        const decision = descDecisions[key]!;
        if (decision.kind === "map") {
          return {
            descriptionKey: s.descriptionKey,
            ledgerType: s.ledgerType,
            action: "map",
            categoryId: decision.categoryId,
          };
        }
        return {
          descriptionKey: s.descriptionKey,
          ledgerType: s.ledgerType,
          action: "none",
        };
      });
    onConfirm(categoryMappings, descriptionMappings);
  }

  return (
    <section className="card form-section-gap" aria-label="Import category mapping">
      <h2 className="section-title">Confirm import categories</h2>
      <p className="muted">
        Review category paths and description suggestions ({rowCount} row
        {rowCount === 1 ? "" : "s"}). Confirm each before importing.
      </p>

      {previewCategories.length > 0 && (
        <>
          <h3 className="section-title">Category paths from CSV</h3>
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
                  const decision =
                    pathDecisions[key] ?? { kind: "undecided" as const };
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
                          className="field-control"
                          aria-label={`Mapping for ${cat.path}`}
                          value={pathSelectValue(decision)}
                          onChange={(e) => setPathDecision(cat, e.target.value)}
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
        </>
      )}

      {descriptionSuggestions.length > 0 && (
        <>
          <h3 className="section-title">Descriptions without a path</h3>
          <p className="muted">
            Suggestions come from your rules (preferred) or past ledger
            transactions. Mapping saves an exact description rule for next time.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="num">Rows</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {descriptionSuggestions.map((s) => {
                  const key = `${s.ledgerType}\0${s.descriptionKey}`;
                  const decision =
                    descDecisions[key] ?? { kind: "undecided" as const };
                  const options = ownedCategories.filter(
                    (c) => c.ledgerType === s.ledgerType,
                  );
                  return (
                    <tr key={key}>
                      <td>{s.description}</td>
                      <td>
                        <span className="badge">{s.ledgerType}</span>
                      </td>
                      <td className="num">{s.rowCount}</td>
                      <td>
                        {s.suggestionSource === "rule"
                          ? "Rule"
                          : s.suggestionSource === "history"
                            ? "History"
                            : "—"}
                      </td>
                      <td>
                        <select
                          className="field-control"
                          aria-label={`Mapping for description ${s.description}`}
                          value={descSelectValue(decision)}
                          onChange={(e) => setDescDecision(s, e.target.value)}
                          disabled={busy}
                        >
                          <option value="">Choose…</option>
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
        </>
      )}

      <p className="form-section-gap">
        <button
          type="button"
          className="btn-primary"
          disabled={!allDecided || busy}
          onClick={handleImport}
        >
          {busy ? "Importing…" : "Import"}
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
