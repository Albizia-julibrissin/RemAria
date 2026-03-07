-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "questType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "clearReportMessage" TEXT,
    "prerequisiteQuestId" TEXT,
    "achievementType" TEXT NOT NULL,
    "achievementParam" JSONB NOT NULL,
    "rewardResearchPoint" INTEGER NOT NULL DEFAULT 0,
    "rewardTitleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quest_code_key" ON "Quest"("code");

-- CreateIndex
CREATE INDEX "UserQuest_userId_idx" ON "UserQuest"("userId");

-- CreateIndex
CREATE INDEX "UserQuest_questId_idx" ON "UserQuest"("questId");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuest_userId_questId_key" ON "UserQuest"("userId", "questId");

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_prerequisiteQuestId_fkey" FOREIGN KEY ("prerequisiteQuestId") REFERENCES "Quest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuest" ADD CONSTRAINT "UserQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuest" ADD CONSTRAINT "UserQuest_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
