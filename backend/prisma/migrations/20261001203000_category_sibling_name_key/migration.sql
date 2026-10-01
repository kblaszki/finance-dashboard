-- AlterTable
ALTER TABLE "Category" ADD COLUMN "nameKey" TEXT NOT NULL DEFAULT '';

UPDATE "Category"
SET "nameKey" = printf('%d:%s', IFNULL("parentId", 0), lower("name"));

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_nameKey_key" ON "Category"("userId", "nameKey");
