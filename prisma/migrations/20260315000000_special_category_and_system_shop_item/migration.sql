-- docs/079, 080: 闇市・黒市用 SystemShopItem 追加。Item.category を paid → special に差し替え。

-- 1. Item.category の既存データを paid → special に更新
UPDATE "Item" SET "category" = 'special' WHERE "category" = 'paid';

-- 2. Item に category インデックス追加（既存ならスキップ）
CREATE INDEX IF NOT EXISTS "Item_category_idx" ON "Item"("category");

-- 3. SystemShopItem テーブル作成
CREATE TABLE "SystemShopItem" (
    "id" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "priceGRA" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemShopItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemShopItem_marketType_itemId_key" ON "SystemShopItem"("marketType", "itemId");
CREATE INDEX "SystemShopItem_marketType_idx" ON "SystemShopItem"("marketType");
CREATE INDEX "SystemShopItem_itemId_idx" ON "SystemShopItem"("itemId");

ALTER TABLE "SystemShopItem" ADD CONSTRAINT "SystemShopItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
