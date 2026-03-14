-- CreateTable
CREATE TABLE "MarketListingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketListingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketListingEvent_userId_idx" ON "MarketListingEvent"("userId");

-- CreateIndex
CREATE INDEX "MarketListingEvent_createdAt_idx" ON "MarketListingEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketListingEvent" ADD CONSTRAINT "MarketListingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListingEvent" ADD CONSTRAINT "MarketListingEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
