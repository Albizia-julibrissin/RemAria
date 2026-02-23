"use server";

// docs/019_production_receive.md - 生産判定・受け取り

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/** docs/019: 生産キャップは一律 24 時間分 */
const PRODUCTION_CAP_MINUTES = 1440;

export type ReceiveProductionResult =
  | { success: true; cycles: number; outputItemName: string; outputAmount: number }
  | { success: false; error: string; message: string };

/**
 * 設備インスタンスの生産物を受け取る。docs/019 に準拠。
 * 最終受け取り日時〜現在の経過（最大24h）でサイクル数を算出し、入力消費・出力付与・lastReceivedAt 更新をトランザクションで実行。
 * フォームからは facilityInstanceId を渡す。
 */
export async function receiveProduction(
  formData: FormData
): Promise<ReceiveProductionResult> {
  const facilityInstanceId = formData.get("facilityInstanceId");
  if (typeof facilityInstanceId !== "string" || !facilityInstanceId) {
    return { success: false, error: "INVALID_INPUT", message: "設備が指定されていません。" };
  }

  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const inst = await prisma.facilityInstance.findUnique({
    where: { id: facilityInstanceId },
    include: {
      user: { select: { id: true, createdAt: true } },
      placementArea: { select: { code: true } },
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

  if (!inst || inst.userId !== session.userId) {
    return { success: false, error: "NOT_FOUND", message: "設備が見つかりません。" };
  }

  const recipe = inst.facilityType.recipes[0] ?? null;
  if (!recipe) {
    return { success: false, error: "NO_RECIPE", message: "この設備にはレシピがありません。" };
  }

  const isInitialArea = inst.placementArea.code === "initial";
  const effectiveLastReceived = inst.lastReceivedAt ?? (isInitialArea ? inst.user.createdAt : inst.createdAt);
  const now = new Date();
  let elapsedMs = now.getTime() - effectiveLastReceived.getTime();
  if (elapsedMs < 0) elapsedMs = 0;
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  const cappedMinutes = Math.min(elapsedMinutes, PRODUCTION_CAP_MINUTES);
  let cyclesByTime = Math.floor(cappedMinutes / recipe.cycleMinutes);
  if (cyclesByTime < 0) cyclesByTime = 0;

  let cyclesToRun = cyclesByTime;

  if (recipe.inputs.length > 0) {
    const inventories = await prisma.userInventory.findMany({
      where: {
        userId: session.userId,
        itemId: { in: recipe.inputs.map((i) => i.itemId) },
      },
      select: { itemId: true, quantity: true },
    });
    const qtyByItemId = new Map(inventories.map((inv) => [inv.itemId, inv.quantity]));
    for (const input of recipe.inputs) {
      const have = qtyByItemId.get(input.itemId) ?? 0;
      const maxFromInput = Math.floor(have / input.amount);
      cyclesToRun = Math.min(cyclesToRun, maxFromInput);
    }
  }

  if (cyclesToRun === 0) {
    return {
      success: false,
      error: "NOTHING_TO_RECEIVE",
      message:
        recipe.inputs.length > 0
          ? "経過時間が足りないか、入力素材が不足しています。"
          : "まだ受け取り可能な生産がありません。（最大24時間分まで）",
    };
  }

  const nextLastReceived = new Date(
    effectiveLastReceived.getTime() + cyclesToRun * recipe.cycleMinutes * 60 * 1000
  );
  const outputTotal = recipe.outputAmount * cyclesToRun;

  await prisma.$transaction(async (tx) => {
    for (const input of recipe.inputs) {
      const consume = input.amount * cyclesToRun;
      const inv = await tx.userInventory.findUnique({
        where: { userId_itemId: { userId: session.userId, itemId: input.itemId } },
      });
      if (!inv || inv.quantity < consume) {
        throw new Error("在庫不足");
      }
      await tx.userInventory.update({
        where: { userId_itemId: { userId: session.userId, itemId: input.itemId } },
        data: { quantity: inv.quantity - consume },
      });
    }

    await tx.userInventory.upsert({
      where: {
        userId_itemId: { userId: session.userId, itemId: recipe.outputItemId },
      },
      create: {
        userId: session.userId,
        itemId: recipe.outputItemId,
        quantity: outputTotal,
      },
      update: { quantity: { increment: outputTotal } },
    });

    await tx.facilityInstance.update({
      where: { id: facilityInstanceId },
      data: { lastReceivedAt: nextLastReceived },
    });
  });

  revalidatePath("/dashboard/facilities");
  return {
    success: true,
    cycles: cyclesToRun,
    outputItemName: recipe.outputItem.name,
    outputAmount: outputTotal,
  };
}
