/**
 * 全ユーザーの「工業コスト上限」を +200、「設備設置数」を +4 する。
 * 本番で一度だけ実行する想定。2回実行するとさらに +200 / +4 が加算される。
 *
 * 実行: npx tsx prisma/migrate-bump-user-industrial.ts
 * 前提: .env の DATABASE_URL が対象環境（本番など）を指していること。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.user.findMany({
    select: {
      id: true,
      accountId: true,
      industrialMaxSlots: true,
      industrialMaxCost: true,
    },
  });

  if (before.length === 0) {
    console.log("ユーザーが0件のため処理しません。");
    return;
  }

  // 一括で +200 / +4（SQL で加算）
  await prisma.$executeRaw`
    UPDATE "User"
    SET "industrialMaxCost" = "industrialMaxCost" + 200,
        "industrialMaxSlots" = "industrialMaxSlots" + 4
  `;

  console.log(`対象: ${before.length} ユーザー`);
  console.log("工業コスト上限 +200、設備設置数 +4 を反映しました。");

  const after = await prisma.user.findMany({
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
