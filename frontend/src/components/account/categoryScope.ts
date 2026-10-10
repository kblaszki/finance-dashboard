import type { Category } from "../../api/categoriesApi";
import type { CashTxType } from "../../api/transactionsApi";

/**
 * Category ids with matching ledgerType.
 * Ledger pickers pass excludeRoots so transactions are not tagged with scope roots.
 */
export function categoryIdsForLedgerType(
  categories: Category[],
  type: CashTxType,
  options?: { excludeRoots?: boolean },
): Set<number> {
  const excludeRoots = options?.excludeRoots ?? false;
  const ids = new Set<number>();
  for (const cat of categories) {
    if (cat.ledgerType !== type) continue;
    if (excludeRoots && cat.parentId == null) continue;
    ids.add(cat.id);
  }
  return ids;
}
