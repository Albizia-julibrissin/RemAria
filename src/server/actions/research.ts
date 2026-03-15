"use server";

// docs/054 - 研究グループ・アイテム消費で解放
// spec/089 - 設備コスト拡張・設備設置上限拡張

import { revalidatePath } from "next/cache";
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
  /** 解放時に必要な研究記録書の数。0=不要 */
  requiredResearchPoint: number;
};

export type ResearchGroupSummary = {
  id: string;
  code: string;
  name: string;
  isAvailable: boolean;
  items: ResearchGroupItemSummary[];
};

/** spec/089: グループごとの設備コスト拡張（利用可能なグループのみ） */
export type FacilityCostExpansionSummary = {
  researchGroupId: string;
  researchGroupName: string;
  limit: number;
  amount: number;
  researchPoint: number;
  currentCount: number;
  isAvailable: boolean;
};

/** spec/089: グループごとの設備設置上限拡張（利用可能なグループのみ） */
export type SlotsExpansionSummary = {
  researchGroupId: string;
  researchGroupName: string;
  limit: number;
  amount: number;
  researchPoint: number;
  currentCount: number;
  isAvailable: boolean;
};

export type GetResearchMenuResult =
  | {
      success: true;
      groups: ResearchGroupSummary[];
      researchPoint: number;
      facilityCostExpansions: FacilityCostExpansionSummary[];
      slotsExpansions: SlotsExpansionSummary[];
    }
  | { success: false; error: string };

export type ResearchCostStockRow = {
  itemId: string;
  itemName: string;
  amount: number;
  stock: number;
  shortfall: number;
};

/**
 * 解放コストの各材料について、所持数・不足数を返す。材料モーダル用。
 */
export async function getResearchCostWithStock(
  cost: { itemId: string; amount: number }[]
): Promise<
  | { success: false; error: string }
  | { success: true; rows: ResearchCostStockRow[] }
> {
  const session = await getSession();
  if (!session?.userId) return { success: false, error: "UNAUTHORIZED" };
  if (cost.length === 0) return { success: true, rows: [] };
  const itemIds = [...new Set(cost.map((c) => c.itemId))];
  const [items, inventories] = await Promise.all([
    prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true },
    }),
    prisma.userInventory.findMany({
      where: { userId: session.userId, itemId: { in: itemIds } },
      select: { itemId: true, quantity: true },
    }),
  ]);
  const nameById = new Map(items.map((i) => [i.id, i.name]));
  const stockById = new Map(inventories.map((i) => [i.itemId, i.quantity]));
  const rows: ResearchCostStockRow[] = cost.map((c) => {
    const stock = stockById.get(c.itemId) ?? 0;
    const shortfall = Math.max(0, c.amount - stock);
    return {
      itemId: c.itemId,
      itemName: nameById.get(c.itemId) ?? "（不明）",
      amount: c.amount,
      stock,
      shortfall,
    };
  });
  return { success: true, rows };
}

/**
 * 研究グループ一覧と、各グループ内の解放対象・コスト・解放済みを返す。
 * spec/068: グループの「利用可能」は任務解放のみで判定する。QuestUnlockResearchGroup に無いか、UserResearchGroupUnlock にユーザがいる場合 true。前提グループは見ない。
 */
