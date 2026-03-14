"use server";

// spec/075_market.md Phase 1 - 出品・購入・一覧・取下げ

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  MARKET_MIN_PRICE_PER_UNIT_GLOBAL,
  MARKET_MIN_QUANTITY_GLOBAL,
  MARKET_FEE_RATE,
  MARKET_LISTING_DEFAULT_DAYS,
  MARKET_MAX_LISTINGS_DEFAULT,
  MARKET_PRICE_HISTORY_LIMIT,
} from "@/lib/constants/market";
import {
  CURRENCY_REASON_MARKET_PURCHASE,
  CURRENCY_REASON_MARKET_SALE,
} from "@/lib/constants/currency-transaction-reasons";

function ensureMarketUnlocked(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { marketUnlocked: true },
  });
}

const now = () => new Date();

/** 期限切れ listing を検知し、在庫戻し・削除・履歴（expired）を 1 TX で実行。対象は itemId または userId で絞る。 */
async function expireExpiredListings(options: {
  itemId?: string;
  userId?: string;
}): Promise<void> {
  const expired = await prisma.marketListing.findMany({
    where: {
      expiresAt: { lte: now() },
      ...(options.itemId != null && { itemId: options.itemId }),
      ...(options.userId != null && { userId: options.userId }),
    },
    select: { id: true, userId: true, itemId: true, quantity: true, pricePerUnit: true },
  });
  if (expired.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const row of expired) {
      await tx.marketListingEvent.create({
        data: {
          userId: row.userId,
          kind: "expired",
          itemId: row.itemId,
          quantity: row.quantity,
          pricePerUnit: row.pricePerUnit,
        },
      });
      await tx.userInventory.upsert({
        where: { userId_itemId: { userId: row.userId, itemId: row.itemId } },
        create: { userId: row.userId, itemId: row.itemId, quantity: row.quantity },
        update: { quantity: { increment: row.quantity } },
      });
      await tx.marketListing.delete({ where: { id: row.id } });
    }
  });
}

export type ListMarketItemResult =
  | { success: true; listingId: string }
  | { success: false; error: string };

/**
 * 指定アイテムを指定数量・単価で出品する。在庫を減らし MarketListing に追加。
 */
