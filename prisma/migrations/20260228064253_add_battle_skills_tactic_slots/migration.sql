-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "attribute" TEXT,
ADD COLUMN     "battleSkillType" TEXT,
ADD COLUMN     "chargeCycles" INTEGER,
ADD COLUMN     "hitsMax" INTEGER,
ADD COLUMN     "hitsMin" INTEGER,
ADD COLUMN     "logMessage" TEXT,
ADD COLUMN     "logMessageOnCondition" TEXT,
ADD COLUMN     "mpCostCapCoef" DECIMAL(65,30),
ADD COLUMN     "mpCostFlat" INTEGER,
ADD COLUMN     "powerMultiplier" DECIMAL(65,30),
ADD COLUMN     "resampleTargetPerHit" BOOLEAN,
ADD COLUMN     "targetScope" TEXT,
ADD COLUMN     "weightAddBack" DECIMAL(65,30),
ADD COLUMN     "weightAddFront" DECIMAL(65,30),
ADD COLUMN     "weightAddMid" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "TacticSlot" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "conditionKind" TEXT NOT NULL,
    "conditionParam" JSONB,
    "actionType" TEXT NOT NULL,
    "skillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TacticSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillEffect" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "effectType" TEXT NOT NULL,
    "param" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillEffect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TacticSlot_characterId_idx" ON "TacticSlot"("characterId");

-- CreateIndex
CREATE INDEX "TacticSlot_skillId_idx" ON "TacticSlot"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "TacticSlot_characterId_orderIndex_key" ON "TacticSlot"("characterId", "orderIndex");

-- CreateIndex
CREATE INDEX "SkillEffect_skillId_idx" ON "SkillEffect"("skillId");

-- AddForeignKey
ALTER TABLE "TacticSlot" ADD CONSTRAINT "TacticSlot_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticSlot" ADD CONSTRAINT "TacticSlot_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEffect" ADD CONSTRAINT "SkillEffect_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
