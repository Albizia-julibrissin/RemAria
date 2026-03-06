"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type AllocateCharacterStatsResult =
  | { success: true }
  | { success: false; error: string; message: string };

const BASE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

export async function allocateCharacterStats(input: {
  characterId: string;
  STR: number;
  INT: number;
  VIT: number;
  WIS: number;
  DEX: number;
  AGI: number;
  LUK: number;
}): Promise<AllocateCharacterStatsResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインし直してください。" };
  }

  const character = await prisma.character.findFirst({
    where: { id: input.characterId, userId: session.userId },
    select: { id: true, CAP: true, category: true },
  });
  if (!character) {
    return { success: false, error: "NOT_FOUND", message: "キャラが見つかりません。" };
  }

  if (character.category === "mech") {
    return {
      success: false,
      error: "FORBIDDEN",
      message: "メカはステータス割り振りの対象外です。",
    };
  }

  const cap = character.CAP;
  if (cap <= 0) {
    return { success: false, error: "VALIDATION", message: "CAP が不正です。" };
  }

  const values: Record<(typeof BASE_STAT_KEYS)[number], number> = {
    STR: Number(input.STR) || 0,
    INT: Number(input.INT) || 0,
    VIT: Number(input.VIT) || 0,
    WIS: Number(input.WIS) || 0,
    DEX: Number(input.DEX) || 0,
    AGI: Number(input.AGI) || 0,
    LUK: Number(input.LUK) || 0,
  };

  const sum = BASE_STAT_KEYS.reduce((acc, key) => acc + values[key], 0);
  if (sum !== cap) {
    return {
      success: false,
      error: "VALIDATION",
      message: `合計が CAP と一致してください（現在の合計: ${sum}, CAP: ${cap}）。`,
    };
  }

  const minPerStat = Math.floor(cap * 0.1);
  const maxPerStat = Math.floor(cap * 0.3);

  for (const key of BASE_STAT_KEYS) {
    const v = values[key];
    if (!Number.isInteger(v)) {
      return {
        success: false,
        error: "VALIDATION",
        message: "ステータス値は整数で入力してください。",
      };
    }
    if (v < minPerStat || v > maxPerStat) {
      return {
        success: false,
        error: "VALIDATION",
        message: `各ステータスは CAP の 10〜30% の範囲で入力してください。（${key}: ${v}, 許容範囲: ${minPerStat}〜${maxPerStat}）`,
      };
    }
  }

  await prisma.character.update({
    where: { id: character.id },
    data: values,
  });

  revalidatePath(`/dashboard/characters/${character.id}`);
  return { success: true };
}