export async function listMarketItem(
  itemId: string,
  quantity: number,
  pricePerUnit: number
): Promise<ListMarketItemResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }
  const userId = session.userId;

  const user = await ensureMarketUnlocked(userId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。開拓任務を進めると解放されます。" };
  }

  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(pricePerUnit) || pricePerUnit < 1) {
    return { success: false, error: "数量と単価は1以上の整数で指定してください。" };
  }

  const [item, inv] = await Promise.all([
    prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        marketListable: true,
        marketMinPricePerUnit: true,
        marketMinQuantity: true,
      },
    }),
    prisma.userInventory.findUnique({
      where: { userId_itemId: { userId, itemId } },
      select: { quantity: true },
    }),
  ]);

  if (!item) {
    return { success: false, error: "アイテムが見つかりません。" };
  }
  if (!item.marketListable) {
    return { success: false, error: "このアイテムは出品できません。" };
  }

  const currentQty = inv?.quantity ?? 0;
  if (currentQty < quantity) {
    return { success: false, error: "在庫が不足しています。" };
  }

  const minPrice = item.marketMinPricePerUnit ?? MARKET_MIN_PRICE_PER_UNIT_GLOBAL;
  const minQty = item.marketMinQuantity ?? MARKET_MIN_QUANTITY_GLOBAL;
  if (pricePerUnit < minPrice) {
    return { success: false, error: `単価は${minPrice}以上で指定してください。` };
  }
  if (quantity < minQty) {
    return { success: false, error: `数量は${minQty}以上で指定してください。` };
  }

  await expireExpiredListings({ userId });

  const validListingsCount = await prisma.marketListing.count({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
    },
  });
  if (validListingsCount >= MARKET_MAX_LISTINGS_DEFAULT) {
    return {
      success: false,
      error: `同時出品数は${MARKET_MAX_LISTINGS_DEFAULT}件までです。取り下げまたは成約・期限切れ後に再出品してください。`,
    };
  }

  const expiresAt = new Date(Date.now() + MARKET_LISTING_DEFAULT_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.userInventory.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, quantity: 0 },
      update: { quantity: { decrement: quantity } },
    });
    await tx.marketListing.create({
      data: {
        userId,
        itemId,
        quantity,
        pricePerUnit,
        expiresAt,
      },
    });
  });

  const listing = await prisma.marketListing.findFirst({
    where: { userId, itemId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return { success: true, listingId: listing!.id };
}

export type BuyFromMarketResult =
  | { success: true; quantity: number; totalCost: number; itemId: string }
  | { success: false; error: string };

/**
 * 指定アイテムを指定数量だけ購入。最安 listing から部分消化。1 TX。
 */
export async function buyFromMarket(
  itemId: string,
  quantity: number
): Promise<BuyFromMarketResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }
  const buyerUserId = session.userId;

  const user = await ensureMarketUnlocked(buyerUserId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。" };
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return { success: false, error: "購入数量は1以上で指定してください。" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, name: true, maxOwnedPerUser: true },
  });
  if (!item) {
    return { success: false, error: "アイテムが見つかりません。" };
  }

  await expireExpiredListings({ itemId });

  const nowVal = now();
  const result = await prisma.$transaction(async (tx) => {
    const listings = await tx.$queryRaw<
      { id: string; userId: string; itemId: string; quantity: number; pricePerUnit: number }[]
    >`
      SELECT id, "userId", "itemId", quantity, "pricePerUnit"
      FROM "MarketListing"
      WHERE "itemId" = ${itemId}
        AND ("expiresAt" IS NULL OR "expiresAt" > ${nowVal})
      ORDER BY "pricePerUnit" ASC, "createdAt" ASC
      LIMIT 100
      FOR UPDATE
    `;

    let remaining = quantity;
    let totalCost = 0;
    const fills: { listingId: string; sellerUserId: string; pricePerUnit: number; takeQty: number }[] = [];

    for (const row of listings) {
      if (remaining <= 0) break;
      const takeQty = Math.min(remaining, row.quantity);
      if (takeQty <= 0) continue;
      totalCost += row.pricePerUnit * takeQty;
      fills.push({
        listingId: row.id,
        sellerUserId: row.userId,
        pricePerUnit: row.pricePerUnit,
        takeQty,
      });
      remaining -= takeQty;
    }

    const fulfilled = quantity - remaining;
    if (fulfilled <= 0) {
      return { error: "指定数量を満たす出品がありません。" } as const;
    }

    const buyer = await tx.user.findUnique({
      where: { id: buyerUserId },
      select: { premiumCurrencyFreeBalance: true, premiumCurrencyPaidBalance: true },
    });
    const totalGra = buyer
      ? buyer.premiumCurrencyFreeBalance + buyer.premiumCurrencyPaidBalance
      : 0;
    if (!buyer || totalGra < totalCost) {
      return { error: "GRA が不足しています。" } as const;
    }

    const currentInv = await tx.userInventory.findUnique({
      where: { userId_itemId: { userId: buyerUserId, itemId } },
      select: { quantity: true },
    });
    const currentOwned = currentInv?.quantity ?? 0;
    const afterOwned = currentOwned + fulfilled;
    if (item.maxOwnedPerUser != null && afterOwned > item.maxOwnedPerUser) {
      return { error: `所持上限（${item.maxOwnedPerUser}）を超えるため購入できません。` } as const;
    }

    const fromFree = Math.min(totalCost, buyer.premiumCurrencyFreeBalance);
    const fromPaid = totalCost - fromFree;
    const beforeFree = buyer.premiumCurrencyFreeBalance;
    const beforePaid = buyer.premiumCurrencyPaidBalance;
    const afterFree = beforeFree - fromFree;
    const afterPaid = beforePaid - fromPaid;

    await tx.user.update({
      where: { id: buyerUserId },
      data: {
        premiumCurrencyFreeBalance: { decrement: fromFree },
        premiumCurrencyPaidBalance: { decrement: fromPaid },
      },
    });
    if (fromFree > 0) {
      await tx.currencyTransaction.create({
        data: {
          userId: buyerUserId,
          currencyType: "premium_free",
          amount: -fromFree,
          beforeBalance: beforeFree,
          afterBalance: afterFree,
          reason: CURRENCY_REASON_MARKET_PURCHASE,
          referenceType: "user",
          referenceId: buyerUserId,
        },
      });
    }
    if (fromPaid > 0) {
      await tx.currencyTransaction.create({
        data: {
          userId: buyerUserId,
          currencyType: "premium_paid",
          amount: -fromPaid,
          beforeBalance: beforePaid,
          afterBalance: afterPaid,
          reason: CURRENCY_REASON_MARKET_PURCHASE,
          referenceType: "user",
          referenceId: buyerUserId,
        },
      });
    }

    const sellerCredits: Record<string, number> = {};
    for (const f of fills) {
      const gross = f.pricePerUnit * f.takeQty;
      const fee = Math.floor(gross * MARKET_FEE_RATE);
      const net = gross - fee;
      sellerCredits[f.sellerUserId] = (sellerCredits[f.sellerUserId] ?? 0) + net;

      const listing = await tx.marketListing.findUnique({
        where: { id: f.listingId },
        select: { quantity: true },
      });
      if (!listing) continue;
      const newQty = listing.quantity - f.takeQty;
      if (newQty <= 0) {
        await tx.marketListing.delete({ where: { id: f.listingId } });
      } else {
        await tx.marketListing.update({
          where: { id: f.listingId },
          data: { quantity: newQty },
        });
      }

      await tx.marketTransaction.create({
        data: {
          itemId,
          pricePerUnit: f.pricePerUnit,
          quantity: f.takeQty,
          buyerUserId,
          sellerUserId: f.sellerUserId,
        },
      });
    }

    const sellerIds = Object.keys(sellerCredits);
    const sellerRows =
      sellerIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, premiumCurrencyFreeBalance: true },
          })
        : [];
    const sellerBalanceBefore = new Map(
      sellerRows.map((r) => [r.id, r.premiumCurrencyFreeBalance])
    );

    for (const [sellerId, amount] of Object.entries(sellerCredits)) {
      const beforeBalance = sellerBalanceBefore.get(sellerId) ?? 0;
      const afterBalance = beforeBalance + amount;
      await tx.user.update({
        where: { id: sellerId },
        data: { premiumCurrencyFreeBalance: { increment: amount } },
      });
      await tx.currencyTransaction.create({
        data: {
          userId: sellerId,
          currencyType: "premium_free",
          amount,
          beforeBalance,
          afterBalance,
          reason: CURRENCY_REASON_MARKET_SALE,
          referenceType: "user",
          referenceId: sellerId,
        },
      });
    }

    await tx.userInventory.upsert({
      where: { userId_itemId: { userId: buyerUserId, itemId } },
      create: { userId: buyerUserId, itemId, quantity: fulfilled },
      update: { quantity: { increment: fulfilled } },
    });

    return {
      quantity: fulfilled,
      totalCost,
      itemId,
    } as const;
  });

  if ("error" in result) {
    return { success: false, error: result.error };
  }
  return {
    success: true,
    quantity: result.quantity,
    totalCost: result.totalCost,
    itemId: result.itemId,
  };
}

