"use server";

// spec/051_relics.md - 遺物一覧・鑑定・装着・解除

import { getSession } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { RelicGroupAppraisalConfig } from "@/lib/constants/relic";
import {
  RELIC_GROUP_APPRAISAL_CONFIG,
  RELIC_SHARD_ITEM_CODE,
  RELIC_SLOTS,
  RELIC_TEMPER_SHARD_COST,
  RELIC_TOKEN_ITEM_CODES,
  RELIC_TOKEN_TO_GROUP,
} from "@/lib/constants/relic";
import type { AttributeResistances } from "@/lib/battle/run-battle-with-party";

/** DB の RelicGroupConfig を参照して鑑定用設定を返す。なければ null。 */
async function getRelicGroupAppraisalConfigFromDb(
  groupCode: string
): Promise<RelicGroupAppraisalConfig | null> {
  const row = await prisma.relicGroupConfig.findUnique({
    where: { groupCode },
    select: {
      statBonus1Min: true,
      statBonus1Max: true,
      statBonus2Min: true,
      statBonus2Max: true,
      attributeResistMin: true,
      attributeResistMax: true,
      includeNoEffect: true,
      passiveEffects: {
        select: { relicPassiveEffect: { select: { code: true } } },
      },
    },
  });
  if (!row) return null;
  const passiveEffectCodes = row.passiveEffects.map((p) => p.relicPassiveEffect.code);
  if (row.includeNoEffect) passiveEffectCodes.push("none");
  return {
    passiveEffectCodes,
    statBonus1: { min: row.statBonus1Min, max: row.statBonus1Max },
    statBonus2: { min: row.statBonus2Min, max: row.statBonus2Max },
    attributeResist: { min: row.attributeResistMin, max: row.attributeResistMax },
  };
}

export type RelicInstanceSummary = {
  id: string;
  relicTypeName: string;
  relicPassiveEffectName: string | null;
  /** パッシブ効果の説明。ツールチップ表示用 */
  relicPassiveEffectDescription: string | null;
  statBonus1: { stat: string; percent: number } | null;
  statBonus2: { stat: string; percent: number } | null;
  attributeResistances: AttributeResistances | null;
  equippedCharacterId: string | null;
};

export type CharacterRelicSlot = {
  slot: number;
  relicInstance: RelicInstanceSummary | null;
};

