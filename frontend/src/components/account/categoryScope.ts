import type {
  Category,
  CategoryLedgerType,
} from "../../api/categoriesApi";
import type { CashTxType } from "../../api/transactionsApi";

/** Category ids with matching ledgerType (roots included — they are the default tags). */
export function categoryIdsForLedgerType(
  categories: Category[],
  type: CashTxType | CategoryLedgerType,
): Set<number> {
  const ids = new Set<number>();
  for (const cat of categories) {
    if (cat.ledgerType !== type) continue;
    ids.add(cat.id);
  }
  return ids;
}

/** Categories in one ledger group, name-sorted for selects. */
export function categoriesForLedgerType(
  categories: Category[],
  type: CategoryLedgerType,
): Category[] {
  return categories
    .filter((cat) => cat.ledgerType === type)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}