export async function getResearchMenu(): Promise<GetResearchMenuResult> {
  const session = await getSession();
  if (!session?.userId) return { success: false, error: "UNAUTHORIZED" };
  const userId = session.userId;

  const [
    groups,
    facilityUnlocks,
    recipeUnlocks,
    userGroupUnlocks,
    gatedGroupIdsRows,
    user,
    costExpansionRows,
    slotsExpansionRows,
  ] = await Promise.all([
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
    prisma.user.findUnique({
      where: { id: userId },
      select: { researchPoint: true },
    }),
    prisma.userResearchGroupCostExpansion.findMany({
      where: { userId },
      select: { researchGroupId: true, count: true },
    }),
    prisma.userResearchGroupSlotsExpansion.findMany({
      where: { userId },
      select: { researchGroupId: true, count: true },
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
        requiredResearchPoint: it.requiredResearchPoint ?? 0,
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

  const costExpansionByGroup = new Map(
    (costExpansionRows ?? []).map((r) => [r.researchGroupId, r.count])
  );
  const facilityCostExpansions: FacilityCostExpansionSummary[] = groups
    .filter(
      (g) =>
        g.facilityCostExpansionLimit > 0 &&
        (!gatedGroupIds.has(g.id) || userUnlockedGroupIds.has(g.id))
    )
    .map((g) => ({
      researchGroupId: g.id,
      researchGroupName: g.name,
      limit: g.facilityCostExpansionLimit,
      amount: g.facilityCostExpansionAmount,
      researchPoint: g.facilityCostExpansionResearchPoint,
      currentCount: costExpansionByGroup.get(g.id) ?? 0,
      isAvailable: true,
    }));

  const slotsExpansionByGroup = new Map(
    (slotsExpansionRows ?? []).map((r) => [r.researchGroupId, r.count])
  );
  const slotsExpansions: SlotsExpansionSummary[] = groups
    .filter(
      (g) =>
        g.facilitySlotsExpansionLimit > 0 &&
        (!gatedGroupIds.has(g.id) || userUnlockedGroupIds.has(g.id))
    )
    .map((g) => ({
      researchGroupId: g.id,
      researchGroupName: g.name,
      limit: g.facilitySlotsExpansionLimit,
      amount: g.facilitySlotsExpansionAmount,
      researchPoint: g.facilitySlotsExpansionResearchPoint,
      currentCount: slotsExpansionByGroup.get(g.id) ?? 0,
      isAvailable: true,
    }));

  return {
    success: true,
    groups: result,
    researchPoint: user?.researchPoint ?? 0,
    facilityCostExpansions,
    slotsExpansions,
  };
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
    select: {
      id: true,
      requiredResearchPoint: true,
      researchGroup: { select: { id: true } },
    },
  });
  if (!groupItem) {
    return { success: false, error: "NOT_FOUND", message: "その解放対象は研究グループに登録されていません。" };
  }

  const requiredResearchPoint = groupItem.requiredResearchPoint ?? 0;
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
  if (costs.length === 0 || requiredResearchPoint <= 0) {
    return {
      success: false,
      error: "NO_COST",
      message: "解放にはアイテムと研究記録書の両方の設定が必要です。",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { researchPoint: true },
  });
  if (requiredResearchPoint > 0 && (user?.researchPoint ?? 0) < requiredResearchPoint) {
    return {
      success: false,
      error: "INSUFFICIENT_RESEARCH_POINT",
      message: `研究記録書が足りません。（必要: ${requiredResearchPoint}、所持: ${user?.researchPoint ?? 0}）`,
    };
  }

  if (costs.length > 0) {
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
  }

  const costItemIds = [...new Set(costs.map((c) => c.itemId))];
  await prisma.$transaction(async (tx) => {
    if (requiredResearchPoint > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { researchPoint: { decrement: requiredResearchPoint } },
      });
    }
    if (costItemIds.length > 0) {
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

export type ExpandFacilityCostResult =
  | { success: true }
  | { success: false; error: string; message: string };

/**
 * spec/089: 指定研究グループで設備コスト上限を1回拡張する。研究記録書を消費。
 */
export async function expandFacilityCost(
  researchGroupId: string
): Promise<ExpandFacilityCostResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  const userId = session.userId;

  const group = await prisma.researchGroup.findUnique({
    where: { id: researchGroupId },
  });
  if (!group) {
    return { success: false, error: "NOT_FOUND", message: "研究グループが見つかりません。" };
  }
  if (
    group.facilityCostExpansionLimit <= 0 ||
    group.facilityCostExpansionAmount <= 0
  ) {
    return { success: false, error: "NOT_AVAILABLE", message: "このグループでは設備コスト拡張はできません。" };
  }

  const [gated, userUnlock, userRow, userResearchPoint] = await Promise.all([
    prisma.questUnlockResearchGroup.findFirst({
      where: { researchGroupId },
      select: { questId: true },
    }),
    prisma.userResearchGroupUnlock.findUnique({
      where: { userId_researchGroupId: { userId, researchGroupId } },
      select: { researchGroupId: true },
    }),
    prisma.userResearchGroupCostExpansion.findUnique({
      where: { userId_researchGroupId: { userId, researchGroupId } },
      select: { count: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { researchPoint: true },
    }),
  ]);
  const groupAvailable = !gated || !!userUnlock;
  if (!groupAvailable) {
    return {
      success: false,
      error: "GROUP_LOCKED",
      message: "この研究グループは、開拓任務をクリアすると利用可能になります。",
    };
  }
  const currentCount = userRow?.count ?? 0;
  if (currentCount >= group.facilityCostExpansionLimit) {
    return {
      success: false,
      error: "LIMIT_REACHED",
      message: "このグループの設備コスト拡張は上限に達しています。",
    };
  }
  const required = group.facilityCostExpansionResearchPoint;
  const have = userResearchPoint?.researchPoint ?? 0;
  if (have < required) {
    return {
      success: false,
      error: "INSUFFICIENT_RESEARCH_POINT",
      message: `研究記録書が足りません。（必要: ${required}、所持: ${have}）`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        researchPoint: { decrement: required },
        industrialMaxCost: { increment: group.facilityCostExpansionAmount },
      },
    });
    await tx.userResearchGroupCostExpansion.upsert({
      where: {
        userId_researchGroupId: { userId, researchGroupId },
      },
      create: {
        userId,
        researchGroupId,
        count: 1,
      },
      update: { count: { increment: 1 } },
    });
  });

  revalidatePath("/dashboard/research");
  return { success: true };
}

export type ExpandFacilitySlotsResult =
  | { success: true }
  | { success: false; error: string; message: string };

/**
 * spec/089: 指定研究グループで設備設置上限を1回拡張する。研究記録書を消費。
 */
export async function expandFacilitySlots(
  researchGroupId: string
): Promise<ExpandFacilitySlotsResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  const userId = session.userId;

  const group = await prisma.researchGroup.findUnique({
    where: { id: researchGroupId },
  });
  if (!group) {
    return { success: false, error: "NOT_FOUND", message: "研究グループが見つかりません。" };
  }
  if (
    group.facilitySlotsExpansionLimit <= 0 ||
    group.facilitySlotsExpansionAmount <= 0
  ) {
    return {
      success: false,
      error: "NOT_AVAILABLE",
      message: "このグループでは設備設置上限拡張はできません。",
    };
  }

  const [gated, userUnlock, userRow, userResearchPoint] = await Promise.all([
    prisma.questUnlockResearchGroup.findFirst({
      where: { researchGroupId },
      select: { questId: true },
    }),
    prisma.userResearchGroupUnlock.findUnique({
      where: { userId_researchGroupId: { userId, researchGroupId } },
      select: { researchGroupId: true },
    }),
    prisma.userResearchGroupSlotsExpansion.findUnique({
      where: { userId_researchGroupId: { userId, researchGroupId } },
      select: { count: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { researchPoint: true },
    }),
  ]);
  const groupAvailable = !gated || !!userUnlock;
  if (!groupAvailable) {
    return {
      success: false,
      error: "GROUP_LOCKED",
      message: "この研究グループは、開拓任務をクリアすると利用可能になります。",
    };
  }
  const currentCount = userRow?.count ?? 0;
  if (currentCount >= group.facilitySlotsExpansionLimit) {
    return {
      success: false,
      error: "LIMIT_REACHED",
      message: "このグループの設備設置上限拡張は上限に達しています。",
    };
  }
  const required = group.facilitySlotsExpansionResearchPoint;
  const have = userResearchPoint?.researchPoint ?? 0;
  if (have < required) {
    return {
      success: false,
      error: "INSUFFICIENT_RESEARCH_POINT",
      message: `研究記録書が足りません。（必要: ${required}、所持: ${have}）`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        researchPoint: { decrement: required },
        industrialMaxSlots: { increment: group.facilitySlotsExpansionAmount },
      },
    });
    await tx.userResearchGroupSlotsExpansion.upsert({
      where: {
        userId_researchGroupId: { userId, researchGroupId },
      },
      create: {
        userId,
        researchGroupId,
        count: 1,
      },
      update: { count: { increment: 1 } },
    });
  });

  revalidatePath("/dashboard/research");
  return { success: true };
}
