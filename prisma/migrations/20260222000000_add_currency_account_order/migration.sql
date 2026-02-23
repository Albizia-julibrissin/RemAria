-- AlterTable User: 通貨・アカウント・運用・表示カラム追加 (docs/08_database_schema.md)
ALTER TABLE "User" ADD COLUMN "gameCurrencyBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "premiumCurrencyFreeBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "premiumCurrencyPaidBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "birthdate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "country" TEXT;
ALTER TABLE "User" ADD COLUMN "region" TEXT;
ALTER TABLE "User" ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "firstLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "locale" TEXT;

-- CreateTable CurrencyTransaction
CREATE TABLE "CurrencyTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currencyType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CurrencyTransaction_userId_idx" ON "CurrencyTransaction"("userId");
CREATE INDEX "CurrencyTransaction_userId_createdAt_idx" ON "CurrencyTransaction"("userId", "createdAt");

ALTER TABLE "CurrencyTransaction" ADD CONSTRAINT "CurrencyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Order
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "amountPaid" INTEGER NOT NULL,
    "premiumCurrencyGranted" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_externalPaymentId_key" ON "Order"("externalPaymentId");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
