-- AlterTable
ALTER TABLE "User" ADD COLUMN     "selectedTitleId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_selectedTitleId_fkey" FOREIGN KEY ("selectedTitleId") REFERENCES "Title"("id") ON DELETE SET NULL ON UPDATE CASCADE;
