export type LedgerFilterState = {
  fromDate: string;
  toDate: string;
  type: string;
  categoryId: string;
  tagId: string;
  description: string;
};

export type TransferFilterState = {
  fromDate: string;
  toDate: string;
  fromAccountId: string;
  toAccountId: string;
  categoryId: string;
  description: string;
};

export const EMPTY_LEDGER_FILTERS: LedgerFilterState = {
  fromDate: "",
  toDate: "",
  type: "",
  categoryId: "",
  tagId: "",
  description: "",
};

export const EMPTY_TRANSFER_FILTERS: TransferFilterState = {
  fromDate: "",
  toDate: "",
  fromAccountId: "",
  toAccountId: "",
  categoryId: "",
  description: "",
};

function isoDateLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function inDateRange(iso: string, fromDate: string, toDate: string): boolean {
  const day = isoDateLocal(iso);
  if (!day) return false;
  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;
  return true;
}

export function filterLedgerRows<
  T extends {
    occurredAt: string;
    type: string;
    categoryId: number | null;
    tagIds?: number[];
    description: string | null;
  },
>(rows: T[], filters: LedgerFilterState): T[] {
  const needle = filters.description.trim().toLowerCase();
  return rows.filter((row) => {
    if (!inDateRange(row.occurredAt, filters.fromDate, filters.toDate)) {
      return false;
    }
    if (filters.type && String(row.type).toUpperCase() !== filters.type) {
      return false;
    }
    if (filters.categoryId === "none") {
      if (row.categoryId != null) return false;
    } else if (filters.categoryId) {
      if (row.categoryId !== Number(filters.categoryId)) return false;
    }
    if (filters.tagId) {
      const tagId = Number(filters.tagId);
      if (!(row.tagIds ?? []).includes(tagId)) return false;
    }
    if (needle) {
      const desc = (row.description ?? "").toLowerCase();
      if (!desc.includes(needle)) return false;
    }
    return true;
  });
}

export function filterTransferRows<
  T extends {
    occurredAt: string;
    fromAccountId: number;
    toAccountId: number;
    categoryId: number | null;
    description: string | null;
  },
>(rows: T[], filters: TransferFilterState): T[] {
  const needle = filters.description.trim().toLowerCase();
  return rows.filter((row) => {
    if (!inDateRange(row.occurredAt, filters.fromDate, filters.toDate)) {
      return false;
    }
    if (
      filters.fromAccountId &&
      row.fromAccountId !== Number(filters.fromAccountId)
    ) {
      return false;
    }
    if (
      filters.toAccountId &&
      row.toAccountId !== Number(filters.toAccountId)
    ) {
      return false;
    }
    if (filters.categoryId === "none") {
      if (row.categoryId != null) return false;
    } else if (filters.categoryId) {
      if (row.categoryId !== Number(filters.categoryId)) return false;
    }
    if (needle) {
      const desc = (row.description ?? "").toLowerCase();
      if (!desc.includes(needle)) return false;
    }
    return true;
  });
}

export function isLedgerFilterActive(filters: LedgerFilterState): boolean {
  return Object.values(filters).some((v) => v !== "");
}

export function isTransferFilterActive(filters: TransferFilterState): boolean {
  return Object.values(filters).some((v) => v !== "");
}
