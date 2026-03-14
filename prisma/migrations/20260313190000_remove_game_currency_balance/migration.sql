-- docs/076: gameCurrencyBalance 廃止。市場・仲間雇用は GRA に統一。
ALTER TABLE "User" DROP COLUMN IF EXISTS "gameCurrencyBalance";
