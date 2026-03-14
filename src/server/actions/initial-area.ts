"use server";

// spec/035, 036 - 初期工業・強制配置設備と生産チェーン（エリア制廃止）
// docs/019 - 受け取り可能サイクル数のプレビュー

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  INITIAL_FACILITY_NAMES,
  INITIAL_GRA_AMOUNT,
  INITIAL_GRANT_ITEM_AMOUNT,
  INITIAL_GRANT_ITEM_CODE,
} from "@/lib/constants/initial-area";
import { CURRENCY_REASON_GAME_START } from "@/lib/constants/currency-transaction-reasons";
import { EMERGENCY_PRODUCTION_ORDER_ITEM_CODE, PRODUCTION_CAP_MINUTES } from "@/lib/constants/production";
import { grantStackableItem } from "@/server/lib/inventory";

export type IndustrialFacility = {
  id: string;
  facilityTypeId: string;
  facilityName: string;
  cost: number;
  displayOrder: number;
  /** spec/047: 強制配置は解体不可 */
  isForced: boolean;
  /** 受け取り可能サイクル数（019 プレビュー。実際の受け取りは 036 で一括計算） */
  receivableCycles: number;
  receivableOutputAmount: number;
  recipe: {
    cycleMinutes: number;
    outputItemName: string;
    outputAmount: number;
    inputs: { itemName: string; amount: number; itemId: string }[];
  } | null;
};

export type GetIndustrialResult = {
  maxSlots: number;
  maxCost: number;
  usedSlots: number;
  usedCost: number;
  facilities: IndustrialFacility[];
  /** spec/083: 緊急製造指示書の所持数（モーダル表示用） */
  emergencyProductionOrderCount: number;
};

/** 強制配置 5 設備が無ければ作成する。冪等。spec/035 */
export async function ensureInitialFacilities(userId: string): Promise<void> {
  const forcedCount = await prisma.facilityInstance.count({
    where: { userId, isForced: true },
  });
  if (forcedCount >= 5) return;

  const facilityTypes = await prisma.facilityType.findMany({
    where: { name: { in: [...INITIAL_FACILITY_NAMES] } },
    select: { id: true, name: true },
  });
  const byName = new Map(facilityTypes.map((f) => [f.name, f.id]));

  const existing = await prisma.facilityInstance.findMany({
    where: { userId, isForced: true },
    select: { facilityTypeId: true },
  });
  const existingTypeIds = new Set(existing.map((e) => e.facilityTypeId));

  let displayOrder = 0;
  for (const name of INITIAL_FACILITY_NAMES) {
    const facilityTypeId = byName.get(name);
    if (!facilityTypeId) continue;
    if (existingTypeIds.has(facilityTypeId)) {
      displayOrder += 1;
      continue;
    }
    displayOrder += 1;
    await prisma.facilityInstance.create({
      data: {
        userId,
        facilityTypeId,
        displayOrder,
        isForced: true,
      },
    });
    existingTypeIds.add(facilityTypeId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      industrialMaxSlots: 5,
      industrialMaxCost: 200,
    },
  });
}

/**
 * ゲーム開始時付与：3000 GRA（無償）と基本探索キット 500 個。
 * 新規登録時に 1 回だけ呼ぶ。manage/ECONOMY_DESIGN.md。
 */
export async function ensureGameStartGrants(userId: string): Promise<void> {
  const item = await prisma.item.findUnique({
    where: { code: INITIAL_GRANT_ITEM_CODE },
    select: { id: true },
  });

  const beforeBalance =
    (await prisma.user.findUnique({
      where: { id: userId },
      select: { premiumCurrencyFreeBalance: true },
    }))?.premiumCurrencyFreeBalance ?? 0;
  const afterBalance = beforeBalance + INITIAL_GRA_AMOUNT;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { premiumCurrencyFreeBalance: { increment: INITIAL_GRA_AMOUNT } },
    });
    await tx.currencyTransaction.create({
      data: {
        userId,
        currencyType: "premium_free",
        amount: INITIAL_GRA_AMOUNT,
        beforeBalance,
        afterBalance,
        reason: CURRENCY_REASON_GAME_START,
        referenceType: "user",
        referenceId: userId,
      },
    });
    if (item) {
      await grantStackableItem(tx, {
        userId,
        itemId: item.id,
        delta: INITIAL_GRANT_ITEM_AMOUNT,
      });
    }
  });
}

/** 工業情報を取得。未作成なら ensure してから返す。spec/035 */
export async function getIndustrial(): Promise<GetIndustrialResult | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  await ensureInitialFacilities(session.userId);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { industrialMaxSlots: true, industrialMaxCost: true, createdAt: true },
  });
  if (!user) return null;

  const instances = await prisma.facilityInstance.findMany({
    where: { userId: session.userId },
    orderBy: { id: "asc" },
    include: {
      facilityType: {
        include: {
          recipes: {
            include: {
              outputItem: true,
              inputs: { include: { item: true } },
            },
          },
        },
      },
    },
  });

  const inventories = await prisma.userInventory.findMany({
    where: { userId: session.userId },
    select: { itemId: true, quantity: true },
  });
  const qtyByItemId = new Map(inventories.map((i) => [i.itemId, i.quantity]));

  const emergencyItem = await prisma.item.findUnique({
    where: { code: EMERGENCY_PRODUCTION_ORDER_ITEM_CODE },
    select: { id: true },
  });
  const emergencyProductionOrderCount = emergencyItem ? qtyByItemId.get(emergencyItem.id) ?? 0 : 0;

  const now = new Date();
  let usedCost = 0;
  const facilities: IndustrialFacility[] = instances.map((inst) => {
    usedCost += inst.facilityType.cost;
    const recipe = inst.facilityType.recipes[0] ?? null;
    let receivableCycles = 0;
    let receivableOutputAmount = 0;
    if (recipe) {
      const effectiveLast = inst.lastProducedAt ?? (inst.isForced ? user.createdAt : inst.createdAt);
      const elapsedMs = Math.max(0, now.getTime() - effectiveLast.getTime());
      const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
      const cappedMinutes = Math.min(elapsedMinutes, PRODUCTION_CAP_MINUTES);
      let cyclesByTime = Math.floor(cappedMinutes / recipe.cycleMinutes);
      if (recipe.inputs.length > 0) {
        for (const input of recipe.inputs) {
          const have = qtyByItemId.get(input.itemId) ?? 0;
          cyclesByTime = Math.min(cyclesByTime, Math.floor(have / input.amount));
        }
      }
      receivableCycles = Math.max(0, cyclesByTime);
      receivableOutputAmount = recipe.outputAmount * receivableCycles;
    }
    return {
      id: inst.id,
      facilityTypeId: inst.facilityTypeId,
      facilityName: inst.facilityType.name,
      cost: inst.facilityType.cost,
      displayOrder: inst.displayOrder,
      isForced: inst.isForced,
      receivableCycles,
      receivableOutputAmount,
      recipe: recipe
        ? {
            cycleMinutes: recipe.cycleMinutes,
            outputItemName: recipe.outputItem.name,
            outputAmount: recipe.outputAmount,
            inputs: recipe.inputs.map((ri) => ({
              itemName: ri.item.name,
              amount: ri.amount,
              itemId: ri.itemId,
            })),
          }
        : null,
    };
  });

  return {
    maxSlots: user.industrialMaxSlots,
    maxCost: user.industrialMaxCost,
    usedSlots: facilities.length,
    usedCost,
    facilities,
    emergencyProductionOrderCount,
  };
}
