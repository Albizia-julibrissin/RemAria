"use server";

// 倉庫：所持アイテム一覧取得

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type WarehouseItem = {
  itemId: string;
  itemName: string;
  quantity: number;
};

/** ログインユーザーの倉庫（所持数）を返す。全 Item マスタを基準に、所持数が 0 のものも含める。 */
export async function getWarehouse(): Promise<WarehouseItem[] | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const [items, inventories] = await Promise.all([
    prisma.item.findMany({ select: { id: true, name: true }, orderBy: { code: "asc" } }),
    prisma.userInventory.findMany({
      where: { userId: session.userId },
      select: { itemId: true, quantity: true },
    }),
  ]);

  const qtyByItemId = new Map(inventories.map((i) => [i.itemId, i.quantity]));
  return items.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    quantity: qtyByItemId.get(item.id) ?? 0,
  }));
}
