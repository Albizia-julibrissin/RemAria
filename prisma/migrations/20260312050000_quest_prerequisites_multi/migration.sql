-- 開拓任務の前提を複数持てるようにする。QuestPrerequisite を新設し、既存の単一前提を移行してから Quest.prerequisiteQuestId を削除。

-- CreateTable
CREATE TABLE "QuestPrerequisite" (
    "questId" TEXT NOT NULL,
    "prerequisiteQuestId" TEXT NOT NULL,

    CONSTRAINT "QuestPrerequisite_pkey" PRIMARY KEY ("questId","prerequisiteQuestId")
);

-- CreateIndex (unlockNextQuests で prerequisiteQuestId 検索用)
CREATE INDEX "QuestPrerequisite_prerequisiteQuestId_idx" ON "QuestPrerequisite"("prerequisiteQuestId");

-- AddForeignKey
ALTER TABLE "QuestPrerequisite" ADD CONSTRAINT "QuestPrerequisite_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestPrerequisite" ADD CONSTRAINT "QuestPrerequisite_prerequisiteQuestId_fkey" FOREIGN KEY ("prerequisiteQuestId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 既存データ移行: Quest に prerequisiteQuestId があった行を QuestPrerequisite に挿入
INSERT INTO "QuestPrerequisite" ("questId", "prerequisiteQuestId")
SELECT "id", "prerequisiteQuestId" FROM "Quest" WHERE "prerequisiteQuestId" IS NOT NULL;

-- DropForeignKey (Quest の自己参照 FK) と DropColumn
ALTER TABLE "Quest" DROP CONSTRAINT IF EXISTS "Quest_prerequisiteQuestId_fkey";
ALTER TABLE "Quest" DROP COLUMN "prerequisiteQuestId";
