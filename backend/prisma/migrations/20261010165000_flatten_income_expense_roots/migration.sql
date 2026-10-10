-- Promote children of legacy Income/Expense roots to roots, then delete those wrappers.
-- nameKey conflicts (duplicate sibling names under null parent) fail the migration.

UPDATE "Category"
SET
  "parentId" = NULL,
  "nameKey" = printf('0:%s', lower("name"))
WHERE "parentId" IN (
  SELECT "id" FROM "Category"
  WHERE "parentId" IS NULL AND ("name" = 'Income' OR "name" = 'Expense')
);

DELETE FROM "Category"
WHERE "parentId" IS NULL AND ("name" = 'Income' OR "name" = 'Expense');
