-- CreateTable
CREATE TABLE "RelicTemperPending" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relicInstanceId" TEXT NOT NULL,
    "newStatBonus1" JSONB,
    "newStatBonus2" JSONB,
    "newAttributeResistances" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelicTemperPending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelicTemperPending_relicInstanceId_key" ON "RelicTemperPending"("relicInstanceId");

-- CreateIndex
CREATE INDEX "RelicTemperPending_userId_idx" ON "RelicTemperPending"("userId");

-- AddForeignKey
ALTER TABLE "RelicTemperPending" ADD CONSTRAINT "RelicTemperPending_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelicTemperPending" ADD CONSTRAINT "RelicTemperPending_relicInstanceId_fkey" FOREIGN KEY ("relicInstanceId") REFERENCES "RelicInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