export type CancelMarketListingResult =
  | { success: true }
  | { success: false; error: string };

/**
 * 指定 listing を取り下げ、在庫を出品者に戻す。
 */
export async function cancelMarketListing(listingId: string): Promise<CancelMarketListingResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }
  const userId = session.userId;

  const user = await ensureMarketUnlocked(userId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。" };
  }

  const listing = await prisma.marketListing.findUnique({
    where: { id: listingId },
    select: { id: true, userId: true, itemId: true, quantity: true, pricePerUnit: true },
  });

  if (!listing) {
    return { success: false, error: "出品が見つかりません。" };
  }
  if (listing.userId !== userId) {
    return { success: false, error: "他人の出品は取り下げできません。" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.marketListingEvent.create({
      data: {
        userId: listing.userId,
        kind: "cancelled",
        itemId: listing.itemId,
        quantity: listing.quantity,
        pricePerUnit: listing.pricePerUnit,
      },
    });
    await tx.userInventory.upsert({
      where: { userId_itemId: { userId: listing.userId, itemId: listing.itemId } },
      create: { userId: listing.userId, itemId: listing.itemId, quantity: listing.quantity },
      update: { quantity: { increment: listing.quantity } },
    });
    await tx.marketListing.delete({ where: { id: listingId } });
  });

  return { success: true };
}

export type MarketListEntry = {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  bestPricePerUnit: number;
  quantityAtBestPrice: number;
};

/**
 * 出品一覧。アイテムごとに最安単価とその単価で買える数量を返す。
 */
