/**
 * rust_forest_research 研究グループに鉄シリーズ・綿シリーズのクラフトレシピを登録する。
 * - 研究記録書: 各レシピ 1 枚（requiredResearchPoint: 1）
 * - 解放消費アイテム: 鉄シリーズ → iron_equip_part（鉄部品）x10, 綿シリーズ → cotton_equip_part（綿部品）x10
 *
 * 前提: ResearchGroup.code = "rust_forest_research", Item.code = "iron_equip_part" / "cotton_equip_part" が存在すること。
 * レシピは code が craft_iron_* または craft_cotton_* のものを対象とする。
 *
 * 実行: npx tsx prisma/seed-rust-forest-iron-cotton.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RESEARCH_GROUP_CODE = "rust_forest_research";
const IRON_PART_ITEM_CODE = "iron_equip_part";
const COTTON_PART_ITEM_CODE = "cotton_equip_part";
const RESEARCH_POINT_PER_RECIPE = 1;
const IRON_COST_AMOUNT = 10;
const COTTON_COST_AMOUNT = 10;

async function main(): Promise<void> {
  const group = await prisma.researchGroup.findUnique({
    where: { code: RESEARCH_GROUP_CODE },
    select: { id: true, name: true },
  });
  if (!group) {
    console.error(`研究グループ "${RESEARCH_GROUP_CODE}" が見つかりません。`);
    process.exit(1);
  }

  const [ironPartItem, cottonPartItem] = await Promise.all([
    prisma.item.findUnique({ where: { code: IRON_PART_ITEM_CODE }, select: { id: true } }),
    prisma.item.findUnique({ where: { code: COTTON_PART_ITEM_CODE }, select: { id: true } }),
  ]);
  if (!ironPartItem) {
    console.error(`アイテム "${IRON_PART_ITEM_CODE}"（鉄部品）が見つかりません。`);
    process.exit(1);
  }
  if (!cottonPartItem) {
    console.error(`アイテム "${COTTON_PART_ITEM_CODE}"（綿部品）が見つかりません。`);
    process.exit(1);
  }

  const ironRecipes = await prisma.craftRecipe.findMany({
    where: { code: { startsWith: "craft_iron_" } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  const cottonRecipes = await prisma.craftRecipe.findMany({
    where: { code: { startsWith: "craft_cotton_" } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  if (ironRecipes.length === 0 && cottonRecipes.length === 0) {
    console.log("鉄・綿シリーズのレシピ（craft_iron_*, craft_cotton_*）が1件もありません。");
    process.exit(0);
  }

  let orderIndex = 0;
  const createdItems: string[] = [];

  for (const recipe of ironRecipes) {
    await prisma.researchGroupItem.upsert({
      where: {
        researchGroupId_targetType_targetId: {
          researchGroupId: group.id,
          targetType: "craft_recipe",
          targetId: recipe.id,
        },
      },
      create: {
        researchGroupId: group.id,
        targetType: "craft_recipe",
        targetId: recipe.id,
        displayOrder: orderIndex++,
        requiredResearchPoint: RESEARCH_POINT_PER_RECIPE,
      },
      update: {
        displayOrder: orderIndex++,
        requiredResearchPoint: RESEARCH_POINT_PER_RECIPE,
      },
    });
    createdItems.push(recipe.code);

    await prisma.researchUnlockCost.upsert({
      where: {
        targetType_targetId_itemId: {
          targetType: "craft_recipe",
          targetId: recipe.id,
          itemId: ironPartItem.id,
        },
      },
      create: {
        targetType: "craft_recipe",
        targetId: recipe.id,
        itemId: ironPartItem.id,
        amount: IRON_COST_AMOUNT,
      },
      update: { amount: IRON_COST_AMOUNT },
    });
  }

  for (const recipe of cottonRecipes) {
    await prisma.researchGroupItem.upsert({
      where: {
        researchGroupId_targetType_targetId: {
          researchGroupId: group.id,
          targetType: "craft_recipe",
          targetId: recipe.id,
        },
      },
      create: {
        researchGroupId: group.id,
        targetType: "craft_recipe",
        targetId: recipe.id,
        displayOrder: orderIndex++,
        requiredResearchPoint: RESEARCH_POINT_PER_RECIPE,
      },
      update: {
        displayOrder: orderIndex++,
        requiredResearchPoint: RESEARCH_POINT_PER_RECIPE,
      },
    });
    createdItems.push(recipe.code);

    await prisma.researchUnlockCost.upsert({
      where: {
        targetType_targetId_itemId: {
          targetType: "craft_recipe",
          targetId: recipe.id,
          itemId: cottonPartItem.id,
        },
      },
      create: {
        targetType: "craft_recipe",
        targetId: recipe.id,
        itemId: cottonPartItem.id,
        amount: COTTON_COST_AMOUNT,
      },
      update: { amount: COTTON_COST_AMOUNT },
    });
  }

  console.log(`研究グループ "${RESEARCH_GROUP_CODE}"（${group.name}）に登録しました。`);
  console.log(`ResearchGroupItem: ${createdItems.length} 件（研究記録書 ${RESEARCH_POINT_PER_RECIPE} 枚/件）`);
  console.log(`ResearchUnlockCost: 鉄シリーズ ${ironRecipes.length} 件（${IRON_PART_ITEM_CODE} x${IRON_COST_AMOUNT}）、綿シリーズ ${cottonRecipes.length} 件（${COTTON_PART_ITEM_CODE} x${COTTON_COST_AMOUNT}）`);
  createdItems.forEach((c) => console.log(`  - ${c}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
