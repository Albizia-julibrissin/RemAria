-- CreateTable
CREATE TABLE "ItemUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemUsageLog_userId_idx" ON "ItemUsageLog"("userId");

-- CreateIndex
CREATE INDEX "ItemUsageLog_userId_createdAt_idx" ON "ItemUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ItemUsageLog_itemId_idx" ON "ItemUsageLog"("itemId");

-- AddForeignKey
ALTER TABLE "ItemUsageLog" ADD CONSTRAINT "ItemUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemUsageLog" ADD CONSTRAINT "ItemUsageLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
