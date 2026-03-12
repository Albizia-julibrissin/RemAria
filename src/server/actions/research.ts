"use server";

// docs/054 - 研究グループ・アイテム消費で解放

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type ResearchUnlockCostItem = {
  itemId: string;
  itemName: string;
  itemCode: string;
  amount: number;
};

export type ResearchGroupItemSummary = {
  id: string;
  targetType: "facility_type" | "craft_recipe";
  targetId: string;
  targetName: string;
  isVariant: boolean;
  isUnlocked: boolean;
  cost: ResearchUnlockCostItem[];
};

export type ResearchGroupSummary = {
  id: string;
  code: string;
  name: string;
  isAvailable: boolean;
  items: ResearchGroupItemSummary[];
};

export type GetResearchMenuResult =
  | { success: true; groups: ResearchGroupSummary[] }
  | { success: false; error: string };

/**
 * 研究グループ一覧と、各グループ内の解放対象・コスト・解放済みを返す。
 * spec/068: グループの「利用可能」は任務解放のみで判定する。QuestUnlockResearchGroup に無いか、UserResearchGroupUnlock にユーザがいる場合 true。前提グループは見ない。
 */
export async function getResearchMenu(): Promise<GetResearchMenuResult> {
  const session = await getSession();
  if (!session?.userId) return { success: false, error: "UNAUTHORIZED" };
  const userId = session.userId;

  const [groups, facilityUnlocks, recipeUnlocks, userGroupUnlocks, gatedGroupIdsRows] =
    await Promise.all([
      prisma.researchGroup.findMany({
        orderBy: { displayOrder: "asc" },
        include: {
          items: { orderBy: { displayOrder: "asc" } },
        },
      }),
      prisma.userFacilityTypeUnlock.findMany({
        where: { userId },
        select: { facilityTypeId: true },
      }),
      prisma.userCraftRecipeUnlock.findMany({
        where: { userId },
        select: { craftRecipeId: true },
      }),
      prisma.userResearchGroupUnlock.findMany({
        where: { userId },
        select: { researchGroupId: true },
      }),
      prisma.questUnlockResearchGroup.findMany({
        select: { researchGroupId: true },
      }),
    ]);

  const userUnlockedGroupIds = new Set(userGroupUnlocks.map((u) => u.researchGroupId));
  const gatedGroupIds = new Set(gatedGroupIdsRows.map((r) => r.researchGroupId));

  const unlockedFacilityIds = new Set(facilityUnlocks.map((u) => u.facilityTypeId));
  const unlockedRecipeIds = new Set(recipeUnlocks.map((u) => u.craftRecipeId));

  const facilityNames = new Map<string, string>();
  const recipeNames = new Map<string, string>();
  const facilityIds = new Set<string>();
  const recipeIds = new Set<string>();
  for (const g of groups) {
    for (const it of g.items) {
      if (it.targetType === "facility_type") facilityIds.add(it.targetId);
      else recipeIds.add(it.targetId);
    }
  }
  if (facilityIds.size > 0) {
    const rows = await prisma.facilityType.findMany({
      where: { id: { in: [...facilityIds] } },
      select: { id: true, name: true },
    });
    rows.forEach((r) => facilityNames.set(r.id, r.name));
  }
  if (recipeIds.size > 0) {
    const rows = await prisma.craftRecipe.findMany({
      where: { id: { in: [...recipeIds] } },
      select: { id: true, name: true },
    });
    rows.forEach((r) => recipeNames.set(r.id, r.name));
  }

  const costRows = await prisma.researchUnlockCost.findMany({
    where: {
      OR: [
        { targetType: "facility_type", targetId: { in: [...facilityIds] } },
        { targetType: "craft_recipe", targetId: { in: [...recipeIds] } },
      ],
    },
    include: { item: { select: { id: true, name: true, code: true } } },
  });
  const costByTarget = new Map<string, ResearchUnlockCostItem[]>();
  for (const c of costRows) {
    const key = `${c.targetType}:${c.targetId}`;
    const arr = costByTarget.get(key) ?? [];
    arr.push({
      itemId: c.itemId,
      itemName: c.item.name,
      itemCode: c.item.code,
      amount: c.amount,
    });
    costByTarget.set(key, arr);
  }

  const result: ResearchGroupSummary[] = groups.map((g) => {
    const isAvailable =
      !gatedGroupIds.has(g.id) || userUnlockedGroupIds.has(g.id);
    const items: ResearchGroupItemSummary[] = g.items.map((it) => {
      const isUnlocked =
        it.targetType === "facility_type"
          ? unlockedFacilityIds.has(it.targetId)
          : unlockedRecipeIds.has(it.targetId);
      const targetName =
        it.targetType === "facility_type"
          ? facilityNames.get(it.targetId) ?? "（不明）"
          : recipeNames.get(it.targetId) ?? "（不明）";
      const cost = costByTarget.get(`${it.targetType}:${it.targetId}`) ?? [];
      return {
        id: it.id,
        targetType: it.targetType as "facility_type" | "craft_recipe",
        targetId: it.targetId,
        targetName,
        isVariant: it.isVariant,
        isUnlocked,
        cost,
      };
    });
    return {
      id: g.id,
      code: g.code,
      name: g.name,
      isAvailable,
      items,
    };
  });

  return { success: true, groups: result };
}

