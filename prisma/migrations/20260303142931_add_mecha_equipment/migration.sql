-- CreateTable
CREATE TABLE "MechaEquipment" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "mechaPartTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechaEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechaPartType" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statRates" JSONB,
    "strAdd" INTEGER DEFAULT 0,
    "intAdd" INTEGER DEFAULT 0,
    "vitAdd" INTEGER DEFAULT 0,
    "wisAdd" INTEGER DEFAULT 0,
    "dexAdd" INTEGER DEFAULT 0,
    "agiAdd" INTEGER DEFAULT 0,
    "lukAdd" INTEGER DEFAULT 0,
    "capAdd" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechaPartType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechaPartTypeSkill" (
    "id" TEXT NOT NULL,
    "mechaPartTypeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechaPartTypeSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MechaEquipment_characterId_idx" ON "MechaEquipment"("characterId");

-- CreateIndex
CREATE INDEX "MechaEquipment_mechaPartTypeId_idx" ON "MechaEquipment"("mechaPartTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "MechaEquipment_characterId_slot_key" ON "MechaEquipment"("characterId", "slot");

-- CreateIndex
CREATE INDEX "MechaPartTypeSkill_mechaPartTypeId_idx" ON "MechaPartTypeSkill"("mechaPartTypeId");

-- CreateIndex
CREATE INDEX "MechaPartTypeSkill_skillId_idx" ON "MechaPartTypeSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "MechaPartTypeSkill_mechaPartTypeId_skillId_key" ON "MechaPartTypeSkill"("mechaPartTypeId", "skillId");

-- AddForeignKey
ALTER TABLE "MechaEquipment" ADD CONSTRAINT "MechaEquipment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechaEquipment" ADD CONSTRAINT "MechaEquipment_mechaPartTypeId_fkey" FOREIGN KEY ("mechaPartTypeId") REFERENCES "MechaPartType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechaPartTypeSkill" ADD CONSTRAINT "MechaPartTypeSkill_mechaPartTypeId_fkey" FOREIGN KEY ("mechaPartTypeId") REFERENCES "MechaPartType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechaPartTypeSkill" ADD CONSTRAINT "MechaPartTypeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