/** ユーザー所持の遺物個体一覧。装着先キャラID 付き。 */
export async function getRelicInstances(): Promise<
  { success: true; relics: RelicInstanceSummary[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const list = await prisma.relicInstance.findMany({
    where: { userId: session.userId },
    include: {
      relicType: true,
      relicPassiveEffect: true,
      characterRelics: { take: 1, select: { characterId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const relics: RelicInstanceSummary[] = list.map((r) => ({
    id: r.id,
    relicTypeName: r.relicType.name,
    relicPassiveEffectName: r.relicPassiveEffect?.name ?? null,
    relicPassiveEffectDescription: r.relicPassiveEffect?.description ?? null,
    statBonus1: parseStatBonus(r.statBonus1),
    statBonus2: parseStatBonus(r.statBonus2),
    attributeResistances: (r.attributeResistances as AttributeResistances) ?? null,
    equippedCharacterId: r.characterRelics[0]?.characterId ?? null,
  }));

  return { success: true, relics };
}

function parseStatBonus(json: unknown): { stat: string; percent: number } | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const stat = typeof o.stat === "string" ? o.stat : "";
  const percent = typeof o.percent === "number" ? o.percent : 0;
  if (!stat) return null;
  return { stat, percent };
}

/** 指定キャラの遺物4枠（スロット1～4）の装着状況。 */
export async function getCharacterRelics(characterId: string): Promise<
  { success: true; slots: CharacterRelicSlot[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    include: {
      characterRelics: {
        where: { slot: { in: [...RELIC_SLOTS] } },
        include: {
          relicInstance: {
            include: {
              relicType: true,
              relicPassiveEffect: true,
            },
          },
        },
      },
    },
  });

  if (!character) {
    return { success: false, error: "CHARACTER_NOT_FOUND" };
  }

  const bySlot = new Map(
    character.characterRelics.map((cr) => [
      cr.slot,
      cr.relicInstance
        ? {
            id: cr.relicInstance.id,
            relicTypeName: cr.relicInstance.relicType.name,
            relicPassiveEffectName: cr.relicInstance.relicPassiveEffect?.name ?? null,
            relicPassiveEffectDescription: cr.relicInstance.relicPassiveEffect?.description ?? null,
            statBonus1: parseStatBonus(cr.relicInstance.statBonus1),
            statBonus2: parseStatBonus(cr.relicInstance.statBonus2),
            attributeResistances: (cr.relicInstance.attributeResistances as AttributeResistances) ?? null,
            equippedCharacterId: characterId,
          }
        : null,
    ])
  );

  const slots: CharacterRelicSlot[] = RELIC_SLOTS.map((slot) => ({
    slot,
    relicInstance: bySlot.get(slot) ?? null,
  }));

  return { success: true, slots };
}

/** 遺物トークン（Item）を1個消費して遺物個体を1個生成。 */
export async function appraiseRelicToken(itemCode: string): Promise<
  { success: true; relic: RelicInstanceSummary } | { success: false; error: string; message: string }
> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  if (!RELIC_TOKEN_ITEM_CODES.includes(itemCode)) {
    return { success: false, error: "INVALID_TOKEN", message: "遺物トークンではありません" };
  }

  const groupCode = RELIC_TOKEN_TO_GROUP[itemCode];
  if (!groupCode) {
    return { success: false, error: "INVALID_GROUP", message: "鑑定に失敗しました。この遺物は解析できません。" };
  }

  let config = await getRelicGroupAppraisalConfigFromDb(groupCode);
  if (!config) config = RELIC_GROUP_APPRAISAL_CONFIG[groupCode] ?? null;
  if (!config) {
    return { success: false, error: "INVALID_GROUP", message: "鑑定に失敗しました。この遺物は解析できません。" };
  }

  const item = await prisma.item.findUnique({ where: { code: itemCode }, select: { id: true } });
  if (!item) {
    return { success: false, error: "ITEM_NOT_FOUND", message: "アイテムが見つかりません" };
  }

  const inv = await prisma.userInventory.findUnique({
    where: { userId_itemId: { userId: session.userId, itemId: item.id } },
    select: { quantity: true },
  });
  if (!inv || inv.quantity < 1) {
    return { success: false, error: "INSUFFICIENT_QUANTITY", message: "遺物の原石が不足しています" };
  }

  const relicTypes = await prisma.relicType.findMany({
    where: { groupCode },
    select: { id: true, name: true },
  });
  const passiveEffectsAll = await prisma.relicPassiveEffect.findMany({
    select: { id: true, name: true, code: true },
  });

  if (relicTypes.length === 0) {
    return { success: false, error: "NO_RELIC_TYPE", message: "鑑定に失敗しました。この遺物は解析できません。" };
  }

  const relicType = relicTypes[Math.floor(Math.random() * relicTypes.length)]!;

  let passive: (typeof passiveEffectsAll)[number] | null = null;
  const pool: ((typeof passiveEffectsAll)[number] | null)[] = config.passiveEffectCodes.includes("none")
    ? [null]
    : [];
  for (const code of config.passiveEffectCodes) {
    if (code === "none") continue;
    const ef = passiveEffectsAll.find((e) => e.code === code);
    if (ef) pool.push(ef);
  }
  if (pool.length > 0) {
    const chosen = pool[Math.floor(Math.random() * pool.length)]!;
    passive = chosen;
  }

  const baseStats = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;
  const pickTwo = (): [string, string] => {
    const a = baseStats[Math.floor(Math.random() * baseStats.length)]!;
    let b = baseStats[Math.floor(Math.random() * baseStats.length)]!;
    while (b === a) b = baseStats[Math.floor(Math.random() * baseStats.length)]!;
    return [a, b];
  };
  const [s1, s2] = pickTwo();

  const randInt = (min: number, max: number) =>
    min + Math.floor(Math.random() * (max - min + 1));
  const statBonus1 = { stat: s1, percent: randInt(config.statBonus1.min, config.statBonus1.max) };
  const statBonus2 = { stat: s2, percent: randInt(config.statBonus2.min, config.statBonus2.max) };

  const attrKeys = ["crush", "slash", "pierce", "burn", "freeze", "corrode", "polarity"];
  const oneResist = attrKeys[Math.floor(Math.random() * attrKeys.length)]!;
  const resistValue =
    Math.round(
      (config.attributeResist.min +
        Math.random() * (config.attributeResist.max - config.attributeResist.min)) *
        1000
    ) / 1000;
  const attributeResistances: AttributeResistances = { [oneResist]: resistValue };

  const [created] = await prisma.$transaction([
    prisma.relicInstance.create({
      data: {
        userId: session.userId,
        relicTypeId: relicType.id,
        relicPassiveEffectId: passive?.id ?? undefined,
        statBonus1: statBonus1 as object,
        statBonus2: statBonus2 as object,
        attributeResistances: attributeResistances as object,
      },
      include: {
        relicType: true,
        relicPassiveEffect: true,
      },
    }),
    prisma.userInventory.update({
      where: { userId_itemId: { userId: session.userId, itemId: item.id } },
      data: { quantity: { decrement: 1 } },
    }),
  ]);

  const relic: RelicInstanceSummary = {
    id: created.id,
    relicTypeName: created.relicType.name,
    relicPassiveEffectName: created.relicPassiveEffect?.name ?? null,
    relicPassiveEffectDescription: created.relicPassiveEffect?.description ?? null,
    statBonus1: parseStatBonus(created.statBonus1),
    statBonus2: parseStatBonus(created.statBonus2),
    attributeResistances: (created.attributeResistances as AttributeResistances) ?? null,
    equippedCharacterId: null,
  };

  return { success: true, relic };
}

/** 指定キャラの指定スロットに遺物を装着。既に他スロットに装着されていれば外す。 */
export async function equipRelic(
  characterId: string,
  slot: number,
  relicInstanceId: string | null
): Promise<{ success: true } | { success: false; error: string; message: string }> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }
  if (slot < 1 || slot > 4) {
    return { success: false, error: "INVALID_SLOT", message: "スロットは1～4で指定してください" };
  }

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: { id: true },
  });
  if (!character) {
    return { success: false, error: "CHARACTER_NOT_FOUND", message: "キャラクターが見つかりません" };
  }

  if (relicInstanceId) {
    const relic = await prisma.relicInstance.findFirst({
      where: { id: relicInstanceId, userId: session.userId },
      select: { id: true },
    });
    if (!relic) {
      return { success: false, error: "RELIC_NOT_FOUND", message: "遺物が見つかりません" };
    }

    await prisma.$transaction([
      prisma.characterRelic.deleteMany({ where: { relicInstanceId } }),
      prisma.characterRelic.upsert({
        where: {
          characterId_slot: { characterId, slot },
        },
        create: { characterId, slot, relicInstanceId },
        update: { relicInstanceId },
      }),
    ]);
  } else {
    await prisma.characterRelic.deleteMany({
      where: { characterId, slot },
    });
  }

  return { success: true };
}

