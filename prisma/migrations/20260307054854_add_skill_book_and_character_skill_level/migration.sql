-- AlterTable
ALTER TABLE "CharacterSkill" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "skillId" TEXT;

-- CreateIndex
CREATE INDEX "Item_skillId_idx" ON "Item"("skillId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
