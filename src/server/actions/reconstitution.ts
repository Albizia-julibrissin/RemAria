"use server";

/**
 * ステータス振り直し（spec/092）。部分再構築・完全再構築・完全再構築β。
 */

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  LEVEL_CAP_REWARD_ITEM_CODE,
  RECONSTITUTION_AMPOULE_BETA_ITEM_CODE,
  POINTS_PER_RECONSTITUTION_ITEM,
} from "@/lib/constants/level";
import { getRequiredExpForLevel, getCapForLevel } from "@/lib/level";
import {
  ITEM_USAGE_REASON_STAT_RECONSTITUTION_PARTIAL,
  ITEM_USAGE_REASON_STAT_RECONSTITUTION_FULL,
  ITEM_USAGE_REASON_STAT_RECONSTITUTION_FULL_BETA,
} from "@/lib/constants/item-usage-reasons";

const BASE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;
type StatKey = (typeof BASE_STAT_KEYS)[number];

export type ReconstitutionState = {
  cap: number;
  level: number;
  stats: Record<StatKey, number>;
  alphaCount: number;
  betaCount: number;
  maxRevertPoints: number;
  canPartial: boolean;
  canFull: boolean;
  canFullBeta: boolean;
  fullUnavailableReason?: "LEVEL_TOO_LOW" | "NO_ITEM";
};

export type ReconstitutionResult =
  | { success: true }
  | { success: false; error: string; message: string };

/** 再構築用の状態取得。メカまたは未所持の場合は null を返す。 */
export async function getReconstitutionState(
  characterId: string
): Promise<ReconstitutionState | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: {
      id: true,
      CAP: true,
      level: true,
      category: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
    },
  });
  if (!character || character.category === "mech") return null;

  const cap = character.CAP ?? 0;
  const level = character.level ?? 1;
  const stats: Record<StatKey, number> = {
    STR: character.STR,
    INT: character.INT,
    VIT: character.VIT,
    WIS: character.WIS,
    DEX: character.DEX,
    AGI: character.AGI,
    LUK: character.LUK,
  };
  const currentSum = BASE_STAT_KEYS.reduce((acc, k) => acc + stats[k], 0);
  const minPerStat = Math.floor(cap * 0.1);
  const maxRevertPoints = Math.max(0, currentSum - 7 * minPerStat);

  const items = await prisma.item.findMany({
    where: {
      code: { in: [LEVEL_CAP_REWARD_ITEM_CODE, RECONSTITUTION_AMPOULE_BETA_ITEM_CODE] },
    },
    select: { id: true, code: true },
  });
  const alphaItem = items.find((i) => i.code === LEVEL_CAP_REWARD_ITEM_CODE);
  const betaItem = items.find((i) => i.code === RECONSTITUTION_AMPOULE_BETA_ITEM_CODE);

  let alphaCount = 0;
  let betaCount = 0;
  if (alphaItem) {
    const inv = await prisma.userInventory.findUnique({
      where: { userId_itemId: { userId: session.userId, itemId: alphaItem.id } },
      select: { quantity: true },
    });
    alphaCount = inv?.quantity ?? 0;
  }
  if (betaItem) {
    const inv = await prisma.userInventory.findUnique({
      where: { userId_itemId: { userId: session.userId, itemId: betaItem.id } },
      select: { quantity: true },
    });
    betaCount = inv?.quantity ?? 0;
  }

  const canPartial = alphaCount >= 1 && maxRevertPoints >= POINTS_PER_RECONSTITUTION_ITEM;
  const canFull = level > 5 && alphaCount >= 1;
  const canFullBeta = betaCount >= 1;
  let fullUnavailableReason: "LEVEL_TOO_LOW" | "NO_ITEM" | undefined;
  if (level <= 5 && alphaCount >= 1) fullUnavailableReason = "LEVEL_TOO_LOW";
  else if (alphaCount < 1) fullUnavailableReason = "NO_ITEM";

  return {
    cap,
    level,
    stats,
    alphaCount,
    betaCount,
    maxRevertPoints,
    canPartial,
    canFull,
    canFullBeta,
    fullUnavailableReason,
  };
}

