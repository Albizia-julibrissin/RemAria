/**
 * シードで作成するテストユーザ以外のアカウント（User）を削除する。
 *
 * 残すユーザ: accountId が 'admin'（管理人）または 'test_user_2'（test2@example.com）のユーザのみ。
 * これらは prisma/seed.ts で作成・更新されるテスト用アカウント。
 *
 * 実行例:
 *   npx tsx prisma/delete-non-seed-users.ts           # 削除を実行
 *   npx tsx prisma/delete-non-seed-users.ts --dry-run # 削除対象を表示するだけ（引数が渡らない環境では DRY_RUN=1 を使用）
 *   DRY_RUN=1 npx tsx prisma/delete-non-seed-users.ts # 同上（npm run 経由で引数が渡らない場合に推奨）
 *
 * 前提: DATABASE_URL が設定されていること。本番で実行する場合は必ず dry-run で確認してから実行すること。
 */
import { PrismaClient } from "@prisma/client";

/** シードで作成するテストユーザの accountId（削除対象から除外） */
const SEED_ACCOUNT_IDS = ["admin", "test_user_2"] as const;

const prisma = new PrismaClient();
/** dry-run: 引数 --dry-run または環境変数 DRY_RUN=1 で有効（npm run 経由だと引数が届かない環境があるため両方対応） */
const isDryRun =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function main(): Promise<void> {
  const toDelete = await prisma.user.findMany({
    where: { accountId: { notIn: [...SEED_ACCOUNT_IDS] } },
    select: { id: true, email: true, accountId: true, name: true },
  });

  if (toDelete.length === 0) {
    console.log("削除対象のユーザはいません。");
    return;
  }

  console.log(`削除対象: ${toDelete.length} 件`);
  for (const u of toDelete) {
    console.log(`  - ${u.email} (accountId: ${u.accountId}, name: ${u.name})`);
  }

  if (isDryRun) {
    console.log("\n[DRY-RUN] 削除は行いません。実行する場合は DRY_RUN を外して再度実行してください。");
    return;
  }

  const result = await prisma.user.deleteMany({
    where: { accountId: { notIn: [...SEED_ACCOUNT_IDS] } },
  });
  console.log(`\n${result.count} 件のユーザを削除しました。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
