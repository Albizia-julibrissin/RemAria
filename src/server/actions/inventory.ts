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
  /** spec/052: category=skill_book のとき紐づくスキルID。習得対象キャラの絞り込みに使用。 */
  skillId?: string | null;
  /** spec/052: category=skill_book のとき紐づくスキルの説明。物資庫で！ボタン表示用。 */
  skillDescription?: string | null;
  /** spec/052: スキル表示タグ（JSON 配列）。物資庫でタグ・物理/CT/CD 表示用。 */
  skillDisplayTags?: unknown;
  /** 戦闘スキル種別（physical / magic / support）。 */
  skillBattleSkillType?: string | null;
  /** チャージタイム（サイクル）。 */
  skillChargeCycles?: number | null;
  /** クールダウン（サイクル）。 */
  skillCooldownCycles?: number | null;
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
 * 探索開始フォーム用：消耗品のスタック一覧のみ取得（装備・メカパーツは取得しない）。
 * ダッシュボード表示の軽量化用。
 */
export async function getConsumableStacksForExploration(): Promise<StackableItem[] | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const rows = await prisma.userInventory.findMany({
    where: {
      userId: session.userId,
      item: { category: "consumable" },
      quantity: { gt: 0 },
    },
    include: {
      item: { select: { code: true, name: true, category: true, maxCarryPerExpedition: true } },
    },
    orderBy: { item: { code: "asc" } },
  });

  return rows.map((row) => ({
    itemId: row.itemId,
    code: row.item.code,
    name: row.item.name,
    category: row.item.category,
    quantity: row.quantity,
    maxCarryPerExpedition: row.item.maxCarryPerExpedition ?? null,
  }));
}

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
        include: {
          item: {
            select: {
              code: true,
              name: true,
              category: true,
              maxCarryPerExpedition: true,
              skillId: true,
              skill: {
                select: {
                  description: true,
                  displayTags: true,
                  battleSkillType: true,
                  chargeCycles: true,
                  cooldownCycles: true,
                },
              },
            },
          },
        },
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
    skillId: row.item.skillId ?? null,
    skillDescription: row.item.skill?.description ?? null,
    skillDisplayTags: row.item.skill?.displayTags ?? undefined,
    skillBattleSkillType: row.item.skill?.battleSkillType ?? null,
    skillChargeCycles: row.item.skill?.chargeCycles ?? null,
    skillCooldownCycles: row.item.skill?.cooldownCycles ?? null,
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

  const { SKILL_LEVEL_CAP } = await import("@/lib/battle/battle-constants");
  if (existing && existing.level >= SKILL_LEVEL_CAP) {
    return { success: false, error: "スキルは最大レベルです。" };
  }

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

/** spec/052: キャラの指定スキルのレベルアップに必要な分析書情報。モーダル表示用。 */
export async function getSkillBookLevelUpInfo(
  characterId: string,
  skillId: string
): Promise<{
  success: true;
  itemId: string;
  itemName: string;
  currentLevel: number;
  booksRequiredForNextLevel: number;
  userQuantity: number;
  /** 最大レベル(99)に達しているとき true。分析ボタン無効用。 */
  isMaxLevel: boolean;
} | { success: false; error: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "ログインしてください。" };
  }
  const [character, characterSkill, item] = await Promise.all([
    prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, userId: true, category: true },
    }),
    prisma.characterSkill.findUnique({
      where: { characterId_skillId: { characterId, skillId } },
      select: { level: true },
    }),
    prisma.item.findFirst({
      where: { category: "skill_book", skillId },
      select: { id: true, name: true },
    }),
  ]);
  if (!character || character.userId !== session.userId) {
    return { success: false, error: "対象キャラが存在しないか、操作権限がありません。" };
  }
  if (character.category !== "protagonist" && character.category !== "companion") {
    return { success: false, error: "主人公または仲間にのみ使用できます。" };
  }
  if (!item) {
    return { success: false, error: "このスキルに対応する分析書が登録されていません。" };
  }
  const inv = await prisma.userInventory.findUnique({
    where: { userId_itemId: { userId: session.userId, itemId: item.id } },
    select: { quantity: true },
  });
  const { SKILL_LEVEL_CAP } = await import("@/lib/battle/battle-constants");
  const currentLevel = characterSkill?.level ?? 0;
  const isMaxLevel = currentLevel >= SKILL_LEVEL_CAP;
  const booksRequiredForNextLevel = isMaxLevel ? 0 : currentLevel + 1;
  const userQuantity = inv?.quantity ?? 0;
  return {
    success: true,
    itemId: item.id,
    itemName: item.name,
    currentLevel,
    booksRequiredForNextLevel,
    userQuantity,
    isMaxLevel,
  };
}

/** spec/052: スキル分析書の習得対象となるキャラ一覧。指定スキルをまだ習得していない主人公＋仲間のみ返す。 */
export async function getCharactersForSkillBook(skillId: string): Promise<
  { id: string; displayName: string; category: string }[] | null
> {
  const session = await getSession();
  if (!session?.userId) return null;
  const alreadyHave = await prisma.characterSkill.findMany({
    where: { skillId },
    select: { characterId: true },
  });
  const excludeIds = alreadyHave.map((r) => r.characterId);
  const list = await prisma.character.findMany({
    where: {
      userId: session.userId,
      category: { in: ["protagonist", "companion"] },
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    select: { id: true, displayName: true, category: true },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });
  return list;
}
