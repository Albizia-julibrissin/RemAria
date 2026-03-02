-- AlterTable User: add accountId (required, unique), make name required.
-- docs/08_database_schema.md: アカウント登録は メール・ID（英数字・必須・重複不可）・名前（必須）

-- 1. accountId を NULL 可で追加
ALTER TABLE "User" ADD COLUMN "accountId" TEXT;

-- 2. 既存行に一意な accountId を付与（id の先頭12文字を利用）
UPDATE "User" SET "accountId" = 'user_' || LEFT("id", 12) WHERE "accountId" IS NULL;

-- 3. accountId を NOT NULL に
ALTER TABLE "User" ALTER COLUMN "accountId" SET NOT NULL;

-- 4. accountId に UNIQUE 制約
CREATE UNIQUE INDEX "User_accountId_key" ON "User"("accountId");

-- 5. name が NULL の行を空文字にし、NOT NULL に
UPDATE "User" SET "name" = '' WHERE "name" IS NULL;
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
