"use server";

// spec/045 - アイテム・所持・バッグ

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type StackableItem = {
  itemId: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  /** 探索1回あたりの持ち込み上限。null は対象外。spec/049 */
  maxCarryPerExpedition: number | null;
};

export type EquipmentInstanceSummary = {
  id: string;
  equipmentTypeId: string;
  equipmentTypeName: string;
  slot: string;
  statsSummary?: string;
};

export type MechaPartInstanceSummary = {
  id: string;
  mechaPartTypeId: string;
  mechaPartTypeName: string;
  slot: string;
  statsSummary?: string;
};

export type GetInventoryResult = {
  stackable: StackableItem[];
  equipmentInstances: EquipmentInstanceSummary[];
  mechaPartInstances: MechaPartInstanceSummary[];
};

/**
 * ユーザーの所持一覧を種別ごとに取得。バッグ画面のタブ表示用。spec/045。
 * category を指定した場合はスタック型のみその category に絞る（オプション）。
 */
export async function getInventory(
  categoryFilter?: string
): Promise<GetInventoryResult | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const userId = session.userId;

  const [inventoryRows, equipmentInstances, mechaPartInstances] =
    await Promise.all([
      prisma.userInventory.findMany({
        where: {
          userId,
          ...(categoryFilter ? { item: { category: categoryFilter } } : {}),
          quantity: { gt: 0 },
        },
        include: { item: { select: { code: true, name: true, category: true, maxCarryPerExpedition: true } } },
        orderBy: { item: { code: "asc" } },
      }),
      prisma.equipmentInstance.findMany({
        where: { userId },
        include: {
          equipmentType: { select: { name: true, slot: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.mechaPartInstance.findMany({
        where: { userId },
        include: {
          mechaPartType: { select: { name: true, slot: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const stackable: StackableItem[] = inventoryRows.map((row) => ({
    itemId: row.itemId,
    code: row.item.code,
    name: row.item.name,
    category: row.item.category,
    quantity: row.quantity,
    maxCarryPerExpedition: row.item.maxCarryPerExpedition ?? null,
  }));

  const equipmentSummaries: EquipmentInstanceSummary[] =
    equipmentInstances.map((ei) => ({
      id: ei.id,
      equipmentTypeId: ei.equipmentTypeId,
      equipmentTypeName: ei.equipmentType.name,
      slot: ei.equipmentType.slot,
      statsSummary: ei.stats
        ? JSON.stringify(ei.stats).slice(0, 80)
        : undefined,
    }));

  const mechaSummaries: MechaPartInstanceSummary[] = mechaPartInstances.map(
    (mp) => ({
      id: mp.id,
      mechaPartTypeId: mp.mechaPartTypeId,
      mechaPartTypeName: mp.mechaPartType.name,
      slot: mp.mechaPartType.slot,
      statsSummary: mp.stats ? JSON.stringify(mp.stats).slice(0, 80) : undefined,
    })
  );

  return {
    stackable,
    equipmentInstances: equipmentSummaries,
    mechaPartInstances: mechaSummaries,
  };
}
