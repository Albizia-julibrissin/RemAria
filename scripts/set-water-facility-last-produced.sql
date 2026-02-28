-- 川探索拠点の lastProducedAt を 1 時間前にする（テスト用・一時的）
UPDATE "FacilityInstance"
SET "lastProducedAt" = NOW() - INTERVAL '1 hour'
WHERE "facilityTypeId" IN (SELECT id FROM "FacilityType" WHERE name = '川探索拠点');