/** 指定キャラの指定スロットから遺物を外す。 */
export async function unequipRelic(
  characterId: string,
  slot: number
): Promise<{ success: true } | { success: false; error: string; message: string }> {
  return equipRelic(characterId, slot, null);
}

/** 未装着の遺物個体を1個消費し、アイテム relic_shard を1個付与。spec/051 §5.6, docs/086 */
export async function decomposeRelic(relicInstanceId: string): Promise<
  { success: true } | { success: false; error: string; message: string }
> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  const relic = await prisma.relicInstance.findFirst({
    where: { id: relicInstanceId, userId: session.userId },
    include: {
      characterRelics: { take: 1, select: { id: true } },
    },
  });
  if (!relic) {
    return { success: false, error: "RELIC_NOT_FOUND", message: "遺物が見つかりません" };
  }
  if (relic.characterRelics.length > 0) {
    return { success: false, error: "EQUIPPED", message: "装着中の遺物は分解できません" };
  }

  const shardItem = await prisma.item.findUnique({
    where: { code: RELIC_SHARD_ITEM_CODE },
    select: { id: true },
  });
  if (!shardItem) {
    return { success: false, error: "RELIC_SHARD_ITEM_NOT_FOUND", message: "分解に失敗しました。（relic_shard が登録されていません）" };
  }

  await prisma.$transaction([
    prisma.relicInstance.delete({ where: { id: relicInstanceId } }),
    prisma.userInventory.upsert({
      where: {
        userId_itemId: { userId: session.userId, itemId: shardItem.id },
      },
      create: { userId: session.userId, itemId: shardItem.id, quantity: 1 },
      update: { quantity: { increment: 1 } },
    }),
  ]);

  return { success: true };
}

