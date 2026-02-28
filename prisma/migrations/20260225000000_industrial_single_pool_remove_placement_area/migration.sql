-- spec/035, docs/018: エリア制廃止。単一工業プール・設置枠・コスト上限を User に持たせる。
-- docs/019: lastReceivedAt → lastProducedAt に変更し、isForced を追加。PlacementArea を削除。

-- User: 工業の設置枠数・コスト上限を追加
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "industrialMaxSlots" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "industrialMaxCost" INTEGER NOT NULL DEFAULT 200;

-- FacilityInstance: lastProducedAt を追加し lastReceivedAt の値をコピーしてから削除
ALTER TABLE "FacilityInstance" ADD COLUMN IF NOT EXISTS "lastProducedAt" TIMESTAMP(3);
UPDATE "FacilityInstance" SET "lastProducedAt" = "lastReceivedAt" WHERE "lastReceivedAt" IS NOT NULL;
ALTER TABLE "FacilityInstance" DROP COLUMN IF EXISTS "lastReceivedAt";

-- FacilityInstance: 強制配置フラグを追加（既存は false）
ALTER TABLE "FacilityInstance" ADD COLUMN IF NOT EXISTS "isForced" BOOLEAN NOT NULL DEFAULT false;

-- 既存の強制配置 5 設備（初期エリアに属していたもの）を isForced=true に更新
-- PlacementArea.code='initial' に紐づいていた FacilityInstance を更新
UPDATE "FacilityInstance" SET "isForced" = true
WHERE "placementAreaId" IN (SELECT "id" FROM "PlacementArea" WHERE "code" = 'initial');

-- ユニーク制約を削除（placementAreaId を含むため）
DROP INDEX IF EXISTS "FacilityInstance_userId_placementAreaId_facilityTypeId_vari_key";

-- placementAreaId の FK とインデックスを削除
ALTER TABLE "FacilityInstance" DROP CONSTRAINT IF EXISTS "FacilityInstance_placementAreaId_fkey";
DROP INDEX IF EXISTS "FacilityInstance_placementAreaId_idx";

-- placementAreaId カラムを削除
ALTER TABLE "FacilityInstance" DROP COLUMN IF EXISTS "placementAreaId";

-- FacilityInstance: userId + displayOrder のインデックスを追加
CREATE INDEX IF NOT EXISTS "FacilityInstance_userId_displayOrder_idx" ON "FacilityInstance"("userId", "displayOrder");

-- PlacementArea テーブルを削除
DROP TABLE IF EXISTS "PlacementArea";
