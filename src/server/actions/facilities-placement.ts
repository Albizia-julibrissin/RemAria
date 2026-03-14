"use server";

// spec/047 - 研究・解放・建設

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { receiveProduction } from "./receive-production";

export type UnlockedFacilityType = {
  id: string;
  name: string;
  cost: number;
};

export type ConstructionRecipeItem = {
  itemId: string;
  itemName: string;
  itemCode: string;
  amount: number;
};

/** 建造レシピ＋在庫・不足数（UI用） */
export type ConstructionRecipeRow = {
  itemName: string;
  amount: number;
  stock: number;
  shortfall: number;
};

export type PlaceFacilityResult =
  | { success: true; facilityInstanceId: string; facilityName: string }
  | { success: false; error: string; message: string };

export type DismantleFacilityResult =
  | { success: true }
  | { success: false; error: string; message: string };

export type ResearchState = {
  unlocked: UnlockedFacilityType[];
  unlockedFacilityTypeIds: string[];
};

/**
 * 建設可能な設備種別一覧（研究で解放済み）。spec/047。
 */
export async function getUnlockedFacilityTypes(): Promise<UnlockedFacilityType[] | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const unlocks = await prisma.userFacilityTypeUnlock.findMany({
    where: { userId: session.userId },
    include: { facilityType: { select: { id: true, name: true, cost: true } } },
  });
  return unlocks.map((u) => ({
    id: u.facilityType.id,
    name: u.facilityType.name,
    cost: u.facilityType.cost,
  }));
}

/**
 * 指定設備種別の建設に必要な資源一覧。spec/047, docs/078（派生型廃止で 1 種別 1 レシピ）。
 */
export async function getConstructionRecipe(
  facilityTypeId: string
): Promise<ConstructionRecipeItem[] | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const ft = await prisma.facilityType.findUnique({
    where: { id: facilityTypeId },
    include: {
      constructionInputs: { include: { item: true } },
    },
  });
  if (!ft || ft.constructionInputs.length === 0) return null;

  return ft.constructionInputs.map((inp) => ({
    itemId: inp.itemId,
    itemName: inp.item.name,
    itemCode: inp.item.code,
    amount: inp.amount,
  }));
}

/**
 * 指定設備種別の建設レシピ＋在庫・不足数。建造フォームのグリッド表示用。
 */
export async function getConstructionRecipeWithStock(
  facilityTypeId: string
): Promise<ConstructionRecipeRow[] | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const recipe = await getConstructionRecipe(facilityTypeId);
  if (!recipe || recipe.length === 0) return recipe;

  const itemIds = recipe.map((r) => r.itemId);
  const inventories = await prisma.userInventory.findMany({
    where: { userId: session.userId, itemId: { in: itemIds } },
    select: { itemId: true, quantity: true },
  });
  const stockByItemId = new Map(inventories.map((i) => [i.itemId, i.quantity]));

  return recipe.map((r) => {
    const stock = stockByItemId.get(r.itemId) ?? 0;
    const shortfall = Math.max(0, r.amount - stock);
    return {
      itemName: r.itemName,
      amount: r.amount,
      stock,
      shortfall,
    };
  });
}

/**
 * 設備を 1 つ配置する。強制受け取り実行後、建設レシピの資源を消費して FacilityInstance を作成。spec/047。
 */
