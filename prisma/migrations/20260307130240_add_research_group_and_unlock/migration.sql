-- CreateTable
CREATE TABLE "ResearchGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "prerequisiteGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchGroupItem" (
    "id" TEXT NOT NULL,
    "researchGroupId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "isVariant" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchGroupItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchUnlockCost" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchUnlockCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCraftRecipeUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "craftRecipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCraftRecipeUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGroup_code_key" ON "ResearchGroup"("code");

-- CreateIndex
CREATE INDEX "ResearchGroupItem_researchGroupId_idx" ON "ResearchGroupItem"("researchGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchGroupItem_researchGroupId_targetType_targetId_key" ON "ResearchGroupItem"("researchGroupId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ResearchUnlockCost_targetType_targetId_idx" ON "ResearchUnlockCost"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ResearchUnlockCost_itemId_idx" ON "ResearchUnlockCost"("itemId");

-- CreateIndex
CREATE INDEX "UserCraftRecipeUnlock_userId_idx" ON "UserCraftRecipeUnlock"("userId");

-- CreateIndex
CREATE INDEX "UserCraftRecipeUnlock_craftRecipeId_idx" ON "UserCraftRecipeUnlock"("craftRecipeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCraftRecipeUnlock_userId_craftRecipeId_key" ON "UserCraftRecipeUnlock"("userId", "craftRecipeId");

-- AddForeignKey
ALTER TABLE "ResearchGroup" ADD CONSTRAINT "ResearchGroup_prerequisiteGroupId_fkey" FOREIGN KEY ("prerequisiteGroupId") REFERENCES "ResearchGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchGroupItem" ADD CONSTRAINT "ResearchGroupItem_researchGroupId_fkey" FOREIGN KEY ("researchGroupId") REFERENCES "ResearchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchUnlockCost" ADD CONSTRAINT "ResearchUnlockCost_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCraftRecipeUnlock" ADD CONSTRAINT "UserCraftRecipeUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCraftRecipeUnlock" ADD CONSTRAINT "UserCraftRecipeUnlock_craftRecipeId_fkey" FOREIGN KEY ("craftRecipeId") REFERENCES "CraftRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
