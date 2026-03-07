-- AlterTable
ALTER TABLE "ExplorationArea" ADD COLUMN     "enemyCount1Rate" INTEGER NOT NULL DEFAULT 34,
ADD COLUMN     "enemyCount2Rate" INTEGER NOT NULL DEFAULT 33,
ADD COLUMN     "enemyCount3Rate" INTEGER NOT NULL DEFAULT 33,
ADD COLUMN     "lastBossEnemyId" TEXT,
ADD COLUMN     "midBossEnemyId" TEXT;

-- CreateTable
CREATE TABLE "Enemy" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconFilename" TEXT,
    "description" TEXT,
    "STR" INTEGER NOT NULL,
    "INT" INTEGER NOT NULL,
    "VIT" INTEGER NOT NULL,
    "WIS" INTEGER NOT NULL,
    "DEX" INTEGER NOT NULL,
    "AGI" INTEGER NOT NULL,
    "LUK" INTEGER NOT NULL,
    "CAP" INTEGER NOT NULL,
    "defaultBattleRow" INTEGER NOT NULL,
    "defaultBattleCol" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enemy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnemyTacticSlot" (
    "id" TEXT NOT NULL,
    "enemyId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "conditionKind" TEXT NOT NULL,
    "conditionParam" JSONB,
    "actionType" TEXT NOT NULL,
    "skillId" TEXT,

    CONSTRAINT "EnemyTacticSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnemySkill" (
    "id" TEXT NOT NULL,
    "enemyId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "EnemySkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnemyGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnemyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnemyGroupEntry" (
    "id" TEXT NOT NULL,
    "enemyGroupId" TEXT NOT NULL,
    "enemyId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "EnemyGroupEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enemy_code_key" ON "Enemy"("code");

-- CreateIndex
CREATE INDEX "EnemyTacticSlot_enemyId_idx" ON "EnemyTacticSlot"("enemyId");

-- CreateIndex
CREATE INDEX "EnemySkill_enemyId_idx" ON "EnemySkill"("enemyId");

-- CreateIndex
CREATE UNIQUE INDEX "EnemySkill_enemyId_skillId_key" ON "EnemySkill"("enemyId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "EnemyGroup_code_key" ON "EnemyGroup"("code");

-- CreateIndex
CREATE INDEX "EnemyGroupEntry_enemyGroupId_idx" ON "EnemyGroupEntry"("enemyGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "EnemyGroupEntry_enemyGroupId_enemyId_key" ON "EnemyGroupEntry"("enemyGroupId", "enemyId");

-- AddForeignKey
ALTER TABLE "EnemyTacticSlot" ADD CONSTRAINT "EnemyTacticSlot_enemyId_fkey" FOREIGN KEY ("enemyId") REFERENCES "Enemy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnemyTacticSlot" ADD CONSTRAINT "EnemyTacticSlot_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnemySkill" ADD CONSTRAINT "EnemySkill_enemyId_fkey" FOREIGN KEY ("enemyId") REFERENCES "Enemy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnemySkill" ADD CONSTRAINT "EnemySkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnemyGroupEntry" ADD CONSTRAINT "EnemyGroupEntry_enemyGroupId_fkey" FOREIGN KEY ("enemyGroupId") REFERENCES "EnemyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnemyGroupEntry" ADD CONSTRAINT "EnemyGroupEntry_enemyId_fkey" FOREIGN KEY ("enemyId") REFERENCES "Enemy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationArea" ADD CONSTRAINT "ExplorationArea_midBossEnemyId_fkey" FOREIGN KEY ("midBossEnemyId") REFERENCES "Enemy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationArea" ADD CONSTRAINT "ExplorationArea_lastBossEnemyId_fkey" FOREIGN KEY ("lastBossEnemyId") REFERENCES "Enemy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
