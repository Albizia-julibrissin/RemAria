/*
  Warnings:

  - You are about to drop the column `prerequisiteGroupId` on the `ResearchGroup` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ResearchGroup" DROP CONSTRAINT "ResearchGroup_prerequisiteGroupId_fkey";

-- AlterTable
ALTER TABLE "ResearchGroup" DROP COLUMN "prerequisiteGroupId";
