-- docs/078: 設備派生型廃止。建設レシピを FacilityType 直結にし、FacilityVariant を削除。

-- 1. 新テーブル作成
CREATE TABLE "FacilityTypeConstructionInput" (
    "id" TEXT NOT NULL,
    "facilityTypeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacilityTypeConstructionInput_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FacilityTypeConstructionInput_facilityTypeId_itemId_key" ON "FacilityTypeConstructionInput"("facilityTypeId", "itemId");
CREATE INDEX "FacilityTypeConstructionInput_facilityTypeId_idx" ON "FacilityTypeConstructionInput"("facilityTypeId");
CREATE INDEX "FacilityTypeConstructionInput_itemId_idx" ON "FacilityTypeConstructionInput"("itemId");

ALTER TABLE "FacilityTypeConstructionInput" ADD CONSTRAINT "FacilityTypeConstructionInput_facilityTypeId_fkey" FOREIGN KEY ("facilityTypeId") REFERENCES "FacilityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityTypeConstructionInput" ADD CONSTRAINT "FacilityTypeConstructionInput_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. データ移行: variantCode='base' の建設レシピを FacilityType 直下にコピー
INSERT INTO "FacilityTypeConstructionInput" ("id", "facilityTypeId", "itemId", "amount", "createdAt")
SELECT gen_random_uuid()::text, fv."facilityTypeId", fci."itemId", fci.amount, fci."createdAt"
FROM "FacilityConstructionRecipeInput" fci
JOIN "FacilityVariant" fv ON fv.id = fci."facilityVariantId"
WHERE fv."variantCode" = 'base';

-- 3. 旧テーブル・カラム削除
DROP TABLE "FacilityConstructionRecipeInput";
DROP TABLE "FacilityVariant";
ALTER TABLE "FacilityInstance" DROP COLUMN IF EXISTS "variantCode";
