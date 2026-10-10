import type { Category } from "../../api/categoriesApi";
import type { CashTxType } from "../../api/transactionsApi";

/** Category ids with matching ledgerType (roots included — they are the default tags). */
export function categoryIdsForLedgerType(
  categories: Category[],
  type: CashTxType,
): Set<number> {
  const ids = new Set<number>();
  for (const cat of categories) {
    if (cat.ledgerType !== type) continue;
    ids.add(cat.id);
  }
  return ids;
}