/** 完全再構築β（レベル・経験値そのまま、7ステを下限のみに）。spec/092 §5 */
export async function executeFullReconstitutionBeta(
  characterId: string
): Promise<ReconstitutionResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインし直してください。" };
  }

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: { id: true, CAP: true, category: true },
  });
  if (!character || character.category === "mech") {
    return { success: false, error: "NOT_FOUND", message: "キャラが見つかりません。" };
  }

  const cap = character.CAP ?? 0;
  const betaItem = await prisma.item.findUnique({
    where: { code: RECONSTITUTION_AMPOULE_BETA_ITEM_CODE },
    select: { id: true },
  });
  if (!betaItem) {
    return { success: false, error: "CONFIG", message: "再構築アンプルβのマスタが登録されていません。" };
  }

  const inv = await prisma.userInventory.findUnique({
    where: { userId_itemId: { userId: session.userId, itemId: betaItem.id } },
    select: { quantity: true },
  });
  const qty = inv?.quantity ?? 0;
  if (qty < 1) {
    return { success: false, error: "NO_ITEM", message: "再構築アンプルβを所持していません。" };
  }

  const minPerStat = Math.floor(cap * 0.1);
  const newStats = Object.fromEntries(
    BASE_STAT_KEYS.map((k) => [k, minPerStat])
  ) as Record<StatKey, number>;

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: newStats,
    });
    await tx.userInventory.update({
      where: { userId_itemId: { userId: session.userId!, itemId: betaItem.id } },
      data: { quantity: { decrement: 1 } },
    });
    await tx.itemUsageLog.create({
      data: {
        userId: session.userId!,
        itemId: betaItem.id,
        quantity: 1,
        reason: ITEM_USAGE_REASON_STAT_RECONSTITUTION_FULL_BETA,
        referenceType: "character",
        referenceId: character.id,
      },
    });
  });

  revalidatePath(`/dashboard/characters/${characterId}`);
  return { success: true };
}

/** 完全再構築（5レベルダウン＋ステ下限のみ）。spec/092 §4 */
export async function executeFullReconstitution(
  characterId: string
): Promise<ReconstitutionResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインし直してください。" };
  }

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: { id: true, level: true, CAP: true, category: true },
  });
  if (!character || character.category === "mech") {
    return { success: false, error: "NOT_FOUND", message: "キャラが見つかりません。" };
  }

  const level = character.level ?? 1;
  if (level <= 5) {
    return {
      success: false,
      error: "LEVEL_TOO_LOW",
      message: "身体への負担が大きく施術不可能です。",
    };
  }

  const alphaItem = await prisma.item.findUnique({
    where: { code: LEVEL_CAP_REWARD_ITEM_CODE },
    select: { id: true },
  });
  if (!alphaItem) {
    return { success: false, error: "CONFIG", message: "再構築アンプルαのマスタが登録されていません。" };
  }

  const inv = await prisma.userInventory.findUnique({
    where: { userId_itemId: { userId: session.userId, itemId: alphaItem.id } },
    select: { quantity: true },
  });
  if ((inv?.quantity ?? 0) < 1) {
    return { success: false, error: "NO_ITEM", message: "再構築アンプルαを所持していません。" };
  }

  const newLevel = level - 5;
  const newCap = getCapForLevel(newLevel);
  const minPerStat = Math.floor(newCap * 0.1);
  const newStats = Object.fromEntries(
    BASE_STAT_KEYS.map((k) => [k, minPerStat])
  ) as Record<StatKey, number>;

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: {
        level: newLevel,
        experiencePoints: getRequiredExpForLevel(newLevel),
        CAP: newCap,
        ...newStats,
      },
    });
    await tx.userInventory.update({
      where: { userId_itemId: { userId: session.userId!, itemId: alphaItem.id } },
      data: { quantity: { decrement: 1 } },
    });
    await tx.itemUsageLog.create({
      data: {
        userId: session.userId!,
        itemId: alphaItem.id,
        quantity: 1,
        reason: ITEM_USAGE_REASON_STAT_RECONSTITUTION_FULL,
        referenceType: "character",
        referenceId: character.id,
      },
    });
  });

  revalidatePath(`/dashboard/characters/${characterId}`);
  return { success: true };
}

