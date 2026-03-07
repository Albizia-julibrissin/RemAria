-- CreateTable
CREATE TABLE "RelicType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelicType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelicPassiveEffect" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelicPassiveEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelicInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relicTypeId" TEXT NOT NULL,
    "relicPassiveEffectId" TEXT,
    "statBonus1" JSONB,
    "statBonus2" JSONB,
    "attributeResistances" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelicInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterRelic" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "relicInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRelic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelicType_code_key" ON "RelicType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RelicPassiveEffect_code_key" ON "RelicPassiveEffect"("code");

-- CreateIndex
CREATE INDEX "RelicInstance_userId_idx" ON "RelicInstance"("userId");

-- CreateIndex
CREATE INDEX "RelicInstance_relicTypeId_idx" ON "RelicInstance"("relicTypeId");

-- CreateIndex
CREATE INDEX "RelicInstance_relicPassiveEffectId_idx" ON "RelicInstance"("relicPassiveEffectId");

-- CreateIndex
CREATE INDEX "CharacterRelic_characterId_idx" ON "CharacterRelic"("characterId");

-- CreateIndex
CREATE INDEX "CharacterRelic_relicInstanceId_idx" ON "CharacterRelic"("relicInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterRelic_characterId_slot_key" ON "CharacterRelic"("characterId", "slot");

-- RenameForeignKey
ALTER TABLE "ExplorationArea" RENAME CONSTRAINT "ExplorationArea_lastBossDropTableId_fkey" TO "ExplorationArea_areaLordDropTableId_fkey";

-- RenameForeignKey
ALTER TABLE "ExplorationArea" RENAME CONSTRAINT "ExplorationArea_lastBossEnemyId_fkey" TO "ExplorationArea_areaLordEnemyId_fkey";

-- RenameForeignKey
ALTER TABLE "ExplorationArea" RENAME CONSTRAINT "ExplorationArea_midBossDropTableId_fkey" TO "ExplorationArea_strongEnemyDropTableId_fkey";

-- RenameForeignKey
ALTER TABLE "ExplorationArea" RENAME CONSTRAINT "ExplorationArea_midBossEnemyId_fkey" TO "ExplorationArea_strongEnemyEnemyId_fkey";

-- AddForeignKey
ALTER TABLE "RelicInstance" ADD CONSTRAINT "RelicInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelicInstance" ADD CONSTRAINT "RelicInstance_relicTypeId_fkey" FOREIGN KEY ("relicTypeId") REFERENCES "RelicType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelicInstance" ADD CONSTRAINT "RelicInstance_relicPassiveEffectId_fkey" FOREIGN KEY ("relicPassiveEffectId") REFERENCES "RelicPassiveEffect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelic" ADD CONSTRAINT "CharacterRelic_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelic" ADD CONSTRAINT "CharacterRelic_relicInstanceId_fkey" FOREIGN KEY ("relicInstanceId") REFERENCES "RelicInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
