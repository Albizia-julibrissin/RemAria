-- CreateTable
CREATE TABLE "PresetTacticSlot" (
    "id" TEXT NOT NULL,
    "partyPresetId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "conditionKind" TEXT NOT NULL,
    "conditionParam" JSONB,
    "actionType" TEXT NOT NULL,
    "skillId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresetTacticSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresetTacticSlot_partyPresetId_idx" ON "PresetTacticSlot"("partyPresetId");

-- CreateIndex
CREATE INDEX "PresetTacticSlot_skillId_idx" ON "PresetTacticSlot"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "PresetTacticSlot_partyPresetId_characterId_orderIndex_key" ON "PresetTacticSlot"("partyPresetId", "characterId", "orderIndex");

-- AddForeignKey
ALTER TABLE "PresetTacticSlot" ADD CONSTRAINT "PresetTacticSlot_partyPresetId_fkey" FOREIGN KEY ("partyPresetId") REFERENCES "PartyPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetTacticSlot" ADD CONSTRAINT "PresetTacticSlot_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetTacticSlot" ADD CONSTRAINT "PresetTacticSlot_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
