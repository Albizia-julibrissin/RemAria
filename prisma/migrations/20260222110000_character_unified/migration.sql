-- Character テーブル統一 (docs/08, 12)
-- 1. Character テーブル作成
-- 2. User に protagonistCharacterId 追加
-- 3. PlayerCharacter データを Character へコピー（category=protagonist）
-- 4. User.protagonistCharacterId を設定
-- 5. User → Character の FK 追加
-- 6. PlayerCharacter 削除

-- CreateTable Character
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '冒険者',
    "iconFilename" TEXT,
    "description" TEXT,
    "protagonistTalentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "STR" INTEGER NOT NULL DEFAULT 10,
    "INT" INTEGER NOT NULL DEFAULT 10,
    "DEX" INTEGER NOT NULL DEFAULT 10,
    "VIT" INTEGER NOT NULL DEFAULT 10,
    "SPD" INTEGER NOT NULL DEFAULT 10,
    "LUK" INTEGER NOT NULL DEFAULT 10,
    "CAP" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Character_userId_idx" ON "Character"("userId");
CREATE INDEX "Character_userId_category_idx" ON "Character"("userId", "category");

ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable User: protagonistCharacterId 追加（一時的に FK なし）
ALTER TABLE "User" ADD COLUMN "protagonistCharacterId" TEXT;

-- データ移行: PlayerCharacter → Character (category=protagonist)
INSERT INTO "Character" (
    "id", "userId", "category",
    "displayName", "iconFilename", "description", "protagonistTalentId",
    "createdAt", "updatedAt",
    "STR", "INT", "DEX", "VIT", "SPD", "LUK", "CAP"
)
SELECT
    "id", "userId", 'protagonist',
    "displayName", "iconFilename", NULL, NULL,
    "createdAt", "updatedAt",
    "STR", "INT", "DEX", "VIT", "SPD", "LUK", "CAP"
FROM "PlayerCharacter";

-- User の主人公参照を設定
UPDATE "User" u
SET "protagonistCharacterId" = c.id
FROM "Character" c
WHERE c."userId" = u.id AND c.category = 'protagonist';

-- DropTable PlayerCharacter（FK はテーブル削除で解除）
DROP TABLE "PlayerCharacter";

-- User.protagonistCharacterId に UNIQUE と FK を付与
CREATE UNIQUE INDEX "User_protagonistCharacterId_key" ON "User"("protagonistCharacterId");
ALTER TABLE "User" ADD CONSTRAINT "User_protagonistCharacterId_fkey" FOREIGN KEY ("protagonistCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
