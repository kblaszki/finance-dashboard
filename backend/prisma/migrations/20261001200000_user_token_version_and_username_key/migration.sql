-- AlterTable
ALTER TABLE "User" ADD COLUMN "usernameKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "User" SET "usernameKey" = lower("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameKey_key" ON "User"("usernameKey");
