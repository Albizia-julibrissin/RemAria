/**
 * 装備型「布の鎧」(cloth_armor) を DB から削除する。
 * 参照: EquipmentInstance（装備個体）、CraftRecipe（出力が布の鎧のレシピ）、CharacterEquipment は EquipmentInstance 経由。
 * 1 回だけ実行: npx tsx prisma/migrate-remove-cloth-armor.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const et = await prisma.equipmentType.findUnique({
    where: { code: "cloth_armor" },
    select: { id: true, name: true },
  });
  if (!et) {
    console.log("布の鎧 (cloth_armor) は存在しません。処理不要です。");
    return;
  }

  const id = et.id;
  console.log("布の鎧 を削除します（参照を先に解消）。");

  const instances = await prisma.equipmentInstance.findMany({
    where: { equipmentTypeId: id },
    select: { id: true },
  });
  for (const inst of instances) {
    await prisma.characterEquipment.updateMany({
      where: { equipmentInstanceId: inst.id },
      data: { equipmentInstanceId: null },
    });
  }
  await prisma.equipmentInstance.deleteMany({ where: { equipmentTypeId: id } });

  const cottonRobe = await prisma.equipmentType.findUnique({
    where: { code: "cotton_robe" },
    select: { id: true },
  });
  await prisma.craftRecipe.updateMany({
    where: { outputEquipmentTypeId: id },
    data: { outputEquipmentTypeId: cottonRobe?.id ?? null },
  });
  await prisma.equipmentType.delete({ where: { id } });

  console.log("布の鎧 を削除しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
