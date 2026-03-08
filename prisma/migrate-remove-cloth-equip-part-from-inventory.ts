/**
 * 一時処理: 全プレイヤーの手持ちから「布の装備部品」(cloth_equip_part) を削除する。
 * 1 回だけ実行: npx tsx prisma/migrate-remove-cloth-equip-part-from-inventory.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.item.findUnique({
    where: { code: "cloth_equip_part" },
    select: { id: true, code: true, name: true },
  });
  if (!item) {
    console.log("布の装備部品 (cloth_equip_part) はアイテムマスタに存在しません。処理不要です。");
    return;
  }

  const before = await prisma.userInventory.count({
    where: { itemId: item.id },
  });
  if (before === 0) {
    console.log("布の装備部品 を所持しているユーザーはいません。処理不要です。");
    return;
  }

  const deleted = await prisma.userInventory.deleteMany({
    where: { itemId: item.id },
  });
  console.log(`布の装備部品 を手持ちから削除しました。削除件数: ${deleted.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