/** 部分再構築（N個消費で N×18pt を各ステから減らす。減らした分は未割り振りになる）。spec/092 §3 */
export async function executePartialReconstitution(
  characterId: string,
  quantity: number,
  revertDeltas: Record<StatKey, number>
): Promise<ReconstitutionResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインし直してください。" };
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return { success: false, error: "VALIDATION", message: "使用個数は1以上で指定してください。" };
  }

  const requiredRevert = quantity * POINTS_PER_RECONSTITUTION_ITEM;

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: { id: true, CAP: true, category: true, STR: true, INT: true, VIT: true, WIS: true, DEX: true, AGI: true, LUK: true },
  });
  if (!character || character.category === "mech") {
    return { success: false, error: "NOT_FOUND", message: "キャラが見つかりません。" };
  }

  const cap = character.CAP ?? 0;
  const current: Record<StatKey, number> = {
    STR: character.STR,
    INT: character.INT,
    VIT: character.VIT,
    WIS: character.WIS,
    DEX: character.DEX,
    AGI: character.AGI,
    LUK: character.LUK,
  };
  const minPerStat = Math.floor(cap * 0.1);

  let revertSum = 0;
  for (const k of BASE_STAT_KEYS) {
    const r = Number(revertDeltas[k]);
    if (!Number.isInteger(r) || r < 0) {
      return { success: false, error: "VALIDATION", message: "減らす量は0以上の整数で入力してください。" };
    }
    if (current[k] - r < minPerStat) {
      return {
        success: false,
        error: "VALIDATION",
        message: `${k} の減らす量が多すぎます。（振り戻し後は各ステとも CAP の10%以上必要です）`,
      };
    }
    revertSum += r;
  }
  if (revertSum !== requiredRevert) {
    return {
      success: false,
      error: "VALIDATION",
      message: `減らす量の合計が振り戻し必要量と一致しません。（${quantity}個で合計 ${requiredRevert} 必要、現在 ${revertSum}）`,
    };
  }

  const alphaItem = await prisma.item.findUnique({
    where: { code: LEVEL_CAP_REWARD_ITEM_CODE },
    select: { id: true },
  });
  if (!alphaItem) {
    return { success: false, error: "CONFIG", message: "再構築アンプルαのマスタが登録されていません。" };
  }

  const inv = await prisma.userInventory.findUnique({
    where: { userId_itemId: { userId: session.userId, itemId: alphaItem.id } },
    select: { quantity: true },
  });
  if ((inv?.quantity ?? 0) < quantity) {
    return { success: false, error: "NO_ITEM", message: "再構築アンプルαが不足しています。" };
  }

  const statsData = Object.fromEntries(
    BASE_STAT_KEYS.map((k) => [k, current[k] - (Number(revertDeltas[k]) || 0)])
  );

  await prisma.$transaction(async (tx) => {
    await tx.character.update({
      where: { id: character.id },
      data: statsData,
    });
    await tx.userInventory.update({
      where: { userId_itemId: { userId: session.userId!, itemId: alphaItem.id } },
      data: { quantity: { decrement: quantity } },
    });
    await tx.itemUsageLog.create({
      data: {
        userId: session.userId!,
        itemId: alphaItem.id,
        quantity,
        reason: ITEM_USAGE_REASON_STAT_RECONSTITUTION_PARTIAL,
        referenceType: "character",
        referenceId: character.id,
      },
    });
  });

  revalidatePath(`/dashboard/characters/${characterId}`);
  return { success: true };
}
