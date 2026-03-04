-- CreateTable
CREATE TABLE "CraftRecipe" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "outputKind" TEXT NOT NULL,
    "outputEquipmentTypeId" TEXT,
    "outputMechaPartTypeId" TEXT,
    "outputItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CraftRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CraftRecipeInput" (
    "id" TEXT NOT NULL,
    "craftRecipeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CraftRecipeInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CraftRecipe_code_key" ON "CraftRecipe"("code");

-- CreateIndex
CREATE INDEX "CraftRecipe_outputKind_idx" ON "CraftRecipe"("outputKind");

-- CreateIndex
CREATE INDEX "CraftRecipeInput_craftRecipeId_idx" ON "CraftRecipeInput"("craftRecipeId");

-- CreateIndex
CREATE INDEX "CraftRecipeInput_itemId_idx" ON "CraftRecipeInput"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CraftRecipeInput_craftRecipeId_itemId_key" ON "CraftRecipeInput"("craftRecipeId", "itemId");

-- AddForeignKey
ALTER TABLE "CraftRecipe" ADD CONSTRAINT "CraftRecipe_outputEquipmentTypeId_fkey" FOREIGN KEY ("outputEquipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftRecipe" ADD CONSTRAINT "CraftRecipe_outputMechaPartTypeId_fkey" FOREIGN KEY ("outputMechaPartTypeId") REFERENCES "MechaPartType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftRecipe" ADD CONSTRAINT "CraftRecipe_outputItemId_fkey" FOREIGN KEY ("outputItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftRecipeInput" ADD CONSTRAINT "CraftRecipeInput_craftRecipeId_fkey" FOREIGN KEY ("craftRecipeId") REFERENCES "CraftRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftRecipeInput" ADD CONSTRAINT "CraftRecipeInput_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
