-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "marketListable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketMinPricePerUnit" INTEGER,
ADD COLUMN     "marketMinQuantity" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "marketUnlocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTransaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "pricePerUnit" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketListing_itemId_pricePerUnit_createdAt_idx" ON "MarketListing"("itemId", "pricePerUnit", "createdAt");

-- CreateIndex
CREATE INDEX "MarketListing_userId_idx" ON "MarketListing"("userId");

-- CreateIndex
CREATE INDEX "MarketTransaction_itemId_idx" ON "MarketTransaction"("itemId");

-- CreateIndex
CREATE INDEX "MarketTransaction_buyerUserId_idx" ON "MarketTransaction"("buyerUserId");

-- CreateIndex
CREATE INDEX "MarketTransaction_sellerUserId_idx" ON "MarketTransaction"("sellerUserId");

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