export async function getMarketList(itemIdFilter?: string): Promise<{
  success: false; error: string;
} | { success: true; entries: MarketListEntry[] }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }

  const user = await ensureMarketUnlocked(session.userId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。" };
  }

  await expireExpiredListings(itemIdFilter ? { itemId: itemIdFilter } : {});

  const validWhere = {
    OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
    ...(itemIdFilter != null && { itemId: itemIdFilter }),
  };
  const listings = await prisma.marketListing.findMany({
    where: validWhere,
    include: {
      item: { select: { id: true, code: true, name: true, category: true } },
    },
    orderBy: [{ itemId: "asc" }, { pricePerUnit: "asc" }, { createdAt: "asc" }],
  });

  const byItem = new Map<string, { bestPrice: number; totalQty: number; code: string; name: string; category: string }>();
  for (const row of listings) {
    const key = row.itemId;
    if (!byItem.has(key)) {
      byItem.set(key, {
        bestPrice: row.pricePerUnit,
        totalQty: row.quantity,
        code: row.item.code,
        name: row.item.name,
        category: row.item.category,
      });
    } else {
      const cur = byItem.get(key)!;
      if (row.pricePerUnit === cur.bestPrice) {
        cur.totalQty += row.quantity;
      }
    }
  }

  const entries: MarketListEntry[] = Array.from(byItem.entries()).map(([itemId, v]) => ({
    itemId,
    itemCode: v.code,
    itemName: v.name,
    category: v.category,
    bestPricePerUnit: v.bestPrice,
    quantityAtBestPrice: v.totalQty,
  }));

  return { success: true, entries };
}

export type MarketItemPriceTier = {
  pricePerUnit: number;
  quantity: number;
};

export type MarketItemListingsResult = {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  priceTiers: MarketItemPriceTier[];
  totalAvailable: number;
};

/**
 * 指定アイテムの出品を単価ごとに集計（最安順）。購入詳細モーダル用。
 */
export async function getMarketItemListings(itemId: string): Promise<{
  success: false;
  error: string;
} | { success: true; data: MarketItemListingsResult }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }

  const user = await ensureMarketUnlocked(session.userId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。" };
  }

  await expireExpiredListings({ itemId });

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, code: true, name: true, category: true },
  });
  if (!item) {
    return { success: false, error: "アイテムが見つかりません。" };
  }

  const validWhere = {
    itemId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
  };
  const rows = await prisma.marketListing.findMany({
    where: validWhere,
    select: { pricePerUnit: true, quantity: true },
    orderBy: [{ pricePerUnit: "asc" }, { createdAt: "asc" }],
  });

  const byPrice = new Map<number, number>();
  for (const r of rows) {
    byPrice.set(r.pricePerUnit, (byPrice.get(r.pricePerUnit) ?? 0) + r.quantity);
  }
  const priceTiers: MarketItemPriceTier[] = Array.from(byPrice.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pricePerUnit, quantity]) => ({ pricePerUnit, quantity }));
  const totalAvailable = priceTiers.reduce((s, t) => s + t.quantity, 0);

  return {
    success: true,
    data: {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category,
      priceTiers,
      totalAvailable,
    },
  };
}

export type MyListingRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  pricePerUnit: number;
  createdAt: Date;
  expiresAt: Date | null;
};

/**
 * 当該ユーザーの現在出品中一覧。
 */
export async function getMyListings(): Promise<{
  success: false; error: string;
} | { success: true; listings: MyListingRow[] }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }

  const user = await ensureMarketUnlocked(session.userId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。" };
  }

  await expireExpiredListings({ userId: session.userId });

  const validWhere = {
    userId: session.userId,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
  };
  const rows = await prisma.marketListing.findMany({
    where: validWhere,
    include: { item: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const listings: MyListingRow[] = rows.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    itemCode: r.item.code,
    itemName: r.item.name,
    quantity: r.quantity,
    pricePerUnit: r.pricePerUnit,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  }));

  return { success: true, listings };
}

/**
 * 市場解放済みか。ダッシュボードの市場ボタン表示用。
 */
export async function getMarketUnlocked(): Promise<boolean> {
  const session = await getSession();
  if (!session?.userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { marketUnlocked: true },
  });
  return user?.marketUnlocked ?? false;
}

