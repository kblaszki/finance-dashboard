export type TransactionDateFilter = (
  from?: unknown,
  to?: unknown,
) => { gte?: Date; lte?: Date } | undefined;
