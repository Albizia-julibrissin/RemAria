/**
 * 「工業コスト上限が 200」のユーザーのみ、「コスト上限 +200」「設備設置数 +4」する。
 * 既に加算済み（コスト上限 400 など）のユーザーは対象外。
 *
 * 実行: npx tsx prisma/migrate-bump-user-industrial.ts
 * 前提: .env の DATABASE_URL が対象環境（本番など）を指していること。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_COST = 200;

async function main() {
  const before = await prisma.user.findMany({
    where: { industrialMaxCost: TARGET_COST },
    select: {
      id: true,
      accountId: true,
      industrialMaxSlots: true,
      industrialMaxCost: true,
    },
  });

  if (before.length === 0) {
    console.log(`コスト上限が ${TARGET_COST} のユーザーが0件のため処理しません。`);
    return;
  }

  // コスト上限が TARGET_COST のユーザーのみ +200 / +4
  await prisma.$executeRaw`
    UPDATE "User"
    SET "industrialMaxCost" = "industrialMaxCost" + 200,
        "industrialMaxSlots" = "industrialMaxSlots" + 4
    WHERE "industrialMaxCost" = ${TARGET_COST}
  `;

  console.log(`対象: コスト上限 ${TARGET_COST} のユーザー ${before.length} 件`);
  console.log("工業コスト上限 +200、設備設置数 +4 を反映しました。");

  const after = await prisma.user.findMany({
    where: { id: { in: before.map((u) => u.id) } },
    select: {
      accountId: true,
      industrialMaxSlots: true,
      industrialMaxCost: true,
    },
  });
  console.log("\n実行後の例（先頭3件）:");
  after.slice(0, 3).forEach((u) => {
    console.log(`  ${u.accountId}: 枠=${u.industrialMaxSlots}, コスト上限=${u.industrialMaxCost}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
