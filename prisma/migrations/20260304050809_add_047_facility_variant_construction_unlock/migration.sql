-- CreateTable
CREATE TABLE "FacilityVariant" (
    "id" TEXT NOT NULL,
    "facilityTypeId" TEXT NOT NULL,
    "variantCode" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityConstructionRecipeInput" (
    "id" TEXT NOT NULL,
    "facilityVariantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityConstructionRecipeInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFacilityTypeUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFacilityTypeUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilityVariant_facilityTypeId_idx" ON "FacilityVariant"("facilityTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityVariant_facilityTypeId_variantCode_key" ON "FacilityVariant"("facilityTypeId", "variantCode");

-- CreateIndex
CREATE INDEX "FacilityConstructionRecipeInput_facilityVariantId_idx" ON "FacilityConstructionRecipeInput"("facilityVariantId");

-- CreateIndex
CREATE INDEX "FacilityConstructionRecipeInput_itemId_idx" ON "FacilityConstructionRecipeInput"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityConstructionRecipeInput_facilityVariantId_itemId_key" ON "FacilityConstructionRecipeInput"("facilityVariantId", "itemId");

-- CreateIndex
CREATE INDEX "UserFacilityTypeUnlock_userId_idx" ON "UserFacilityTypeUnlock"("userId");

-- CreateIndex
CREATE INDEX "UserFacilityTypeUnlock_facilityTypeId_idx" ON "UserFacilityTypeUnlock"("facilityTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFacilityTypeUnlock_userId_facilityTypeId_key" ON "UserFacilityTypeUnlock"("userId", "facilityTypeId");

-- AddForeignKey
ALTER TABLE "FacilityVariant" ADD CONSTRAINT "FacilityVariant_facilityTypeId_fkey" FOREIGN KEY ("facilityTypeId") REFERENCES "FacilityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityConstructionRecipeInput" ADD CONSTRAINT "FacilityConstructionRecipeInput_facilityVariantId_fkey" FOREIGN KEY ("facilityVariantId") REFERENCES "FacilityVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityConstructionRecipeInput" ADD CONSTRAINT "FacilityConstructionRecipeInput_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFacilityTypeUnlock" ADD CONSTRAINT "UserFacilityTypeUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFacilityTypeUnlock" ADD CONSTRAINT "UserFacilityTypeUnlock_facilityTypeId_fkey" FOREIGN KEY ("facilityTypeId") REFERENCES "FacilityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