export async function placeFacility(facilityTypeId: string): Promise<PlaceFacilityResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  const userId = session.userId;

  const unlock = await prisma.userFacilityTypeUnlock.findUnique({
    where: { userId_facilityTypeId: { userId, facilityTypeId } },
  });
  if (!unlock) {
    return { success: false, error: "NOT_UNLOCKED", message: "その設備はまだ解放されていません。" };
  }

  const ft = await prisma.facilityType.findUnique({
    where: { id: facilityTypeId },
    include: { constructionInputs: true },
  });
  if (!ft || ft.constructionInputs.length === 0) {
    return { success: false, error: "NOT_FOUND", message: "建設レシピが設定されていません。" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { industrialMaxSlots: true, industrialMaxCost: true },
  });
  if (!user) {
    return { success: false, error: "NOT_FOUND", message: "ユーザーが見つかりません。" };
  }

  const currentInstances = await prisma.facilityInstance.count({
    where: { userId },
  });
  if (currentInstances >= user.industrialMaxSlots) {
    return { success: false, error: "SLOTS_FULL", message: "設置枠が足りません。" };
  }

  const usedCost = await prisma.facilityInstance.findMany({
    where: { userId },
    include: { facilityType: { select: { cost: true } } },
  }).then((list) => list.reduce((s, i) => s + i.facilityType.cost, 0));
  if (usedCost + ft.cost > user.industrialMaxCost) {
    return { success: false, error: "COST_OVER", message: "コスト上限を超えます。" };
  }

  await receiveProduction();

  const inventories = await prisma.userInventory.findMany({
    where: { userId },
    select: { itemId: true, quantity: true },
  });
  const qtyByItemId = new Map(inventories.map((i) => [i.itemId, i.quantity]));

  for (const inp of ft.constructionInputs) {
    const have = qtyByItemId.get(inp.itemId) ?? 0;
    if (have < inp.amount) {
      const item = await prisma.item.findUnique({
        where: { id: inp.itemId },
        select: { name: true },
      });
      return {
        success: false,
        error: "INVENTORY",
        message: `${item?.name ?? "素材"}が${inp.amount - have}個不足しています。`,
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const inp of ft!.constructionInputs) {
        const inv = await tx.userInventory.findUnique({
          where: { userId_itemId: { userId, itemId: inp.itemId } },
        });
        if (!inv || inv.quantity < inp.amount) {
          throw new Error("INVENTORY");
        }
        await tx.userInventory.update({
          where: { userId_itemId: { userId, itemId: inp.itemId } },
          data: { quantity: inv.quantity - inp.amount },
        });
      }
      const maxOrder = await tx.facilityInstance
        .aggregate({ where: { userId }, _max: { displayOrder: true } })
        .then((r) => r._max.displayOrder ?? 0);
      const inst = await tx.facilityInstance.create({
        data: {
          userId,
          facilityTypeId,
          displayOrder: maxOrder + 1,
          isForced: false,
        },
        select: { id: true },
      });
      return { id: inst.id, name: ft!.name };
    });
    revalidatePath("/dashboard/facilities");
    return {
      success: true,
      facilityInstanceId: result.id,
      facilityName: result.name,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVENTORY") {
      return { success: false, error: "INVENTORY", message: "在庫が不足しています。" };
    }
    return { success: false, error: "UNKNOWN", message: "配置に失敗しました。" };
  }
}

/**
 * 設備を解体する。強制配置は解体不可。spec/047。
 */
export async function dismantleFacility(
  facilityInstanceId: string
): Promise<DismantleFacilityResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const inst = await prisma.facilityInstance.findFirst({
    where: { id: facilityInstanceId, userId: session.userId },
    select: { isForced: true },
  });
  if (!inst) {
    return { success: false, error: "NOT_FOUND", message: "設備が見つかりません。" };
  }
  if (inst.isForced) {
    return { success: false, error: "FORBIDDEN", message: "強制配置の設備は解体できません。" };
  }

  await prisma.facilityInstance.delete({
    where: { id: facilityInstanceId },
  });
  revalidatePath("/dashboard/facilities");
  return { success: true };
}

/**
 * 研究状態（解放済み設備種別一覧）。MVP では解放済みのみ返す。spec/047。
 */
export async function getResearchState(): Promise<ResearchState | null> {
  const list = await getUnlockedFacilityTypes();
  if (!list) return null;
  return {
    unlocked: list,
    unlockedFacilityTypeIds: list.map((u) => u.id),
  };
}
