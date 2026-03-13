-- CreateTable
CREATE TABLE "ExplorationEvent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExplorationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillEventDetail" (
    "explorationEventId" TEXT NOT NULL,
    "occurrenceMessage" TEXT NOT NULL,

    CONSTRAINT "SkillEventDetail_pkey" PRIMARY KEY ("explorationEventId")
);

-- CreateTable
CREATE TABLE "SkillEventStatOption" (
    "skillEventDetailId" TEXT NOT NULL,
    "statKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "difficultyCoefficient" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "successMessage" TEXT NOT NULL,
    "failMessage" TEXT NOT NULL,

    CONSTRAINT "SkillEventStatOption_pkey" PRIMARY KEY ("skillEventDetailId","statKey")
);

-- CreateTable
CREATE TABLE "AreaExplorationEvent" (
    "areaId" TEXT NOT NULL,
    "explorationEventId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "AreaExplorationEvent_pkey" PRIMARY KEY ("areaId","explorationEventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExplorationEvent_code_key" ON "ExplorationEvent"("code");

-- CreateIndex
CREATE INDEX "ExplorationEvent_eventType_idx" ON "ExplorationEvent"("eventType");

-- CreateIndex
CREATE INDEX "SkillEventDetail_explorationEventId_idx" ON "SkillEventDetail"("explorationEventId");

-- CreateIndex
CREATE INDEX "SkillEventStatOption_skillEventDetailId_idx" ON "SkillEventStatOption"("skillEventDetailId");

-- CreateIndex
CREATE INDEX "AreaExplorationEvent_areaId_idx" ON "AreaExplorationEvent"("areaId");

-- CreateIndex
CREATE INDEX "AreaExplorationEvent_explorationEventId_idx" ON "AreaExplorationEvent"("explorationEventId");

-- AddForeignKey
ALTER TABLE "SkillEventDetail" ADD CONSTRAINT "SkillEventDetail_explorationEventId_fkey" FOREIGN KEY ("explorationEventId") REFERENCES "ExplorationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEventStatOption" ADD CONSTRAINT "SkillEventStatOption_skillEventDetailId_fkey" FOREIGN KEY ("skillEventDetailId") REFERENCES "SkillEventDetail"("explorationEventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaExplorationEvent" ADD CONSTRAINT "AreaExplorationEvent_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ExplorationArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AreaExplorationEvent" ADD CONSTRAINT "AreaExplorationEvent_explorationEventId_fkey" FOREIGN KEY ("explorationEventId") REFERENCES "ExplorationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
