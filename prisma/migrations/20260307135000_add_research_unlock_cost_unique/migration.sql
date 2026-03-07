-- CreateIndex: schema の @@unique([targetType, targetId, itemId]) を反映。既存マイグレーションで漏れていたため追加。
CREATE UNIQUE INDEX IF NOT EXISTS "ResearchUnlockCost_targetType_targetId_itemId_key" ON "ResearchUnlockCost"("targetType", "targetId", "itemId");
