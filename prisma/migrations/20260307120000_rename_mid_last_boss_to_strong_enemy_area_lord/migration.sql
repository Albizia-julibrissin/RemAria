-- 中ボス→強敵、大ボス→領域主 の表現変更。既存データを保持するため RENAME COLUMN のみ実施。

-- Expedition
ALTER TABLE "Expedition" RENAME COLUMN "midBossCleared" TO "strongEnemyCleared";
ALTER TABLE "Expedition" RENAME COLUMN "lastBossCleared" TO "areaLordCleared";

-- ExplorationArea（FK は PostgreSQL でカラム名変更後も有効）
ALTER TABLE "ExplorationArea" RENAME COLUMN "midBossEnemyId" TO "strongEnemyEnemyId";
ALTER TABLE "ExplorationArea" RENAME COLUMN "lastBossEnemyId" TO "areaLordEnemyId";
ALTER TABLE "ExplorationArea" RENAME COLUMN "midBossEnemyGroupCode" TO "strongEnemyEnemyGroupCode";
ALTER TABLE "ExplorationArea" RENAME COLUMN "lastBossEnemyGroupCode" TO "areaLordEnemyGroupCode";
ALTER TABLE "ExplorationArea" RENAME COLUMN "midBossDropTableId" TO "strongEnemyDropTableId";
ALTER TABLE "ExplorationArea" RENAME COLUMN "lastBossDropTableId" TO "areaLordDropTableId";

-- DropTable.kind / code / name を新表現に統一（強敵・領域主）
UPDATE "DropTable" SET "kind" = 'area_lord_special' WHERE "kind" = 'last_boss_special';
UPDATE "DropTable" SET "kind" = 'strong_enemy' WHERE "kind" = 'mid_boss';
UPDATE "DropTable" SET "code" = 'yuran_paved_road_area_lord', "name" = '遊覧舗装路跡・領域主専用枠' WHERE "code" = 'yuran_paved_road_last_boss';
