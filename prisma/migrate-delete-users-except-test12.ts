/**
 * テストユーザー1・2以外のアカウント（User）を削除する。
 * 関連データは User の onDelete: Cascade で削除される。
 * 1 回だけ実行: npx tsx prisma/migrate-delete-users-except-test12.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEEP_ACCOUNT_IDS = ["test_user_1", "test_user_2"] as const;

async function main() {
  const toDelete = await prisma.user.findMany({
    where: { accountId: { notIn: [...KEEP_ACCOUNT_IDS] } },
    select: { id: true, accountId: true, email: true },
  });

  if (toDelete.length === 0) {
    console.log("削除対象のユーザーはいません（test_user_1 / test_user_2 のみ存在）。");
    return;
  }

  console.log(`削除するユーザー: ${toDelete.length} 件`);
  for (const u of toDelete) {
    console.log(`  - ${u.accountId} (${u.email})`);
  }

  const result = await prisma.user.deleteMany({
    where: { accountId: { notIn: [...KEEP_ACCOUNT_IDS] } },
  });
  console.log(`削除しました: ${result.count} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
