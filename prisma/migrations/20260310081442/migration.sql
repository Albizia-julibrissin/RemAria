/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Expedition` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Expedition_userId_idx";

-- AlterTable
ALTER TABLE "Expedition" ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ExpeditionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "partyPresetId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "battleWinCount" INTEGER NOT NULL DEFAULT 0,
    "skillSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "totalExpGained" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpeditionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpeditionHistory_userId_idx" ON "ExpeditionHistory"("userId");

-- CreateIndex
CREATE INDEX "ExpeditionHistory_finishedAt_idx" ON "ExpeditionHistory"("finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Expedition_userId_key" ON "Expedition"("userId");

-- AddForeignKey
ALTER TABLE "ExpeditionHistory" ADD CONSTRAINT "ExpeditionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
