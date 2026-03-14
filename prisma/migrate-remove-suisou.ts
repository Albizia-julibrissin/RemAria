/**
 * 設備種別「貯水槽」を DB から完全に削除する（研究からの紐づけ・設置・解放・レシピ等をすべて削除してから削除）。
 * 1 回だけ実行: npx tsx prisma/migrate-remove-suisou.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ft = await prisma.facilityType.findUnique({
    where: { name: "貯水槽" },
    select: { id: true },
  });
  if (!ft) {
    console.log("貯水槽 は存在しません。処理不要です。");
    return;
  }

  const id = ft.id;
  console.log("貯水槽 を削除します（参照を先に削除）。");

  await prisma.researchGroupItem.deleteMany({
    where: { targetType: "facility_type", targetId: id },
  });
  await prisma.researchUnlockCost.deleteMany({
    where: { targetType: "facility_type", targetId: id },
  });
  await prisma.facilityInstance.deleteMany({ where: { facilityTypeId: id } });
  await prisma.userFacilityTypeUnlock.deleteMany({ where: { facilityTypeId: id } });
  const recipes = await prisma.recipe.findMany({ where: { facilityTypeId: id }, select: { id: true } });
  for (const r of recipes) {
    await prisma.recipeInput.deleteMany({ where: { recipeId: r.id } });
  }
  await prisma.recipe.deleteMany({ where: { facilityTypeId: id } });
  await prisma.facilityTypeConstructionInput.deleteMany({ where: { facilityTypeId: id } });
  await prisma.facilityTypeTag.deleteMany({ where: { facilityTypeId: id } });
  await prisma.facilityType.delete({ where: { id } });

  console.log("貯水槽 を削除しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
