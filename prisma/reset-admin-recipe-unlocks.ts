/**
 * 管理用アカウント（管理人）のクラフトレシピ解放をすべて解除する。
 * レシピ解放テスト用の一時スクリプト。
 *
 * 実行例:
 *   npx tsx prisma/reset-admin-recipe-unlocks.ts
 *   npx tsx prisma/reset-admin-recipe-unlocks.ts --dry-run
 *
 * 前提: .env の DATABASE_URL。管理人は ADMIN_EMAIL（未設定時は test1@example.com）で特定。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "test1@example.com";
const isDryRun =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function main(): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    console.error(`管理人アカウントが見つかりません: ${ADMIN_EMAIL}`);
    process.exit(1);
  }

  const count = await prisma.userCraftRecipeUnlock.count({
    where: { userId: user.id },
  });

  if (count === 0) {
    console.log(`管理人 (${user.email}) の解放済みレシピは 0 件です。`);
    return;
  }

  console.log(`管理人 (${user.email}) の解放済みレシピ: ${count} 件`);

  if (isDryRun) {
    console.log("[DRY-RUN] 解除しません。実行する場合は --dry-run を外してください。");
    return;
  }

  const result = await prisma.userCraftRecipeUnlock.deleteMany({
    where: { userId: user.id },
  });
  console.log(`${result.count} 件のレシピ解放を解除しました。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
