"use server";

// spec/083 - 緊急製造指示書を1枚消費し、全設備の lastProducedAt を2時間前に更新。docs/065 §7, docs/081

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  EMERGENCY_PRODUCTION_ACCELERATION_MINUTES,
  EMERGENCY_PRODUCTION_ORDER_ITEM_CODE,
} from "@/lib/constants/production";
import { ITEM_USAGE_REASON_FACILITY_SPEED } from "@/lib/constants/item-usage-reasons";

export type UseEmergencyProductionOrderResult =
  | { success: true; message: string }
  | { success: false; error: string; message: string };

/**
 * 緊急製造指示書を1枚消費し、設置済み全設備の lastProducedAt を2時間前に更新。spec/083。
 * （名前は React Hook と誤認されないよう use で始めない）
 */
export async function executeEmergencyProductionOrder(): Promise<UseEmergencyProductionOrderResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const userId = session.userId;

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({
        where: { code: EMERGENCY_PRODUCTION_ORDER_ITEM_CODE },
        select: { id: true },
      });
      if (!item) throw new Error("ITEM_NOT_FOUND");

      const inv = await tx.userInventory.findUnique({
        where: { userId_itemId: { userId, itemId: item.id } },
        select: { quantity: true },
      });
      const qty = inv?.quantity ?? 0;
      if (qty < 1) throw new Error("NO_ITEM");

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      });
      if (!user) throw new Error("USER_NOT_FOUND");

      const instances = await tx.facilityInstance.findMany({
        where: { userId },
        orderBy: { id: "asc" },
        select: { id: true, lastProducedAt: true, isForced: true, createdAt: true },
      });

      const accelerationMs = EMERGENCY_PRODUCTION_ACCELERATION_MINUTES * 60 * 1000;
      for (const inst of instances) {
        const effectiveStart =
          inst.lastProducedAt ?? (inst.isForced ? user.createdAt : inst.createdAt);
        const newLastProducedAt = new Date(effectiveStart.getTime() - accelerationMs);
        await tx.facilityInstance.update({
          where: { id: inst.id },
          data: { lastProducedAt: newLastProducedAt },
        });
      }

      await tx.userInventory.update({
        where: { userId_itemId: { userId, itemId: item.id } },
        data: { quantity: { decrement: 1 } },
      });

      await tx.itemUsageLog.create({
        data: {
          userId,
          itemId: item.id,
          quantity: 1,
          reason: ITEM_USAGE_REASON_FACILITY_SPEED,
          referenceType: "all_facilities",
          referenceId: null,
        },
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "処理に失敗しました。";
    if (msg === "ITEM_NOT_FOUND") {
      return { success: false, error: "CONFIG", message: "緊急製造指示書のマスタが登録されていません。" };
    }
    if (msg === "NO_ITEM") {
      return { success: false, error: "NO_ITEM", message: "緊急製造指示書を所持していません。" };
    }
    if (msg === "USER_NOT_FOUND") {
      return { success: false, error: "NOT_FOUND", message: "ユーザーが見つかりません。" };
    }
    return { success: false, error: "UNKNOWN", message: msg };
  }

  revalidatePath("/dashboard/facilities");
  return { success: true, message: "全設備の生産が2時間分進みました。" };
}
