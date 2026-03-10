// Development helper: make Expedition 1-row-per-user and align schema with migration 20260310081442.
// 実行すると Exploration の既存データ（Expedition / ExpeditionHistory）はすべて削除されます。
// 本番では絶対に実行しないこと。

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("== Expedition 1-row-per-user migration (dev helper) ==");

    // 1) startedAt カラムと ExpeditionHistory テーブル・インデックス・FK を作成
    console.log("Ensuring Expedition.startedAt and ExpeditionHistory schema...");

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Expedition"
      ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ExpeditionHistory" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "areaId" TEXT NOT NULL,
        "partyPresetId" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "startedAt" TIMESTAMP(3) NOT NULL,
        "finishedAt" TIMESTAMP(3) NOT NULL,
        "battleWinCount" INTEGER NOT NULL DEFAULT 0,
        "skillSuccessCount" INTEGER NOT NULL DEFAULT 0,
        "totalExpGained" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ExpeditionHistory_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ExpeditionHistory_userId_idx"
        ON "ExpeditionHistory"("userId");
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ExpeditionHistory_finishedAt_idx"
        ON "ExpeditionHistory"("finishedAt");
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'ExpeditionHistory_userId_fkey'
        ) THEN
          ALTER TABLE "ExpeditionHistory"
          ADD CONSTRAINT "ExpeditionHistory_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    // 2) 既存の探索データはすべて削除（履歴も含めて空にする）
    console.log("Deleting all rows from ExpeditionHistory and Expedition...");
    await prisma.$executeRawUnsafe(`DELETE FROM "ExpeditionHistory";`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Expedition";`);

    // 3) Expedition.userId の UNIQUE 制約を追加（既存 index を落としてから）
    console.log("Ensuring UNIQUE index on Expedition.userId...");
    await prisma.$executeRawUnsafe(`
      DROP INDEX IF EXISTS "Expedition_userId_idx";
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'Expedition_userId_key'
        ) THEN
          CREATE UNIQUE INDEX "Expedition_userId_key" ON "Expedition"("userId");
        END IF;
      END
      $$;
    `);

    console.log("Done. DB schema should now match migration 20260310081442.");
    console.log("Next, run: npm run db:migrate");
  } catch (e) {
    console.error("Migration helper script failed:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

