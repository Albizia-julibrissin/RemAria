-- レシピ・設備解放時に研究記録書を要求可能に。管理画面で必要数設定。

ALTER TABLE "ResearchGroupItem" ADD COLUMN "requiredResearchPoint" INTEGER NOT NULL DEFAULT 0;