/** 調律の before/after で使うステータス部分の型。docs/087 */
export type RelicTemperStats = {
  statBonus1: { stat: string; percent: number } | null;
  statBonus2: { stat: string; percent: number } | null;
  attributeResistances: AttributeResistances | null;
};

/** 指定遺物の未確定調律結果があれば返す。docs/087, spec/051 §5.7 */
export async function getRelicTemperPending(relicInstanceId: string): Promise<{
  success: true;
  pending: { after: RelicTemperStats };
} | { success: true; pending: null } | { success: false; error: string }> {
  const session = await getSession();
  if (!session.userId) return { success: false, error: "UNAUTHORIZED" };

  const pending = await prisma.relicTemperPending.findFirst({
    where: { relicInstanceId, userId: session.userId },
    select: {
      newStatBonus1: true,
      newStatBonus2: true,
      newAttributeResistances: true,
    },
  });
  if (!pending) return { success: true, pending: null };
  const after: RelicTemperStats = {
    statBonus1: parseStatBonus(pending.newStatBonus1),
    statBonus2: parseStatBonus(pending.newStatBonus2),
    attributeResistances: (pending.newAttributeResistances as AttributeResistances) ?? null,
  };
  return { success: true, pending: { after } };
}

/** 遺物の groupCode に紐づく鑑定設定を取得（鑑定・調律で共通）。 */
async function getAppraisalConfigForRelic(relicInstanceId: string, userId: string): Promise<RelicGroupAppraisalConfig | null> {
  const relic = await prisma.relicInstance.findFirst({
    where: { id: relicInstanceId, userId },
    select: { relicType: { select: { groupCode: true } } },
  });
  if (!relic?.relicType?.groupCode) return RELIC_GROUP_APPRAISAL_CONFIG["group_a"] ?? null;
  let config = await getRelicGroupAppraisalConfigFromDb(relic.relicType.groupCode);
  if (!config) config = RELIC_GROUP_APPRAISAL_CONFIG[relic.relicType.groupCode] ?? null;
  return config;
}

/** 遺物の欠片を消費して調律を実行（リロール結果を pending に保存）。docs/087 */
export async function startRelicTemper(relicInstanceId: string): Promise<
  { success: true; before: RelicTemperStats; after: RelicTemperStats } | { success: false; error: string; message: string }
> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  const relic = await prisma.relicInstance.findFirst({
    where: { id: relicInstanceId, userId: session.userId },
    include: {
      relicType: true,
      characterRelics: { take: 1, select: { id: true } },
    },
  });
  if (!relic) {
    return { success: false, error: "RELIC_NOT_FOUND", message: "遺物が見つかりません" };
  }
  if (relic.characterRelics.length > 0) {
    return { success: false, error: "EQUIPPED", message: "装着中の遺物は調律できません" };
  }

  const existing = await prisma.relicTemperPending.findUnique({
    where: { relicInstanceId },
  });
  if (existing) {
    return { success: false, error: "PENDING_EXISTS", message: "未確定の調律結果があります。確定または取消を選んでください。" };
  }

  const config = await getAppraisalConfigForRelic(relicInstanceId, session.userId);
  if (!config) {
    return { success: false, error: "NO_CONFIG", message: "この遺物の調律設定がありません。" };
  }

  const shardItem = await prisma.item.findUnique({
    where: { code: RELIC_SHARD_ITEM_CODE },
    select: { id: true },
  });
  if (!shardItem) {
    return { success: false, error: "RELIC_SHARD_ITEM_NOT_FOUND", message: "遺物の欠片が登録されていません。" };
  }

  const inv = await prisma.userInventory.findUnique({
    where: { userId_itemId: { userId: session.userId, itemId: shardItem.id } },
    select: { quantity: true },
  });
  const stock = inv?.quantity ?? 0;
  if (stock < RELIC_TEMPER_SHARD_COST) {
    return { success: false, error: "INSUFFICIENT_SHARDS", message: `遺物の欠片が不足しています（必要: ${RELIC_TEMPER_SHARD_COST}個、所持: ${stock}個）。` };
  }

  const before: RelicTemperStats = {
    statBonus1: parseStatBonus(relic.statBonus1),
    statBonus2: parseStatBonus(relic.statBonus2),
    attributeResistances: (relic.attributeResistances as AttributeResistances) ?? null,
  };

  const baseStats = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;
  const pickTwo = (): [string, string] => {
    const a = baseStats[Math.floor(Math.random() * baseStats.length)]!;
    let b = baseStats[Math.floor(Math.random() * baseStats.length)]!;
    while (b === a) b = baseStats[Math.floor(Math.random() * baseStats.length)]!;
    return [a, b];
  };
  const [s1, s2] = pickTwo();
  const randInt = (min: number, max: number) =>
    min + Math.floor(Math.random() * (max - min + 1));
  const statBonus1 = { stat: s1, percent: randInt(config.statBonus1.min, config.statBonus1.max) };
  const statBonus2 = { stat: s2, percent: randInt(config.statBonus2.min, config.statBonus2.max) };

  const attrKeys = ["crush", "slash", "pierce", "burn", "freeze", "corrode", "polarity"];
  const oneResist = attrKeys[Math.floor(Math.random() * attrKeys.length)]!;
  const resistValue =
    Math.round(
      (config.attributeResist.min +
        Math.random() * (config.attributeResist.max - config.attributeResist.min)) *
        1000
    ) / 1000;
  const attributeResistances: AttributeResistances = { [oneResist]: resistValue };

  const after: RelicTemperStats = {
    statBonus1,
    statBonus2,
    attributeResistances,
  };

  await prisma.$transaction([
    prisma.relicTemperPending.create({
      data: {
        userId: session.userId,
        relicInstanceId,
        newStatBonus1: statBonus1 as object,
        newStatBonus2: statBonus2 as object,
        newAttributeResistances: attributeResistances as object,
      },
    }),
    prisma.userInventory.update({
      where: { userId_itemId: { userId: session.userId, itemId: shardItem.id } },
      data: { quantity: { decrement: RELIC_TEMPER_SHARD_COST } },
    }),
  ]);

  return { success: true, before, after };
}

/** 調律を確定し、RelicInstance を更新。docs/087 */
export async function confirmRelicTemper(relicInstanceId: string): Promise<
  { success: true } | { success: false; error: string; message: string }
> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  const pending = await prisma.relicTemperPending.findFirst({
    where: { relicInstanceId, userId: session.userId },
    select: { newStatBonus1: true, newStatBonus2: true, newAttributeResistances: true },
  });
  if (!pending) {
    return { success: false, error: "NO_PENDING", message: "調律の待機結果がありません。" };
  }

  await prisma.$transaction([
    prisma.relicInstance.update({
      where: { id: relicInstanceId },
      data: {
        statBonus1: pending.newStatBonus1 as Prisma.InputJsonValue,
        statBonus2: pending.newStatBonus2 as Prisma.InputJsonValue,
        attributeResistances: pending.newAttributeResistances as Prisma.InputJsonValue,
      },
    }),
    prisma.relicTemperPending.delete({ where: { relicInstanceId } }),
  ]);

  return { success: true };
}

/** 調律を取消。pending を破棄するのみ。遺物の欠片は返却しない（調律実行時に消費済み）。docs/087 */
export async function cancelRelicTemper(relicInstanceId: string): Promise<
  { success: true } | { success: false; error: string; message: string }
> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  const pending = await prisma.relicTemperPending.findFirst({
    where: { relicInstanceId, userId: session.userId },
  });
  if (!pending) {
    return { success: false, error: "NO_PENDING", message: "調律の待機結果がありません。" };
  }

  await prisma.relicTemperPending.delete({ where: { relicInstanceId } });
  return { success: true };
}

// mergeAttributeResistancesFromRelics は Server Action ではないため lib に配置。
// 戦闘用の集約は @/lib/battle/attribute-resistances の mergeAttributeResistancesFromRelics を使用すること。
