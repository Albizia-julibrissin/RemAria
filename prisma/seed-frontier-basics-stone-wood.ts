/**
 * frontier_basics 研究グループに石材シリーズ・木材シリーズのクラフトレシピを登録する。
 * - 研究記録書: 各レシピ 1 枚（requiredResearchPoint: 1）
 * - 解放消費アイテム: 石材シリーズ → stone x5, 木材シリーズ → timber x5
 *
 * 前提: ResearchGroup.code = "frontier_basics", Item.code = "stone" / "timber" が存在すること。
 * レシピは code が craft_stone_* または craft_wood_* のものを対象とする。
 *
 * 実行: npx tsx prisma/seed-frontier-basics-stone-wood.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RESEARCH_GROUP_CODE = "frontier_basics";
const STONE_ITEM_CODE = "stone";
const TIMBER_ITEM_CODE = "timber";
const RESEARCH_POINT_PER_RECIPE = 1;
const STONE_COST_AMOUNT = 5;
const TIMBER_COST_AMOUNT = 5;

async function main(): Promise<void> {
  const group = await prisma.researchGroup.findUnique({
    where: { code: RESEARCH_GROUP_CODE },
    select: { id: true, name: true },
  });
  if (!group) {
    console.error(`研究グループ "${RESEARCH_GROUP_CODE}" が見つかりません。`);
    process.exit(1);
  }

  const [stoneItem, timberItem] = await Promise.all([
    prisma.item.findUnique({ where: { code: STONE_ITEM_CODE }, select: { id: true } }),
    prisma.item.findUnique({ where: { code: TIMBER_ITEM_CODE }, select: { id: true } }),
  ]);
  if (!stoneItem) {
    console.error(`アイテム "${STONE_ITEM_CODE}" が見つかりません。`);
    process.exit(1);
  }
  if (!timberItem) {
    console.error(`アイテム "${TIMBER_ITEM_CODE}" が見つかりません。`);
    process.exit(1);
  }

  const stoneRecipes = await prisma.craftRecipe.findMany({
    where: { code: { startsWith: "craft_stone_" } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  const woodRecipes = await prisma.craftRecipe.findMany({
    where: { code: { startsWith: "craft_wood_" } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  if (stoneRecipes.length === 0 && woodRecipes.length === 0) {
    console.log("石材・木材シリーズのレシピ（craft_stone_*, craft_wood_*）が1件もありません。");
    process.exit(0);
  }

  let orderIndex = 0;
  const createdItems: string[] = [];
  const createdCosts: string[] = [];

  for (const recipe of stoneRecipes) {
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
          itemId: stoneItem.id,
        },
      },
      create: {
        targetType: "craft_recipe",
        targetId: recipe.id,
        itemId: stoneItem.id,
        amount: STONE_COST_AMOUNT,
      },
      update: { amount: STONE_COST_AMOUNT },
    });
    createdCosts.push(`${recipe.code} + stone x${STONE_COST_AMOUNT}`);
  }

  for (const recipe of woodRecipes) {
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
          itemId: timberItem.id,
        },
      },
      create: {
        targetType: "craft_recipe",
        targetId: recipe.id,
        itemId: timberItem.id,
        amount: TIMBER_COST_AMOUNT,
      },
      update: { amount: TIMBER_COST_AMOUNT },
    });
    createdCosts.push(`${recipe.code} + timber x${TIMBER_COST_AMOUNT}`);
  }

  console.log(`研究グループ "${RESEARCH_GROUP_CODE}"（${group.name}）に登録しました。`);
  console.log(`ResearchGroupItem: ${createdItems.length} 件（研究記録書 ${RESEARCH_POINT_PER_RECIPE} 枚/件）`);
  console.log(`ResearchUnlockCost: ${createdCosts.length} 件`);
  createdItems.forEach((c) => console.log(`  - ${c}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
