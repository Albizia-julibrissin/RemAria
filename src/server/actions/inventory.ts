"use server";

// spec/045 - アイテム・所持・バッグ
// spec/052 - スキル分析書の消費・習得/レベルアップ

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type ConsumeSkillBookResult =
  | { success: true; newLevel: number }
  | { success: false; error: string };

export type StackableItem = {
  itemId: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  /** 探索1回あたりの持ち込み上限。null は対象外。spec/049 */
  maxCarryPerExpedition: number | null;
};

export type EquipmentInstanceSummary = {
  id: string;
  equipmentTypeId: string;
  equipmentTypeName: string;
  slot: string;
  statsSummary?: string;
};

export type MechaPartInstanceSummary = {
  id: string;
  mechaPartTypeId: string;
  mechaPartTypeName: string;
  slot: string;
  statsSummary?: string;
};

export type GetInventoryResult = {
  stackable: StackableItem[];
  equipmentInstances: EquipmentInstanceSummary[];
  mechaPartInstances: MechaPartInstanceSummary[];
};

/**
 * ユーザーの所持一覧を種別ごとに取得。バッグ画面のタブ表示用。spec/045。
 * category を指定した場合はスタック型のみその category に絞る（オプション）。
 */
export async function getInventory(
  categoryFilter?: string
): Promise<GetInventoryResult | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const userId = session.userId;

  const [inventoryRows, equipmentInstances, mechaPartInstances] =
    await Promise.all([
      prisma.userInventory.findMany({
        where: {
          userId,
          ...(categoryFilter ? { item: { category: categoryFilter } } : {}),
          quantity: { gt: 0 },
        },
        include: { item: { select: { code: true, name: true, category: true, maxCarryPerExpedition: true } } },
        orderBy: { item: { code: "asc" } },
      }),
      prisma.equipmentInstance.findMany({
        where: { userId },
        include: {
          equipmentType: { select: { name: true, slot: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.mechaPartInstance.findMany({
        where: { userId },
        include: {
          mechaPartType: { select: { name: true, slot: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const stackable: StackableItem[] = inventoryRows.map((row) => ({
    itemId: row.itemId,
    code: row.item.code,
    name: row.item.name,
    category: row.item.category,
    quantity: row.quantity,
    maxCarryPerExpedition: row.item.maxCarryPerExpedition ?? null,
  }));

  const equipmentSummaries: EquipmentInstanceSummary[] =
    equipmentInstances.map((ei) => ({
      id: ei.id,
      equipmentTypeId: ei.equipmentTypeId,
      equipmentTypeName: ei.equipmentType.name,
      slot: ei.equipmentType.slot,
      statsSummary: ei.stats
        ? JSON.stringify(ei.stats).slice(0, 80)
        : undefined,
    }));

  const mechaSummaries: MechaPartInstanceSummary[] = mechaPartInstances.map(
    (mp) => ({
      id: mp.id,
      mechaPartTypeId: mp.mechaPartTypeId,
      mechaPartTypeName: mp.mechaPartType.name,
      slot: mp.mechaPartType.slot,
      statsSummary: mp.stats ? JSON.stringify(mp.stats).slice(0, 80) : undefined,
    })
  );

  return {
    stackable,
    equipmentInstances: equipmentSummaries,
    mechaPartInstances: mechaSummaries,
  };
}

/**
 * スキル分析書を消費し、指定キャラに習得またはレベルアップする。spec/052。
 * 未習得時は1冊で習得（Lv0）。習得済み時は (現在Lv+1) 冊で Lv+1 に上げる。
 */
export async function consumeSkillBook(
  itemId: string,
  characterId: string
): Promise<ConsumeSkillBookResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }
  const userId = session.userId;

  const [item, character, inv] = await Promise.all([
    prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, category: true, skillId: true },
    }),
    prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, userId: true, category: true },
    }),
    prisma.userInventory.findUnique({
      where: { userId_itemId: { userId, itemId } },
      select: { quantity: true },
    }),
  ]);

  if (!item || item.category !== "skill_book" || !item.skillId) {
    return { success: false, error: "スキル分析書ではありません。" };
  }
  if (!character || character.userId !== userId) {
    return { success: false, error: "対象キャラが存在しないか、操作権限がありません。" };
  }
  if (character.category !== "protagonist" && character.category !== "companion") {
    return { success: false, error: "主人公または仲間にのみ使用できます。" };
  }
  const quantity = inv?.quantity ?? 0;
  if (quantity <= 0) {
    return { success: false, error: "分析書を所持していません。" };
  }

  const existing = await prisma.characterSkill.findUnique({
    where: { characterId_skillId: { characterId, skillId: item.skillId } },
    select: { level: true },
  });

  const booksNeeded = existing ? existing.level + 1 : 1;
  if (quantity < booksNeeded) {
    return {
      success: false,
      error: existing
        ? `レベルアップにはあと ${booksNeeded - quantity} 冊必要です。（Lv${existing.level}→${existing.level + 1} に ${booksNeeded} 冊）`
        : "分析書が1冊必要です。",
    };
  }

  const newLevel = existing ? existing.level + 1 : 0;
  const skillId = item.skillId;

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.characterSkill.update({
        where: { characterId_skillId: { characterId, skillId } },
        data: { level: newLevel },
      });
    } else {
      await tx.characterSkill.create({
        data: { characterId, skillId, level: 0 },
      });
    }
    await tx.userInventory.update({
      where: { userId_itemId: { userId, itemId } },
      data: { quantity: { decrement: booksNeeded } },
    });
  });

  return { success: true, newLevel };
}

/** spec/052: スキル分析書の使用対象となるキャラ一覧（主人公＋仲間）。 */
export async function getCharactersForSkillBook(): Promise<
  { id: string; displayName: string; category: string }[] | null
> {
  const session = await getSession();
  if (!session?.userId) return null;
  const list = await prisma.character.findMany({
    where: {
      userId: session.userId,
      category: { in: ["protagonist", "companion"] },
    },
    select: { id: true, displayName: true, category: true },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });
  return list;
}
