-- CreateTable
CREATE TABLE "Mail" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "rewardGraFree" INTEGER NOT NULL DEFAULT 0,
    "rewardGraPaid" INTEGER NOT NULL DEFAULT 0,
    "rewardResearchPoint" INTEGER NOT NULL DEFAULT 0,
    "rewardItems" JSONB,
    "rewardTitleIds" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mailId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMail_userId_idx" ON "UserMail"("userId");

-- CreateIndex
CREATE INDEX "UserMail_mailId_idx" ON "UserMail"("mailId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMail_userId_mailId_key" ON "UserMail"("userId", "mailId");

-- AddForeignKey
ALTER TABLE "UserMail" ADD CONSTRAINT "UserMail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMail" ADD CONSTRAINT "UserMail_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
