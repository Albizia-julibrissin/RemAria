-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'material';

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterEquipment" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "equipmentInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechaPartInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mechaPartTypeId" TEXT NOT NULL,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechaPartInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_code_key" ON "EquipmentType"("code");

-- CreateIndex
CREATE INDEX "EquipmentInstance_userId_idx" ON "EquipmentInstance"("userId");

-- CreateIndex
CREATE INDEX "EquipmentInstance_equipmentTypeId_idx" ON "EquipmentInstance"("equipmentTypeId");

-- CreateIndex
CREATE INDEX "CharacterEquipment_characterId_idx" ON "CharacterEquipment"("characterId");

-- CreateIndex
CREATE INDEX "CharacterEquipment_equipmentInstanceId_idx" ON "CharacterEquipment"("equipmentInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterEquipment_characterId_slot_key" ON "CharacterEquipment"("characterId", "slot");

-- CreateIndex
CREATE INDEX "MechaPartInstance_userId_idx" ON "MechaPartInstance"("userId");

-- CreateIndex
CREATE INDEX "MechaPartInstance_mechaPartTypeId_idx" ON "MechaPartInstance"("mechaPartTypeId");

-- AddForeignKey
ALTER TABLE "EquipmentInstance" ADD CONSTRAINT "EquipmentInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentInstance" ADD CONSTRAINT "EquipmentInstance_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterEquipment" ADD CONSTRAINT "CharacterEquipment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterEquipment" ADD CONSTRAINT "CharacterEquipment_equipmentInstanceId_fkey" FOREIGN KEY ("equipmentInstanceId") REFERENCES "EquipmentInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechaPartInstance" ADD CONSTRAINT "MechaPartInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechaPartInstance" ADD CONSTRAINT "MechaPartInstance_mechaPartTypeId_fkey" FOREIGN KEY ("mechaPartTypeId") REFERENCES "MechaPartType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
