"use server";

/**
 * 経験値付与（spec/048 §8, spec/074 レベルキャップ・キャップ超過時アイテム付与）
 * 探索・クエスト等から共通で呼ぶ。メカはスキップする。
 */

import type { PrismaClient } from "@prisma/client";
import {
  EXP_PER_LEVEL_AT_CAP,
  LEVEL_CAP,
  LEVEL_CAP_REWARD_ITEM_CODE,
} from "@/lib/constants/level";
import {
  computeLevelFromTotalExp,
  computeNewStatsForLevelUp,
  getCapForLevel,
  getRequiredExpForLevel,
  type Stats,
} from "@/lib/level";
import { prisma } from "@/lib/db/prisma";
import { grantStackableItem } from "@/server/lib/inventory";

const STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

/**
 * 指定キャラに経験値を付与する。
 * レベルは LEVEL_CAP で打ち止め（spec/074）。キャップ到達後は超過分を振り直しアイテムに変換して付与する。
 * @param tx - 既存トランザクション内で呼ぶ場合は渡す。省略時は単体で実行する。
 */
export async function grantCharacterExp(
  userId: string,
  characterIds: string[],
  amount: number,
  tx?: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<void> {
  const db = tx ?? prisma;
  if (amount <= 0 || characterIds.length === 0) return;

  const characters = await db.character.findMany({
    where: { id: { in: characterIds }, userId },
    select: {
      id: true,
      category: true,
      experiencePoints: true,
      level: true,
      CAP: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
    },
  });

  const requiredForCap = getRequiredExpForLevel(LEVEL_CAP);
  const capRewardItem = await db.item.findUnique({
    where: { code: LEVEL_CAP_REWARD_ITEM_CODE },
    select: { id: true },
  });

  for (const c of characters) {
    if (c.category === "mech") continue;

    const newExp = (c.experiencePoints ?? 0) + amount;
    const newLevel = computeLevelFromTotalExp(newExp);
    const effectiveNewLevel = Math.min(newLevel, LEVEL_CAP);
    const oldLevel = c.level;
    const oldCap = c.CAP;

    if (effectiveNewLevel > oldLevel) {
      // レベルアップ（キャップまで）
      const newCap = getCapForLevel(effectiveNewLevel);
      const oldStats: Stats = {
        STR: c.STR,
        INT: c.INT,
        VIT: c.VIT,
        WIS: c.WIS,
        DEX: c.DEX,
        AGI: c.AGI,
        LUK: c.LUK,
      };
      const newStats = computeNewStatsForLevelUp(oldStats, oldCap, newCap);

      let experiencePointsAfter = newExp;
      let itemsToGrant = 0;

      if (newLevel > LEVEL_CAP) {
        // キャップ超過分をアイテムに変換（余りは保持しない）
        const overflow = newExp - requiredForCap;
        itemsToGrant = Math.floor(overflow / EXP_PER_LEVEL_AT_CAP);
        experiencePointsAfter = requiredForCap;
      }

      await db.character.update({
        where: { id: c.id },
        data: {
          experiencePoints: experiencePointsAfter,
          level: effectiveNewLevel,
          CAP: newCap,
          ...Object.fromEntries(STAT_KEYS.map((k) => [k, newStats[k]])),
        },
      });

      if (itemsToGrant > 0 && capRewardItem) {
        await grantStackableItem(db, {
          userId,
          itemId: capRewardItem.id,
          delta: itemsToGrant,
        });
      }
    } else if (oldLevel === LEVEL_CAP && newExp > requiredForCap) {
      // すでにキャップにいる場合の超過分→アイテム
      const overflow = newExp - requiredForCap;
      const itemsToGrant = Math.floor(overflow / EXP_PER_LEVEL_AT_CAP);

      await db.character.update({
        where: { id: c.id },
        data: { experiencePoints: requiredForCap },
      });

      if (itemsToGrant > 0 && capRewardItem) {
        await grantStackableItem(db, {
          userId,
          itemId: capRewardItem.id,
          delta: itemsToGrant,
        });
      }
    } else {
      await db.character.update({
        where: { id: c.id },
        data: { experiencePoints: newExp },
      });
    }
  }
}
