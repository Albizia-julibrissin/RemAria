-- AlterTable
ALTER TABLE "ResearchGroup" ADD COLUMN     "facilityCostExpansionAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "facilityCostExpansionLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "facilityCostExpansionResearchPoint" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "industrialSlotsExpansionCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserResearchGroupCostExpansion" (
    "userId" TEXT NOT NULL,
    "researchGroupId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserResearchGroupCostExpansion_pkey" PRIMARY KEY ("userId","researchGroupId")
);

-- CreateTable
CREATE TABLE "FacilitySlotsExpansionSetting" (
    "id" TEXT NOT NULL,
    "maxExpansionCount" INTEGER NOT NULL,
    "amountPerExpansion" INTEGER NOT NULL,
    "researchPointPerExpansion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilitySlotsExpansionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserResearchGroupCostExpansion_userId_idx" ON "UserResearchGroupCostExpansion"("userId");

-- AddForeignKey
ALTER TABLE "UserResearchGroupCostExpansion" ADD CONSTRAINT "UserResearchGroupCostExpansion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResearchGroupCostExpansion" ADD CONSTRAINT "UserResearchGroupCostExpansion_researchGroupId_fkey" FOREIGN KEY ("researchGroupId") REFERENCES "ResearchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- spec/089: 設備設置上限拡張の初期設定（1行）。管理画面で編集可能。
INSERT INTO "FacilitySlotsExpansionSetting" ("id", "maxExpansionCount", "amountPerExpansion", "researchPointPerExpansion", "createdAt", "updatedAt")
VALUES ('default-slots-expansion', 5, 1, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