export type MarketUserHistoryEntry = {
  kind: "bought" | "sold" | "cancelled" | "expired";
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  pricePerUnit: number;
  createdAt: Date;
};

const MARKET_USER_HISTORY_LIMIT = 100;

export type MarketPriceHistory = {
  itemId: string;
  count: number;
  avg: number;
  median: number;
  min: number;
  max: number;
};

/**
 * 指定アイテムの直近成約から価格統計（AVG / MEDIAN / MIN / MAX）を返す。
 */
export async function getMarketPriceHistory(itemId: string): Promise<{
  success: false;
  error: string;
} | { success: true; data: MarketPriceHistory | null }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }

  const user = await ensureMarketUnlocked(session.userId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。" };
  }

  const rows = await prisma.marketTransaction.findMany({
    where: { itemId },
    select: { pricePerUnit: true },
    orderBy: { createdAt: "desc" },
    take: MARKET_PRICE_HISTORY_LIMIT,
  });

  if (rows.length === 0) {
    return { success: true, data: null };
  }

  const prices = rows.map((r) => r.pricePerUnit).sort((a, b) => a - b);
  const sum = prices.reduce((s, p) => s + p, 0);
  const avg = Math.round(sum / prices.length);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 1 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2);
  const min = prices[0]!;
  const max = prices[prices.length - 1]!;

  return {
    success: true,
    data: { itemId, count: prices.length, avg, median, min, max },
  };
}

/**
 * 当該ユーザーの市場履歴（成約・手動取り下げ・期限切れ自動取下げ）を createdAt 降順で返す。
 */
export async function getMarketUserHistory(): Promise<{
  success: false;
  error: string;
} | { success: true; entries: MarketUserHistoryEntry[] }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }

  const user = await ensureMarketUnlocked(session.userId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。" };
  }

  const userId = session.userId;

  const [txRows, eventRows] = await Promise.all([
    prisma.marketTransaction.findMany({
      where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
      include: { item: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: MARKET_USER_HISTORY_LIMIT,
    }),
    prisma.marketListingEvent.findMany({
      where: { userId },
      include: { item: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: MARKET_USER_HISTORY_LIMIT,
    }),
  ]);

  const fromTx: MarketUserHistoryEntry[] = txRows.map((r) => ({
    kind: r.buyerUserId === userId ? "bought" : "sold",
    itemId: r.itemId,
    itemCode: r.item.code,
    itemName: r.item.name,
    quantity: r.quantity,
    pricePerUnit: r.pricePerUnit,
    createdAt: r.createdAt,
  }));

  const fromEvents: MarketUserHistoryEntry[] = eventRows.map((r) => ({
    kind: r.kind === "cancelled" ? "cancelled" : "expired",
    itemId: r.itemId,
    itemCode: r.item.code,
    itemName: r.item.name,
    quantity: r.quantity,
    pricePerUnit: r.pricePerUnit,
    createdAt: r.createdAt,
  }));

  const merged = [...fromTx, ...fromEvents].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const entries = merged.slice(0, MARKET_USER_HISTORY_LIMIT);

  return { success: true, entries };
}

export type MarketListableStack = {
  itemId: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  minPricePerUnit: number;
  minQuantity: number;
};

/**
 * 出品画面用：出品可能（marketListable）な所持アイテム一覧。
 */
export async function getMarketListableInventory(): Promise<{
  success: false; error: string;
} | { success: true; items: MarketListableStack[] }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }
  const user = await ensureMarketUnlocked(session.userId);
  if (!user?.marketUnlocked) {
    return { success: false, error: "市場はまだ利用できません。" };
  }

  const rows = await prisma.userInventory.findMany({
    where: {
      userId: session.userId,
      quantity: { gt: 0 },
      item: { marketListable: true },
    },
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          marketMinPricePerUnit: true,
          marketMinQuantity: true,
        },
      },
    },
    orderBy: { item: { code: "asc" } },
  });

  const items: MarketListableStack[] = rows.map((r) => ({
    itemId: r.item.id,
    code: r.item.code,
    name: r.item.name,
    category: r.item.category,
    quantity: r.quantity,
    minPricePerUnit: r.item.marketMinPricePerUnit ?? MARKET_MIN_PRICE_PER_UNIT_GLOBAL,
    minQuantity: r.item.marketMinQuantity ?? MARKET_MIN_QUANTITY_GLOBAL,
  }));

  return { success: true, items };
}
