-- CreateTable
CREATE TABLE "ExplorationAreaCost" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ExplorationAreaCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExplorationAreaCost_areaId_idx" ON "ExplorationAreaCost"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "ExplorationAreaCost_areaId_itemId_key" ON "ExplorationAreaCost"("areaId", "itemId");

-- AddForeignKey
ALTER TABLE "ExplorationAreaCost" ADD CONSTRAINT "ExplorationAreaCost_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ExplorationArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationAreaCost" ADD CONSTRAINT "ExplorationAreaCost_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
