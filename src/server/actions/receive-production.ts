"use server";

// spec/036, docs/019 - 全設備一括受け取り
// spec/054: 受け取り時に item_received 任務進捗を加算

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PRODUCTION_CAP_MINUTES } from "@/lib/constants/production";
import { grantStackableItem } from "@/server/lib/inventory";
import { addQuestProgressItemReceived } from "@/server/actions/quest";

export type ReceiveProductionResult =
  | { success: true; received: { itemId: string; itemName: string; amount: number }[] }
  | { success: false; error: string; message: string };

/**
 * 全設備の生産を一括で受け取る。spec/036, docs/019。
 * スナップショット在庫で設備を id 昇順に処理し、作業用コピーから消費。在庫不足の設備は lastProducedAt を now に更新。
 */
export async function receiveProduction(): Promise<ReceiveProductionResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const userId = session.userId;
  const now = new Date();

  let received: { itemId: string; itemName: string; amount: number }[] = [];
  try {
    received = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const inventoryRows = await tx.userInventory.findMany({
      where: { userId },
      select: { itemId: true, quantity: true },
    });
    const workingCopy = new Map<string, number>();
    const initialSnapshot = new Map<string, number>();
    for (const row of inventoryRows) {
      workingCopy.set(row.itemId, row.quantity);
      initialSnapshot.set(row.itemId, row.quantity);
    }

    const instances = await tx.facilityInstance.findMany({
      where: { userId },
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

    const consumed = new Map<string, number>();
    const produced = new Map<string, { amount: number; itemName: string }>();

    for (const inst of instances) {
      const recipe = inst.facilityType.recipes[0] ?? null;
      if (!recipe) continue;

      let effectiveStart = inst.lastProducedAt ?? (inst.isForced ? user.createdAt : inst.createdAt);
      // 因果の矛盾防止: 受け取り開始時点で入力が1サイクル分も無かった設備は、今回の受け取りでは経過でサイクルを回さない（「今入った水で2時間分の浄水」を防ぐ）
      if (recipe.inputs.length > 0) {
        const hadEnoughInputAtStart = recipe.inputs.every(
          (input) => (initialSnapshot.get(input.itemId) ?? 0) >= input.amount
        );
        if (!hadEnoughInputAtStart) effectiveStart = now;
      }
      const elapsedMs = Math.max(0, now.getTime() - effectiveStart.getTime());
      const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
      const cappedMinutes = Math.min(elapsedMinutes, PRODUCTION_CAP_MINUTES);
      /** 経過を24hでキャップしたか。キャップした場合は貯まりを今回で使い切り、次回は now から積み上がるようにする（3日放置で3回受け取りにならないため） */
      const wasCapped = elapsedMinutes > PRODUCTION_CAP_MINUTES;
      let cyclesByTime = Math.floor(cappedMinutes / recipe.cycleMinutes);
      if (cyclesByTime < 0) cyclesByTime = 0;

      let cyclesToRun = cyclesByTime;
      if (recipe.inputs.length > 0) {
        for (const input of recipe.inputs) {
          const have = workingCopy.get(input.itemId) ?? 0;
          cyclesToRun = Math.min(cyclesToRun, Math.floor(have / input.amount));
        }
      }

      const timeBasedCycles = cyclesByTime;
      const nextLastProducedAt = wasCapped
        ? now
        : cyclesToRun < timeBasedCycles
          ? now
          : new Date(effectiveStart.getTime() + cyclesToRun * recipe.cycleMinutes * 60 * 1000);

      await tx.facilityInstance.update({
        where: { id: inst.id },
        data: { lastProducedAt: nextLastProducedAt },
      });

      if (cyclesToRun > 0) {
        for (const input of recipe.inputs) {
          const c = input.amount * cyclesToRun;
          consumed.set(input.itemId, (consumed.get(input.itemId) ?? 0) + c);
          const cur = workingCopy.get(input.itemId) ?? 0;
          workingCopy.set(input.itemId, cur - c);
        }
        const outAmt = recipe.outputAmount * cyclesToRun;
        const existing = produced.get(recipe.outputItemId);
        if (existing) {
          produced.set(recipe.outputItemId, { amount: existing.amount + outAmt, itemName: recipe.outputItem.name });
        } else {
          produced.set(recipe.outputItemId, { amount: outAmt, itemName: recipe.outputItem.name });
        }
        const curOut = workingCopy.get(recipe.outputItemId) ?? 0;
        workingCopy.set(recipe.outputItemId, curOut + outAmt);
      }
    }

    // 同一バッチ内で前の設備が生産した分を先に DB に載せるため、生産→消費の順で反映する（019/036）
    for (const [itemId, { amount }] of produced) {
      // Item.maxOwnedPerUser を考慮して付与量をクリップする
      await grantStackableItem(tx, { userId, itemId, delta: amount });
    }
    for (const [itemId, amount] of consumed) {
      const inv = await tx.userInventory.findUnique({
        where: { userId_itemId: { userId, itemId } },
      });
      if (!inv || inv.quantity < amount) throw new Error("在庫不足");
      await tx.userInventory.update({
        where: { userId_itemId: { userId, itemId } },
        data: { quantity: inv.quantity - amount },
      });
    }

    return Array.from(produced.entries()).map(([itemId, p]) => ({
      itemId,
      itemName: p.itemName,
      amount: p.amount,
    }));
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "受け取りに失敗しました。";
    if (msg === "USER_NOT_FOUND") {
      return { success: false, error: "NOT_FOUND", message: "ユーザーが見つかりません。" };
    }
    if (msg === "在庫不足") {
      return { success: false, error: "INVENTORY", message: "在庫が不足しています。" };
    }
    return { success: false, error: "UNKNOWN", message: msg };
  }

  revalidatePath("/dashboard/facilities");

  if (received.length === 0) {
    return {
      success: false,
      error: "NOTHING_TO_RECEIVE",
      message:
        "受け取り可能な生産がありません。（経過が足りないか、入力素材が不足しています。貯められるのは最大24時間分まで）",
    };
  }

  // spec/054: item_received 任務の進捗を加算
  for (const r of received) {
    await addQuestProgressItemReceived(userId, r.itemId, r.amount);
  }

  return { success: true, received };
}
