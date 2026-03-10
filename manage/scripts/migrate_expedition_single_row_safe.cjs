// Production-safe helper for 061: Expedition 1-row-per-user migration.
// - 既存の Expedition 行は削除せず、「1ユーザー1行」になるように重複だけ整理する。
// - state が finished / aborted の行は ExpeditionHistory にサマリをコピーしてから削除する。
// - startedAt を backfill し、最後に userId の UNIQUE INDEX を張る。
//
// ※本番環境では、必ず事前にバックアップを取得し、メンテナンスモードで実行すること。
// ※開発用の全削除スクリプト（migrate_expedition_single_row.cjs）とは別物なので注意。

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function ensureSchema() {
  console.log("Ensuring Expedition.startedAt and ExpeditionHistory schema...");

  // startedAt カラム
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Expedition"
    ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
  `);

  // ExpeditionHistory テーブル
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
}

async function migrateDuplicates() {
  console.log("Detecting users with multiple Expedition rows...");

  // userId ごとの件数を集計し、2 行以上あるユーザーだけ取得
  const duplicates = await prisma.$queryRawUnsafe(`
    SELECT "userId"
    FROM "Expedition"
    GROUP BY "userId"
    HAVING COUNT(*) > 1
  `);

  console.log(`Found ${duplicates.length} users with multiple Expedition rows.`);

  for (const row of duplicates) {
    const userId = row.userId;
    console.log(`\nProcessing user ${userId}...`);

    const exps = await prisma.expedition.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (exps.length <= 1) continue;

    // keep 優先度: in_progress / ready_to_finish の最新 → それ以外の最新
    const preferredStates = ["in_progress", "ready_to_finish"];
    const keep =
      exps.find((e) => preferredStates.includes(e.state)) ?? exps[0];
    const toRemove = exps.filter((e) => e.id !== keep.id);

    console.log(
      `  Keeping id=${keep.id} (state=${keep.state}, createdAt=${keep.createdAt.toISOString()})`
    );
    console.log(
      `  Removing ${toRemove.length} rows: ${toRemove
        .map((e) => `${e.id}[${e.state}]`)
        .join(", ")}`
    );

    await prisma.$transaction(async (tx) => {
      for (const exp of toRemove) {
        if (exp.state === "finished" || exp.state === "aborted") {
          await tx.expeditionHistory.create({
            data: {
              userId: exp.userId,
              areaId: exp.areaId,
              partyPresetId: exp.partyPresetId,
              state: exp.state,
              startedAt: exp.startedAt ?? exp.createdAt,
              finishedAt: exp.updatedAt,
              battleWinCount: exp.battleWinCount,
              skillSuccessCount: exp.skillSuccessCount,
              totalExpGained: exp.totalExpGained,
            },
          });
        }

        await tx.expedition.delete({
          where: { id: exp.id },
        });
      }
    });
  }
}

async function backfillStartedAt() {
  console.log("Backfilling Expedition.startedAt where NULL...");
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "Expedition"
    SET "startedAt" = "createdAt"
    WHERE "startedAt" IS NULL
  `);
  console.log(`  Updated rows (approx): ${updated ?? 0}`);
}

async function addUniqueIndex() {
  console.log("Adding UNIQUE INDEX on Expedition.userId if missing...");

  // 旧 index を消し、UNIQUE INDEX を追加（既にあれば何もしない）
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
}

async function main() {
  try {
    console.log("== Expedition 1-row-per-user migration (production-safe) ==");
    await ensureSchema();
    await migrateDuplicates();
    await backfillStartedAt();
    await addUniqueIndex();
    console.log("Done. Expedition is now 1-row-per-user and ExpeditionHistory has summaries for removed finished/aborted runs.");
  } catch (e) {
    console.error("Migration script failed:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

