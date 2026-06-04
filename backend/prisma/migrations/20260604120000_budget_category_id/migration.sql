-- AlterTable
ALTER TABLE "Budget" ADD COLUMN "categoryId" INTEGER;

-- CreateIndex
CREATE INDEX "Budget_userId_categoryId_idx" ON "Budget"("userId", "categoryId");
