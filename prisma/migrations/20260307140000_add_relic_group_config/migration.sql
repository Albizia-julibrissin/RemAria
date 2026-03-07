-- CreateTable
CREATE TABLE "RelicGroupConfig" (
    "id" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "name" TEXT,
    "statBonus1Min" INTEGER NOT NULL,
    "statBonus1Max" INTEGER NOT NULL,
    "statBonus2Min" INTEGER NOT NULL,
    "statBonus2Max" INTEGER NOT NULL,
    "attributeResistMin" DOUBLE PRECISION NOT NULL,
    "attributeResistMax" DOUBLE PRECISION NOT NULL,
    "includeNoEffect" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelicGroupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelicGroupPassiveEffect" (
    "id" TEXT NOT NULL,
    "relicGroupConfigId" TEXT NOT NULL,
    "relicPassiveEffectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelicGroupPassiveEffect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelicGroupConfig_groupCode_key" ON "RelicGroupConfig"("groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "RelicGroupPassiveEffect_relicGroupConfigId_relicPassiveEffectId_key" ON "RelicGroupPassiveEffect"("relicGroupConfigId", "relicPassiveEffectId");

-- CreateIndex
CREATE INDEX "RelicGroupPassiveEffect_relicGroupConfigId_idx" ON "RelicGroupPassiveEffect"("relicGroupConfigId");

-- CreateIndex
CREATE INDEX "RelicGroupPassiveEffect_relicPassiveEffectId_idx" ON "RelicGroupPassiveEffect"("relicPassiveEffectId");

-- AddForeignKey
ALTER TABLE "RelicGroupPassiveEffect" ADD CONSTRAINT "RelicGroupPassiveEffect_relicGroupConfigId_fkey" FOREIGN KEY ("relicGroupConfigId") REFERENCES "RelicGroupConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelicGroupPassiveEffect" ADD CONSTRAINT "RelicGroupPassiveEffect_relicPassiveEffectId_fkey" FOREIGN KEY ("relicPassiveEffectId") REFERENCES "RelicPassiveEffect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
