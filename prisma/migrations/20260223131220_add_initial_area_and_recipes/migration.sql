-- AlterTable
ALTER TABLE "FacilityType" ADD COLUMN     "cost" INTEGER NOT NULL DEFAULT 40,
ALTER COLUMN "kind" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PlacementArea" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxCost" INTEGER NOT NULL,
    "maxSlots" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placementAreaId" TEXT NOT NULL,
    "facilityTypeId" TEXT NOT NULL,
    "variantCode" TEXT NOT NULL DEFAULT 'base',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "facilityTypeId" TEXT NOT NULL,
    "cycleMinutes" INTEGER NOT NULL,
    "outputItemId" TEXT NOT NULL,
    "outputAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeInput" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlacementArea_code_key" ON "PlacementArea"("code");

-- CreateIndex
CREATE INDEX "FacilityInstance_userId_idx" ON "FacilityInstance"("userId");

-- CreateIndex
CREATE INDEX "FacilityInstance_placementAreaId_idx" ON "FacilityInstance"("placementAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityInstance_userId_placementAreaId_facilityTypeId_vari_key" ON "FacilityInstance"("userId", "placementAreaId", "facilityTypeId", "variantCode");

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE INDEX "Recipe_facilityTypeId_idx" ON "Recipe"("facilityTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_facilityTypeId_key" ON "Recipe"("facilityTypeId");

-- CreateIndex
CREATE INDEX "RecipeInput_recipeId_idx" ON "RecipeInput"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeInput_recipeId_itemId_key" ON "RecipeInput"("recipeId", "itemId");

-- AddForeignKey
ALTER TABLE "FacilityInstance" ADD CONSTRAINT "FacilityInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityInstance" ADD CONSTRAINT "FacilityInstance_placementAreaId_fkey" FOREIGN KEY ("placementAreaId") REFERENCES "PlacementArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityInstance" ADD CONSTRAINT "FacilityInstance_facilityTypeId_fkey" FOREIGN KEY ("facilityTypeId") REFERENCES "FacilityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_facilityTypeId_fkey" FOREIGN KEY ("facilityTypeId") REFERENCES "FacilityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_outputItemId_fkey" FOREIGN KEY ("outputItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeInput" ADD CONSTRAINT "RecipeInput_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeInput" ADD CONSTRAINT "RecipeInput_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