export type UnlockResearchTargetResult =
  | { success: true }
  | { success: false; error: string; message: string };

/**
 * 指定した解放対象をアイテム消費で解放する。
 * 対象の属するグループが利用可能で、未解放で、所持がコストを満たすときのみ成功。
 */
export async function unlockResearchTarget(
  targetType: "facility_type" | "craft_recipe",
  targetId: string
): Promise<UnlockResearchTargetResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  const userId = session.userId;

  const groupItem = await prisma.researchGroupItem.findFirst({
    where: { targetType, targetId },
    include: { researchGroup: { select: { id: true } } },
  });
  if (!groupItem) {
    return { success: false, error: "NOT_FOUND", message: "その解放対象は研究グループに登録されていません。" };
  }

  const researchGroupId = groupItem.researchGroup.id;

  const [existingFacility, existingRecipe, isGroupGated, userHasGroupUnlock] =
    await Promise.all([
      targetType === "facility_type"
        ? prisma.userFacilityTypeUnlock.findUnique({
            where: { userId_facilityTypeId: { userId, facilityTypeId: targetId } },
          })
        : null,
      targetType === "craft_recipe"
        ? prisma.userCraftRecipeUnlock.findUnique({
            where: { userId_craftRecipeId: { userId, craftRecipeId: targetId } },
          })
        : null,
      prisma.questUnlockResearchGroup.findFirst({
        where: { researchGroupId },
        select: { questId: true },
      }),
      prisma.userResearchGroupUnlock.findUnique({
        where: { userId_researchGroupId: { userId, researchGroupId } },
        select: { researchGroupId: true },
      }),
    ]);
  const alreadyUnlocked =
    targetType === "facility_type" ? !!existingFacility : !!existingRecipe;
  if (alreadyUnlocked) {
    return { success: false, error: "ALREADY_UNLOCKED", message: "すでに解放済みです。" };
  }

  const groupAvailable = !isGroupGated || !!userHasGroupUnlock;
  if (!groupAvailable) {
    return { success: false, error: "GROUP_LOCKED", message: "この研究グループは、開拓任務をクリアすると利用可能になります。" };
  }

  const costs = await prisma.researchUnlockCost.findMany({
    where: { targetType, targetId },
    include: { item: true },
  });
  if (costs.length === 0) {
    return { success: false, error: "NO_COST", message: "解放コストが設定されていません。" };
  }

  const inventories = await prisma.userInventory.findMany({
    where: {
      userId,
      itemId: { in: costs.map((c) => c.itemId) },
    },
    select: { itemId: true, quantity: true },
  });
  const qtyByItem = new Map(inventories.map((i) => [i.itemId, i.quantity]));
  for (const c of costs) {
    const have = qtyByItem.get(c.itemId) ?? 0;
    if (have < c.amount) {
      return {
        success: false,
        error: "INSUFFICIENT_ITEMS",
        message: `${c.item.name} が足りません。（必要: ${c.amount}、所持: ${have}）`,
      };
    }
  }

  const costItemIds = [...new Set(costs.map((c) => c.itemId))];
  await prisma.$transaction(async (tx) => {
    const invRows = await tx.userInventory.findMany({
      where: { userId, itemId: { in: costItemIds } },
      select: { id: true, itemId: true, quantity: true },
    });
    const qtyMap = new Map(invRows.map((r) => [r.itemId, r.quantity]));
    for (const c of costs) {
      const have = qtyMap.get(c.itemId) ?? 0;
      if (have < c.amount) {
        throw new Error("INSUFFICIENT_ITEMS");
      }
      const row = invRows.find((r) => r.itemId === c.itemId);
      if (!row) throw new Error("INSUFFICIENT_ITEMS");
      await tx.userInventory.update({
        where: { id: row.id },
        data: { quantity: { decrement: c.amount } },
      });
      qtyMap.set(c.itemId, have - c.amount);
    }
    if (targetType === "facility_type") {
      await tx.userFacilityTypeUnlock.create({
        data: { userId, facilityTypeId: targetId },
      });
    } else {
      await tx.userCraftRecipeUnlock.create({
        data: { userId, craftRecipeId: targetId },
      });
    }
  });

  return { success: true };
}
