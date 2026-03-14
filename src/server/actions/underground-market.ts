"use server";

// docs/079 - 闇市・黒市（GRA でシステムから特別アイテムを購入）

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { grantStackableItem } from "@/server/lib/inventory";
import {
  CURRENCY_REASON_UNDERGROUND_MARKET_PURCHASE,
  CURRENCY_REASON_BLACK_MARKET_PURCHASE,
} from "@/lib/constants/currency-transaction-reasons";

export type SystemShopRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  priceGRA: number;
  displayOrder: number;
};

export type GetSystemShopResult =
  | { success: true; items: SystemShopRow[]; freeBalance: number; paidBalance: number }
  | { success: false; error: string };

/** 闇市(marketType=underground) または 黒市(black) の販売一覧とユーザーGRA残高。特別カテゴリのアイテムのみ。 */
export async function getSystemShopItems(
  marketType: "underground" | "black"
): Promise<GetSystemShopResult> {
  const session = await getSession();
  if (!session?.userId) return { success: false, error: "UNAUTHORIZED" };

  const [items, user] = await Promise.all([
    prisma.systemShopItem.findMany({
      where: { marketType },
      include: { item: { select: { id: true, code: true, name: true, category: true } } },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { premiumCurrencyFreeBalance: true, premiumCurrencyPaidBalance: true },
    }),
  ]);

  if (!user) return { success: false, error: "USER_NOT_FOUND" };

  const rows: SystemShopRow[] = items
    .filter((row) => row.item.category === "special")
    .map((row) => ({
      id: row.id,
      itemId: row.itemId,
      itemCode: row.item.code,
      itemName: row.item.name,
      priceGRA: row.priceGRA,
      displayOrder: row.displayOrder,
    }));

  return {
    success: true,
    items: rows,
    freeBalance: user.premiumCurrencyFreeBalance,
    paidBalance: user.premiumCurrencyPaidBalance,
  };
}

export type PurchaseFromSystemShopResult =
  | { success: true }
  | { success: false; error: string; message: string };

/** 闇市・黒市でアイテムを購入。闇市=無償を先に消費し足りなければ有償も使用（市場と同じ）。黒市=有償GRAのみ。docs/079 */
export async function purchaseFromSystemShop(
  systemShopItemId: string,
  quantity: number
): Promise<PurchaseFromSystemShopResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { success: false, error: "INVALID_QUANTITY", message: "数量は1以上で指定してください。" };
  }

  const shopItem = await prisma.systemShopItem.findUnique({
    where: { id: systemShopItemId },
    include: { item: { select: { id: true, category: true, name: true } } },
  });
  if (!shopItem) {
    return { success: false, error: "NOT_FOUND", message: "販売品が見つかりません。" };
  }
  if (shopItem.item.category !== "special") {
    return { success: false, error: "INVALID_ITEM", message: "この品目は取り扱い対象外です。" };
  }

  const totalCost = shopItem.priceGRA * quantity;
  const userId = session.userId;

  if (shopItem.marketType === "underground") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        premiumCurrencyFreeBalance: true,
        premiumCurrencyPaidBalance: true,
      },
    });
    const totalGra = (user?.premiumCurrencyFreeBalance ?? 0) + (user?.premiumCurrencyPaidBalance ?? 0);
    if (!user || totalGra < totalCost) {
      const short = totalCost - totalGra;
      return {
        success: false,
        error: "INSUFFICIENT_GRA",
        message: `GRAが足りません（あと ${short} 必要）。`,
      };
    }
    const fromFree = Math.min(totalCost, user.premiumCurrencyFreeBalance);
    const fromPaid = totalCost - fromFree;
    const beforeFree = user.premiumCurrencyFreeBalance;
    const beforePaid = user.premiumCurrencyPaidBalance;
    const afterFree = beforeFree - fromFree;
    const afterPaid = beforePaid - fromPaid;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          premiumCurrencyFreeBalance: { decrement: fromFree },
          premiumCurrencyPaidBalance: { decrement: fromPaid },
        },
      });
      if (fromFree > 0) {
        await tx.currencyTransaction.create({
          data: {
            userId,
            currencyType: "premium_free",
            amount: -fromFree,
            beforeBalance: beforeFree,
            afterBalance: afterFree,
            reason: CURRENCY_REASON_UNDERGROUND_MARKET_PURCHASE,
            referenceType: "system_shop_item",
            referenceId: systemShopItemId,
          },
        });
      }
      if (fromPaid > 0) {
        await tx.currencyTransaction.create({
          data: {
            userId,
            currencyType: "premium_paid",
            amount: -fromPaid,
            beforeBalance: beforePaid,
            afterBalance: afterPaid,
            reason: CURRENCY_REASON_UNDERGROUND_MARKET_PURCHASE,
            referenceType: "system_shop_item",
            referenceId: systemShopItemId,
          },
        });
      }
      await grantStackableItem(tx, {
        userId,
        itemId: shopItem.itemId,
        delta: quantity,
      });
    });
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { premiumCurrencyPaidBalance: true },
    });
    if (!user || user.premiumCurrencyPaidBalance < totalCost) {
      const short = totalCost - (user?.premiumCurrencyPaidBalance ?? 0);
      return {
        success: false,
        error: "INSUFFICIENT_GRA",
        message: `有償GRAが足りません（あと ${short} 必要）。`,
      };
    }
    const beforePaid = user.premiumCurrencyPaidBalance;
    const afterPaid = beforePaid - totalCost;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { premiumCurrencyPaidBalance: { decrement: totalCost } },
      });
      await tx.currencyTransaction.create({
        data: {
          userId,
          currencyType: "premium_paid",
          amount: -totalCost,
          beforeBalance: beforePaid,
          afterBalance: afterPaid,
          reason: CURRENCY_REASON_BLACK_MARKET_PURCHASE,
          referenceType: "system_shop_item",
          referenceId: systemShopItemId,
        },
      });
      await grantStackableItem(tx, {
        userId,
        itemId: shopItem.itemId,
        delta: quantity,
      });
    });
  }

  revalidatePath("/dashboard/underground-market");
  revalidatePath("/dashboard");
  return { success: true };
}
