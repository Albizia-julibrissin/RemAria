/**
 * 一時処理: テストユーザー(test1)のメカの基礎ステを CAP560・オール80 に揃える。
 * 一回だけ実行すればよい。実行: npx tsx scripts/fix-test-mech-stats.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_STATS = {
  STR: 80,
  INT: 80,
  VIT: 80,
  WIS: 80,
  DEX: 80,
  AGI: 80,
  LUK: 80,
  CAP: 560,
};

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "test1@example.com" },
    select: { id: true },
  });
  if (!user) {
    console.log("test1 ユーザーが見つかりません。");
    return;
  }

  const mech = await prisma.character.findFirst({
    where: { userId: user.id, category: "mech" },
    select: { id: true, displayName: true },
  });
  if (!mech) {
    console.log("test1 のメカが見つかりません。");
    return;
  }

  await prisma.character.update({
    where: { id: mech.id },
    data: TARGET_STATS,
  });

  console.log(`test1 のメカ「${mech.displayName}」を CAP560・オール80 に更新しました。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
