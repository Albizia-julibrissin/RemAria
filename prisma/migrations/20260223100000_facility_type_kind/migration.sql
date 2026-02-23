-- docs/15: 設備三種類（資源探索・工業・訓練）。FacilityType に kind を追加。

ALTER TABLE "FacilityType" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'industrial';

CREATE INDEX "FacilityType_kind_idx" ON "FacilityType"("kind");
