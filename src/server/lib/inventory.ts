import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

export type GrantStackableItemParams = {
  userId: string;
  itemId: string;
  delta: number;
  /** spec/090: true のとき Item.maxOwnedPerUser を無視して付与（郵便用） */
  ignoreLimit?: boolean;
};

/**
 * スタック型アイテムをユーザーに付与する共通ヘルパー。
 * - ignoreLimit が false または未指定: Item.maxOwnedPerUser（NULLなら上限なし）を考慮して付与量をクリップする。
 * - ignoreLimit が true: 上限を無視して delta をそのまま付与（郵便報酬用）。
 * - 実際に付与された個数（0 以上）を返す。
 */
export async function grantStackableItem(
  tx: TxClient,
  params: GrantStackableItemParams
): Promise<number> {
  const { userId, itemId, delta, ignoreLimit } = params;
  if (delta <= 0) return 0;

  if (ignoreLimit) {
    await tx.userInventory.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, quantity: delta },
      update: { quantity: { increment: delta } },
    });
    return delta;
  }

  const item = await tx.item.findUnique({
    where: { id: itemId },
    select: { maxOwnedPerUser: true },
  });
  const max = item?.maxOwnedPerUser ?? null;

  // 上限なしの場合は従来どおりインクリメント
  if (max == null) {
    await tx.userInventory.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, quantity: delta },
      update: { quantity: { increment: delta } },
    });
    return delta;
  }

  const existing = await tx.userInventory.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { quantity: true },
  });
  const current = existing?.quantity ?? 0;
  if (current >= max) {
    return 0;
  }

  const grant = Math.min(delta, max - current);
  if (grant <= 0) return 0;

  if (!existing) {
    await tx.userInventory.create({
      data: { userId, itemId, quantity: grant },
    });
  } else {
    await tx.userInventory.update({
      where: { userId_itemId: { userId, itemId } },
      data: { quantity: current + grant },
    });
  }

  return grant;
}

