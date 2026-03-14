-- 仲間上限のデフォルトを5に統一（既にカラムがある環境用）
ALTER TABLE "User" ALTER COLUMN "companionLimit" SET DEFAULT 5;
UPDATE "User" SET "companionLimit" = 5 WHERE "companionLimit" = 10;
