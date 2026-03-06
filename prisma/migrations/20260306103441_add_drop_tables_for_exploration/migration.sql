-- AlterTable
ALTER TABLE "ExplorationArea" ADD COLUMN     "baseDropTableId" TEXT,
ADD COLUMN     "battleDropTableId" TEXT,
ADD COLUMN     "lastBossDropTableId" TEXT,
ADD COLUMN     "midBossDropTableId" TEXT,
ADD COLUMN     "skillDropTableId" TEXT;

-- CreateTable
CREATE TABLE "DropTable" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "areaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DropTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DropTableEntry" (
    "id" TEXT NOT NULL,
    "dropTableId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DropTableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DropTable_code_key" ON "DropTable"("code");

-- CreateIndex
CREATE INDEX "DropTableEntry_dropTableId_idx" ON "DropTableEntry"("dropTableId");

-- CreateIndex
CREATE INDEX "DropTableEntry_itemId_idx" ON "DropTableEntry"("itemId");

-- AddForeignKey
ALTER TABLE "DropTable" ADD CONSTRAINT "DropTable_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ExplorationArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropTableEntry" ADD CONSTRAINT "DropTableEntry_dropTableId_fkey" FOREIGN KEY ("dropTableId") REFERENCES "DropTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropTableEntry" ADD CONSTRAINT "DropTableEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationArea" ADD CONSTRAINT "ExplorationArea_baseDropTableId_fkey" FOREIGN KEY ("baseDropTableId") REFERENCES "DropTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationArea" ADD CONSTRAINT "ExplorationArea_battleDropTableId_fkey" FOREIGN KEY ("battleDropTableId") REFERENCES "DropTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationArea" ADD CONSTRAINT "ExplorationArea_skillDropTableId_fkey" FOREIGN KEY ("skillDropTableId") REFERENCES "DropTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationArea" ADD CONSTRAINT "ExplorationArea_midBossDropTableId_fkey" FOREIGN KEY ("midBossDropTableId") REFERENCES "DropTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationArea" ADD CONSTRAINT "ExplorationArea_lastBossDropTableId_fkey" FOREIGN KEY ("lastBossDropTableId") REFERENCES "DropTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
