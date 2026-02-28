-- CreateTable
CREATE TABLE "PartyPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "slot1CharacterId" TEXT NOT NULL,
    "slot2CharacterId" TEXT,
    "slot3CharacterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyPreset_userId_idx" ON "PartyPreset"("userId");

-- AddForeignKey
ALTER TABLE "PartyPreset" ADD CONSTRAINT "PartyPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPreset" ADD CONSTRAINT "PartyPreset_slot1CharacterId_fkey" FOREIGN KEY ("slot1CharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPreset" ADD CONSTRAINT "PartyPreset_slot2CharacterId_fkey" FOREIGN KEY ("slot2CharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPreset" ADD CONSTRAINT "PartyPreset_slot3CharacterId_fkey" FOREIGN KEY ("slot3CharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
