-- AlterTable: default EXPENSE for unknown roots; Income tree backfilled next.
ALTER TABLE "Category" ADD COLUMN "ledgerType" TEXT NOT NULL DEFAULT 'EXPENSE';

-- Backfill Income root + all descendants (seed root name is case-sensitive).
UPDATE "Category"
SET "ledgerType" = 'INCOME'
WHERE "id" IN (
  WITH RECURSIVE income_tree(id) AS (
    SELECT "id" FROM "Category" WHERE "parentId" IS NULL AND "name" = 'Income'
    UNION ALL
    SELECT c."id" FROM "Category" AS c
    INNER JOIN income_tree AS t ON c."parentId" = t.id
  )
  SELECT id FROM income_tree
);

-- Explicit Expense tree (already EXPENSE from default; keeps rename-safe roots clear).
UPDATE "Category"
SET "ledgerType" = 'EXPENSE'
WHERE "id" IN (
  WITH RECURSIVE expense_tree(id) AS (
    SELECT "id" FROM "Category" WHERE "parentId" IS NULL AND "name" = 'Expense'
    UNION ALL
    SELECT c."id" FROM "Category" AS c
    INNER JOIN expense_tree AS t ON c."parentId" = t.id
  )
  SELECT id FROM expense_tree
);

-- CreateIndex
CREATE INDEX "Category_userId_ledgerType_idx" ON "Category"("userId", "ledgerType");
