-- AlterTable
ALTER TABLE "ExplorationArea" ALTER COLUMN "areaLordAppearanceRate" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "Title" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unlockConditionMemo" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTitleUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTitleUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Title_code_key" ON "Title"("code");

-- CreateIndex
CREATE INDEX "Title_displayOrder_idx" ON "Title"("displayOrder");

-- CreateIndex
CREATE INDEX "UserTitleUnlock_userId_idx" ON "UserTitleUnlock"("userId");

-- CreateIndex
CREATE INDEX "UserTitleUnlock_titleId_idx" ON "UserTitleUnlock"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTitleUnlock_userId_titleId_key" ON "UserTitleUnlock"("userId", "titleId");

-- AddForeignKey
ALTER TABLE "UserTitleUnlock" ADD CONSTRAINT "UserTitleUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTitleUnlock" ADD CONSTRAINT "UserTitleUnlock_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
