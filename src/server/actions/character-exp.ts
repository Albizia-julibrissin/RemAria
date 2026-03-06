"use server";

/**
 * 経験値付与（spec/048 §8, docs/048_experience_and_levelup）
 * 探索・クエスト等から共通で呼ぶ。メカはスキップする。
 */

import type { PrismaClient } from "@prisma/client";
import {
  computeLevelFromTotalExp,
  computeNewStatsForLevelUp,
  getCapForLevel,
  type Stats,
} from "@/lib/level";
import { prisma } from "@/lib/db/prisma";

const STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

/**
 * 指定キャラに経験値を付与し、レベルアップ時は CAP と 7 ステを 2.6 に従って更新する。
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

  for (const c of characters) {
    if (c.category === "mech") continue;

    const newExp = (c.experiencePoints ?? 0) + amount;
    const newLevel = computeLevelFromTotalExp(newExp);
    const oldLevel = c.level;
    const oldCap = c.CAP;

    if (newLevel > oldLevel) {
      const newCap = getCapForLevel(newLevel);
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

      await db.character.update({
        where: { id: c.id },
        data: {
          experiencePoints: newExp,
          level: newLevel,
          CAP: newCap,
          ...Object.fromEntries(STAT_KEYS.map((k) => [k, newStats[k]])),
        },
      });
    } else {
      await db.character.update({
        where: { id: c.id },
        data: { experiencePoints: newExp },
      });
    }
  }
}
