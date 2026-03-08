/**
 * クラフトレシピから「布の鎧」(cloth_armor) を消す。
 * - code が cloth_armor の CraftRecipe を削除
 * - 装備型 cloth_armor が残っていれば参照を解消してから削除
 * 1 回だけ実行: npx tsx prisma/migrate-remove-cloth-armor-from-craft.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. クラフトレシピで code が cloth_armor のものを削除
  const deletedRecipes = await prisma.craftRecipe.deleteMany({
    where: { code: "cloth_armor" },
  });
  if (deletedRecipes.count > 0) {
    console.log(`クラフトレシピ「布の鎧」(code=cloth_armor) を ${deletedRecipes.count} 件削除しました。`);
  } else {
    console.log("code=cloth_armor のクラフトレシピはありません。");
  }

  // 2. 装備型「布の鎧」が残っていれば削除（参照を解消してから）
  const et = await prisma.equipmentType.findUnique({
    where: { code: "cloth_armor" },
    select: { id: true, name: true },
  });
  if (!et) {
    console.log("装備型 布の鎧 (cloth_armor) は存在しません。");
    return;
  }

  console.log("装備型 布の鎧 を削除します（参照を先に解消）。");
  const instances = await prisma.equipmentInstance.findMany({
    where: { equipmentTypeId: et.id },
    select: { id: true },
  });
  for (const inst of instances) {
    await prisma.characterEquipment.updateMany({
      where: { equipmentInstanceId: inst.id },
      data: { equipmentInstanceId: null },
    });
  }
  await prisma.equipmentInstance.deleteMany({ where: { equipmentTypeId: et.id } });

  const cottonRobe = await prisma.equipmentType.findUnique({
    where: { code: "cotton_robe" },
    select: { id: true },
  });
  await prisma.craftRecipe.updateMany({
    where: { outputEquipmentTypeId: et.id },
    data: { outputEquipmentTypeId: cottonRobe?.id ?? null },
  });
  await prisma.equipmentType.delete({ where: { id: et.id } });
  console.log("装備型 布の鎧 を削除しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
