// migrate_item_max_owned_per_user.cjs
//
// 目的:
// - Item.maxOwnedPerUser を一括設定する。
//   - 探索用資源「基本探索キット」のみ maxOwnedPerUser = 30000
//   - それ以外の全アイテムは maxOwnedPerUser = 99999
//
// 前提:
// - prisma/schema.prisma で Item.maxOwnedPerUser Int? が追加されており、
//   prisma migrate / db push 済みであること。
//
// 実行例（開発環境）:
//   node manage/scripts/migrate_item_max_owned_per_user.cjs

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("=== migrate_item_max_owned_per_user.cjs ===");
    console.log("全アイテムの maxOwnedPerUser を一括更新します。");

    // まず探索キット以外を 99999 に設定
    const updatedOthers = await prisma.item.updateMany({
      where: {
        code: { not: "basic_exploration_kit" },
      },
      data: {
        maxOwnedPerUser: 99999,
      },
    });
    console.log(`探索キット以外のアイテム ${updatedOthers.count} 件を maxOwnedPerUser=99999 に更新しました。`);

    // 探索キット（basic_exploration_kit）のみ 30000 に設定
    const updatedKit = await prisma.item.updateMany({
      where: {
        code: "basic_exploration_kit",
      },
      data: {
        maxOwnedPerUser: 30000,
      },
    });
    console.log(
      `basic_exploration_kit（基本探索キット） ${updatedKit.count} 件を maxOwnedPerUser=30000 に更新しました。`
    );

    console.log("完了しました。");
  } catch (e) {
    console.error("Migration failed:", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

