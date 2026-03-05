-- CreateTable
CREATE TABLE "ExplorationTheme" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExplorationTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplorationArea" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "difficultyRank" INTEGER NOT NULL DEFAULT 1,
    "recommendedLevel" INTEGER NOT NULL DEFAULT 1,
    "baseDropMin" INTEGER NOT NULL DEFAULT 3,
    "baseDropMax" INTEGER NOT NULL DEFAULT 5,
    "baseSkillEventRate" INTEGER NOT NULL DEFAULT 25,
    "normalBattleCount" INTEGER NOT NULL DEFAULT 5,
    "normalEnemyGroupCode" TEXT,
    "midBossEnemyGroupCode" TEXT,
    "lastBossEnemyGroupCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExplorationArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expedition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "partyPresetId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'in_progress',
    "remainingNormalBattles" INTEGER NOT NULL DEFAULT 0,
    "midBossCleared" BOOLEAN NOT NULL DEFAULT false,
    "lastBossCleared" BOOLEAN NOT NULL DEFAULT false,
    "battleWinCount" INTEGER NOT NULL DEFAULT 0,
    "skillSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "currentHpMp" JSONB,
    "explorationState" JSONB,
    "totalExpGained" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expedition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExplorationTheme_code_key" ON "ExplorationTheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExplorationArea_code_key" ON "ExplorationArea"("code");

-- CreateIndex
CREATE INDEX "ExplorationArea_themeId_idx" ON "ExplorationArea"("themeId");

-- CreateIndex
CREATE INDEX "Expedition_userId_idx" ON "Expedition"("userId");

-- CreateIndex
CREATE INDEX "Expedition_areaId_idx" ON "Expedition"("areaId");

-- CreateIndex
CREATE INDEX "Expedition_partyPresetId_idx" ON "Expedition"("partyPresetId");

-- CreateIndex
CREATE INDEX "Expedition_state_idx" ON "Expedition"("state");

-- AddForeignKey
ALTER TABLE "ExplorationArea" ADD CONSTRAINT "ExplorationArea_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "ExplorationTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ExplorationArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_partyPresetId_fkey" FOREIGN KEY ("partyPresetId") REFERENCES "PartyPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
