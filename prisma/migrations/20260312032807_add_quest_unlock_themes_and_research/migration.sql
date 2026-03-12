-- CreateTable
CREATE TABLE "QuestUnlockExplorationTheme" (
    "questId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,

    CONSTRAINT "QuestUnlockExplorationTheme_pkey" PRIMARY KEY ("questId","themeId")
);

-- CreateTable
CREATE TABLE "QuestUnlockResearchGroup" (
    "questId" TEXT NOT NULL,
    "researchGroupId" TEXT NOT NULL,

    CONSTRAINT "QuestUnlockResearchGroup_pkey" PRIMARY KEY ("questId","researchGroupId")
);

-- CreateTable
CREATE TABLE "UserResearchGroupUnlock" (
    "userId" TEXT NOT NULL,
    "researchGroupId" TEXT NOT NULL,

    CONSTRAINT "UserResearchGroupUnlock_pkey" PRIMARY KEY ("userId","researchGroupId")
);

-- CreateTable
CREATE TABLE "UserExplorationThemeUnlock" (
    "userId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,

    CONSTRAINT "UserExplorationThemeUnlock_pkey" PRIMARY KEY ("userId","themeId")
);

-- CreateIndex
CREATE INDEX "QuestUnlockExplorationTheme_themeId_idx" ON "QuestUnlockExplorationTheme"("themeId");

-- CreateIndex
CREATE INDEX "QuestUnlockResearchGroup_researchGroupId_idx" ON "QuestUnlockResearchGroup"("researchGroupId");

-- CreateIndex
CREATE INDEX "UserResearchGroupUnlock_userId_idx" ON "UserResearchGroupUnlock"("userId");

-- CreateIndex
CREATE INDEX "UserExplorationThemeUnlock_userId_idx" ON "UserExplorationThemeUnlock"("userId");

-- AddForeignKey
ALTER TABLE "QuestUnlockExplorationTheme" ADD CONSTRAINT "QuestUnlockExplorationTheme_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestUnlockExplorationTheme" ADD CONSTRAINT "QuestUnlockExplorationTheme_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "ExplorationTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestUnlockResearchGroup" ADD CONSTRAINT "QuestUnlockResearchGroup_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestUnlockResearchGroup" ADD CONSTRAINT "QuestUnlockResearchGroup_researchGroupId_fkey" FOREIGN KEY ("researchGroupId") REFERENCES "ResearchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResearchGroupUnlock" ADD CONSTRAINT "UserResearchGroupUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResearchGroupUnlock" ADD CONSTRAINT "UserResearchGroupUnlock_researchGroupId_fkey" FOREIGN KEY ("researchGroupId") REFERENCES "ResearchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExplorationThemeUnlock" ADD CONSTRAINT "UserExplorationThemeUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExplorationThemeUnlock" ADD CONSTRAINT "UserExplorationThemeUnlock_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "ExplorationTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
