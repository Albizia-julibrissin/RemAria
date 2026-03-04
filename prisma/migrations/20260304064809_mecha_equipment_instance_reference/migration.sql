-- DropForeignKey
ALTER TABLE "MechaEquipment" DROP CONSTRAINT "MechaEquipment_mechaPartTypeId_fkey";

-- AlterTable
ALTER TABLE "MechaEquipment" ADD COLUMN     "mechaPartInstanceId" TEXT,
ALTER COLUMN "mechaPartTypeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MechaEquipment_mechaPartInstanceId_idx" ON "MechaEquipment"("mechaPartInstanceId");

-- AddForeignKey
ALTER TABLE "MechaEquipment" ADD CONSTRAINT "MechaEquipment_mechaPartInstanceId_fkey" FOREIGN KEY ("mechaPartInstanceId") REFERENCES "MechaPartInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechaEquipment" ADD CONSTRAINT "MechaEquipment_mechaPartTypeId_fkey" FOREIGN KEY ("mechaPartTypeId") REFERENCES "MechaPartType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
