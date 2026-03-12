-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "rewardGra" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rewardItems" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "researchPoint" INTEGER NOT NULL DEFAULT 0;
