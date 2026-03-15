"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isTestUser1 } from "@/server/lib/admin";
import {
  parseEquipmentStatGenConfig,
  parseMechaPartStatGenConfig,
} from "@/lib/craft/parse-stat-gen-config";
import { EQUIPMENT_STAT_KEYS, type EquipmentStatGenConfig } from "@/lib/craft/equipment-stat-gen";
import type { MechaPartStatGenConfig } from "@/lib/craft/mecha-part-stat-gen";
import { isEquipmentSlot } from "@/lib/constants/equipment-slots";
import { isMechaSlot } from "@/lib/constants/mecha-slots";
import { SKILL_EFFECT_TYPE_INFO } from "@/lib/constants/skill-effect-types";

export type AdminContentLists = {
  items: { id: string; code: string; name: string; category: string }[];
  skills: { id: string; name: string; category: string; battleSkillType: string | null }[];
  enemies: { id: string; code: string; name: string }[];
  relicTypes: { id: string; code: string; name: string; groupCode: string | null }[];
  /** 鑑定で抽選対象になるパッシブ効果（現状はグループ共通で全件） */
  relicPassiveEffects: { id: string; code: string; name: string; description: string | null }[];
  explorationThemes: { id: string; name: string; areas: { id: string; code: string; name: string }[] }[];
};

/**
 * 実装済みコンテンツ一覧を取得する。テストユーザー1でログインしている場合のみ返す。
 */
export async function getAdminContentLists(): Promise<AdminContentLists | null> {
  const ok = await isTestUser1();
  if (!ok) return null;

  const [items, skills, enemies, relicTypes, relicPassiveEffects, themes] = await Promise.all([
    prisma.item.findMany({
      orderBy: [{ category: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, category: true },
    }),
    prisma.skill.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, battleSkillType: true },
    }),
    prisma.enemy.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.relicType.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, groupCode: true },
    }),
    prisma.relicPassiveEffect.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, description: true },
    }),
    prisma.explorationTheme.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        areas: {
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          select: { id: true, code: true, name: true },
        },
      },
    }),
  ]);

  return {
    items,
    skills,
    enemies,
    relicTypes,
    relicPassiveEffects,
    explorationThemes: themes,
  };
}

// --- エリアドロップ編集（spec/049 ドロップテーブル） ---

export type DropTableEntryRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  minQuantity: number;
  maxQuantity: number;
  weight: number;
};

export type AreaDropTableInfo = {
  id: string;
  code: string;
  name: string;
  kind: string;
  entries: DropTableEntryRow[];
} | null;

export type AreaDropEditData = {
  area: { id: string; code: string; name: string };
  /** 枠種別ごとのドロップテーブル（未設定は null） */
  base: AreaDropTableInfo;
  battle: AreaDropTableInfo;
  skill: AreaDropTableInfo;
  strongEnemy: AreaDropTableInfo;
  areaLord: AreaDropTableInfo;
};

/**
 * エリア一覧（ドロップ編集用）。テストユーザー1のみ。
 */
export async function getAdminAreaList(): Promise<
  { id: string; code: string; name: string; themeName: string }[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const areas = await prisma.explorationArea.findMany({
    orderBy: [
      { theme: { displayOrder: "asc" } },
      { displayOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      code: true,
      name: true,
      theme: { select: { name: true } },
    },
  });
  return areas.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    themeName: a.theme.name,
  }));
}

/**
 * 指定エリアのドロップテーブル5種とエントリを取得。テストユーザー1のみ。
 */
export async function getAreaDropEditData(areaId: string): Promise<AreaDropEditData | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const area = await prisma.explorationArea.findUnique({
    where: { id: areaId },
    select: {
      id: true,
      code: true,
      name: true,
      baseDropTableId: true,
      battleDropTableId: true,
      skillDropTableId: true,
      strongEnemyDropTableId: true,
      areaLordDropTableId: true,
      baseDropTable: { include: { entries: { include: { item: { select: { id: true, code: true, name: true } } } } } },
      battleDropTable: { include: { entries: { include: { item: { select: { id: true, code: true, name: true } } } } } },
      skillDropTable: { include: { entries: { include: { item: { select: { id: true, code: true, name: true } } } } } },
      strongEnemyDropTable: { include: { entries: { include: { item: { select: { id: true, code: true, name: true } } } } } },
      areaLordDropTable: { include: { entries: { include: { item: { select: { id: true, code: true, name: true } } } } } },
    },
  });
  if (!area) return null;

  const toInfo = (t: {
    id: string;
    code: string;
    name: string;
    kind: string;
    entries: Array<{
      id: string;
      minQuantity: number;
      maxQuantity: number;
      weight: number;
      item: { id: string; code: string; name: string };
    }>;
  }): AreaDropTableInfo => ({
    id: t.id,
    code: t.code,
    name: t.name,
    kind: t.kind,
    entries: t.entries.map((e) => ({
      id: e.id,
      itemId: e.item.id,
      itemCode: e.item.code,
      itemName: e.item.name,
      minQuantity: e.minQuantity,
      maxQuantity: e.maxQuantity,
      weight: e.weight,
    })),
  });

  return {
    area: { id: area.id, code: area.code, name: area.name },
    base: area.baseDropTable ? toInfo(area.baseDropTable) : null,
    battle: area.battleDropTable ? toInfo(area.battleDropTable) : null,
    skill: area.skillDropTable ? toInfo(area.skillDropTable) : null,
    strongEnemy: area.strongEnemyDropTable ? toInfo(area.strongEnemyDropTable) : null,
    areaLord: area.areaLordDropTable ? toInfo(area.areaLordDropTable) : null,
  };
}

export type SaveDropTableEntryInput = {
  itemId: string;
  minQuantity: number;
  maxQuantity: number;
  weight: number;
};

/**
 * 指定ドロップテーブルのエントリを一括置換。テストユーザー1のみ。
 */
export async function saveDropTableEntries(
  dropTableId: string,
  entries: SaveDropTableEntryInput[]
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const table = await prisma.dropTable.findUnique({
    where: { id: dropTableId },
    select: { id: true },
  });
  if (!table) return { success: false, error: "ドロップテーブルが見つかりません。" };
  await prisma.$transaction(async (tx) => {
    await tx.dropTableEntry.deleteMany({ where: { dropTableId } });
    if (entries.length > 0) {
      const valid = entries.filter(
        (e) =>
          e.itemId &&
          Number.isInteger(e.minQuantity) &&
          e.minQuantity >= 0 &&
          Number.isInteger(e.maxQuantity) &&
          e.maxQuantity >= e.minQuantity &&
          Number.isInteger(e.weight) &&
          e.weight >= 1
      );
      await tx.dropTableEntry.createMany({
        data: valid.map((e) => ({
          dropTableId,
          itemId: e.itemId,
          minQuantity: e.minQuantity,
          maxQuantity: e.maxQuantity,
          weight: e.weight,
        })),
      });
    }
  });
  return { success: true };
}

/** コピー用の kind キー（クライアントと一致） */
const DROP_KIND_KEYS = ["base", "battle", "skill", "strongEnemy", "areaLord"] as const;

/**
 * 指定エリア・ブロックのドロップエントリをコピー用に取得。テストユーザー1のみ。
 * 他エリア／他ブロックのドロップをこのブロックにコピーするときに使用する。
 */
export async function getDropTableEntriesForCopy(
  areaId: string,
  kind: string
): Promise<SaveDropTableEntryInput[]> {
  const ok = await isTestUser1();
  if (!ok) return [];
  if (!DROP_KIND_KEYS.includes(kind as (typeof DROP_KIND_KEYS)[number])) return [];
  const area = await prisma.explorationArea.findUnique({
    where: { id: areaId },
    select: {
      baseDropTableId: true,
      battleDropTableId: true,
      skillDropTableId: true,
      strongEnemyDropTableId: true,
      areaLordDropTableId: true,
      baseDropTable: { select: { entries: { select: { itemId: true, minQuantity: true, maxQuantity: true, weight: true } } } },
      battleDropTable: { select: { entries: { select: { itemId: true, minQuantity: true, maxQuantity: true, weight: true } } } },
      skillDropTable: { select: { entries: { select: { itemId: true, minQuantity: true, maxQuantity: true, weight: true } } } },
      strongEnemyDropTable: { select: { entries: { select: { itemId: true, minQuantity: true, maxQuantity: true, weight: true } } } },
      areaLordDropTable: { select: { entries: { select: { itemId: true, minQuantity: true, maxQuantity: true, weight: true } } } },
    },
  });
  if (!area) return [];
  const tableByKind = {
    base: area.baseDropTable,
    battle: area.battleDropTable,
    skill: area.skillDropTable,
    strongEnemy: area.strongEnemyDropTable,
    areaLord: area.areaLordDropTable,
  } as const;
  const table = tableByKind[kind as keyof typeof tableByKind];
  if (!table?.entries) return [];
  return table.entries.map((e) => ({
    itemId: e.itemId,
    minQuantity: e.minQuantity,
    maxQuantity: e.maxQuantity,
    weight: e.weight,
  }));
}

/**
 * ドロップ編集用のアイテム一覧（セレクト用）。テストユーザー1のみ。
 */
export async function getAdminItemsForDrop(): Promise<
  { id: string; code: string; name: string; category: string }[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.item.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, category: true },
  });
}

// --- アイテムマスタ編集（spec/045 Item） ---

import { ITEM_CATEGORIES } from "@/lib/constants/item-categories";

export type AdminItemRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  skillId: string | null;
  skillName: string | null;
  consumableEffect: unknown;
  maxCarryPerExpedition: number | null;
  /** ユーザー別の所持数上限（スタック可能アイテム用）。null は上限なし扱い。 */
  maxOwnedPerUser: number | null;
  /** spec/075: 市場出品可。true のアイテムのみ出品可能。 */
  marketListable: boolean;
  /** spec/075: 出品時の単価下限。NULL ならグローバル定数。 */
  marketMinPricePerUnit: number | null;
  /** spec/075: 出品時の数量下限。NULL ならグローバル定数。 */
  marketMinQuantity: number | null;
};

/**
 * 登録済みユーザ一覧（管理用）。テストユーザー1のみ。
 */
export type AdminUserRow = {
  id: string;
  email: string;
  accountId: string;
  name: string;
  accountStatus: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  hasProtagonist: boolean;
  /** 探索回数（ExpeditionHistory の件数）。spec/061 */
  expeditionCount: number;
};

export async function getAdminUserList(): Promise<AdminUserRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      accountId: true,
      name: true,
      accountStatus: true,
      createdAt: true,
      lastLoginAt: true,
      lastActiveAt: true,
      protagonistCharacterId: true,
      _count: { select: { expeditionHistories: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    accountId: r.accountId,
    name: r.name,
    accountStatus: r.accountStatus,
    createdAt: r.createdAt,
    lastLoginAt: r.lastLoginAt,
    lastActiveAt: r.lastActiveAt ?? null,
    hasProtagonist: r.protagonistCharacterId != null,
    expeditionCount: r._count.expeditionHistories,
  }));
}

/** 通貨履歴（運営ビュー）用。ユーザーを email または id で検索。spec/075 Phase 3, manage/OPERATIONAL_LOGS.md §2.3 */
export async function getAdminUserForCurrencyHistory(
  query: string
): Promise<{ id: string; email: string; name: string } | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const q = query.trim();
  if (!q) return null;
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: q }, { email: q }],
    },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export type AdminCurrencyTransactionRow = {
  id: string;
  currencyType: string;
  amount: number;
  beforeBalance: number | null;
  afterBalance: number | null;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
};

/** 指定ユーザーの CurrencyTransaction 一覧（createdAt 降順）。運営ビュー用。 */
export async function getAdminCurrencyHistory(
  userId: string
): Promise<{ user: { id: string; email: string; name: string }; transactions: AdminCurrencyTransactionRow[] } | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return null;
  const rows = await prisma.currencyTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return {
    user: { id: user.id, email: user.email, name: user.name },
    transactions: rows.map((r) => ({
      id: r.id,
      currencyType: r.currencyType,
      amount: r.amount,
      beforeBalance: r.beforeBalance,
      afterBalance: r.afterBalance,
      reason: r.reason,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      createdAt: r.createdAt,
    })),
  };
}

export type AdminItemUsageLogRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
};

/** 指定ユーザーの ItemUsageLog 一覧（createdAt 降順）。運営ビュー用。docs/081 */
export async function getAdminItemUsageHistory(
  userId: string
): Promise<{ user: { id: string; email: string; name: string }; logs: AdminItemUsageLogRow[] } | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return null;
  const rows = await prisma.itemUsageLog.findMany({
    where: { userId },
    include: { item: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return {
    user: { id: user.id, email: user.email, name: user.name },
    logs: rows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      itemCode: r.item.code,
      itemName: r.item.name,
      quantity: r.quantity,
      reason: r.reason,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      createdAt: r.createdAt,
    })),
  };
}

/**
 * アイテム一覧（管理用）。テストユーザー1のみ。
 */
export async function getAdminItemList(): Promise<AdminItemRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.item.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      skillId: true,
      consumableEffect: true,
      maxCarryPerExpedition: true,
      maxOwnedPerUser: true,
      marketListable: true,
      marketMinPricePerUnit: true,
      marketMinQuantity: true,
      skill: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    skillId: r.skillId,
    skillName: r.skill?.name ?? null,
    consumableEffect: r.consumableEffect,
    maxCarryPerExpedition: r.maxCarryPerExpedition,
    maxOwnedPerUser: r.maxOwnedPerUser,
    marketListable: r.marketListable,
    marketMinPricePerUnit: r.marketMinPricePerUnit,
    marketMinQuantity: r.marketMinQuantity,
  }));
}

/** アイテムマスタ画面用：装備型（EquipmentType）の名前のみ編集。 */
export type AdminEquipmentTypeRow = { id: string; code: string; name: string };

export async function getAdminEquipmentTypeListForItemMaster(): Promise<
  AdminEquipmentTypeRow[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.equipmentType.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  return rows;
}

export async function updateAdminEquipmentTypeName(
  id: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "name は必須です。" };
  const exists = await prisma.equipmentType.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return { success: false, error: "装備型が見つかりません。" };
  await prisma.equipmentType.update({
    where: { id },
    data: { name: trimmed },
  });
  return { success: true };
}

/**
 * 装備型を削除する。装備個体は削除・装着は外し、クラフトレシピの出力は null にする。
 */
export async function deleteAdminEquipmentType(
  equipmentTypeId: string
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const et = await prisma.equipmentType.findUnique({
    where: { id: equipmentTypeId },
    select: { id: true, code: true, name: true },
  });
  if (!et) return { success: false, error: "装備型が見つかりません。" };

  const instances = await prisma.equipmentInstance.findMany({
    where: { equipmentTypeId },
    select: { id: true },
  });
  for (const inst of instances) {
    await prisma.characterEquipment.updateMany({
      where: { equipmentInstanceId: inst.id },
      data: { equipmentInstanceId: null },
    });
  }
  await prisma.equipmentInstance.deleteMany({ where: { equipmentTypeId } });
  await prisma.craftRecipe.updateMany({
    where: { outputEquipmentTypeId: equipmentTypeId },
    data: { outputEquipmentTypeId: null },
  });
  await prisma.equipmentType.delete({ where: { id: equipmentTypeId } });
  return { success: true };
}

export type AdminItemDetail = AdminItemRow;

/**
 * 1件取得（編集フォーム用）。テストユーザー1のみ。
 */
export async function getAdminItem(itemId: string): Promise<AdminItemDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      skillId: true,
      consumableEffect: true,
      maxCarryPerExpedition: true,
      maxOwnedPerUser: true,
      marketListable: true,
      marketMinPricePerUnit: true,
      marketMinQuantity: true,
      skill: { select: { name: true } },
    },
  });
  if (!item) return null;
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    category: item.category,
    skillId: item.skillId,
    skillName: item.skill?.name ?? null,
    consumableEffect: item.consumableEffect,
    maxCarryPerExpedition: item.maxCarryPerExpedition,
    maxOwnedPerUser: item.maxOwnedPerUser,
    marketListable: item.marketListable,
    marketMinPricePerUnit: item.marketMinPricePerUnit,
    marketMinQuantity: item.marketMinQuantity,
  };
}

/**
 * スキル一覧（skill_book の skillId 選択用）。テストユーザー1のみ。
 */
export async function getAdminSkillsForItem(): Promise<
  { id: string; name: string; category: string }[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.skill.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true },
  });
}

// --- スキル編集（表示用・効果は既存のみ選択可）---

export type AdminSkillRow = {
  id: string;
  name: string;
  category: string;
  battleSkillType: string | null;
};

export async function getAdminSkillList(): Promise<AdminSkillRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.skill.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, battleSkillType: true },
  });
}

/** spec/055: 称号マスタ一覧（開拓任務の報酬称号選択などで使用） */
export type AdminTitleRow = {
  id: string;
  code: string;
  name: string;
};

export async function getAdminTitleList(): Promise<AdminTitleRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.title.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true },
  });
}

/** DB に実際に存在する effectType のみ返す（慎重に扱うため新規は選べない） */
export async function getExistingSkillEffectTypes(): Promise<
  { effectType: string; label: string; description: string }[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.skillEffect.findMany({
    select: { effectType: true },
    distinct: ["effectType"],
    orderBy: { effectType: "asc" },
  });
  const info = SKILL_EFFECT_TYPE_INFO;
  return rows.map((r) => {
    const i = info[r.effectType];
    return {
      effectType: r.effectType,
      label: i?.label ?? r.effectType,
      description: i?.description ?? "（説明未登録）",
    };
  });
}

export type AdminSkillEffectRow = {
  id: string;
  effectType: string;
  param: unknown;
};

export type AdminSkillEditData = {
  skill: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    battleSkillType: string | null;
    mpCostCapCoef: number | null;
    mpCostFlat: number | null;
    chargeCycles: number | null;
    cooldownCycles: number | null;
    powerMultiplier: number | null;
    hitsMin: number | null;
    hitsMax: number | null;
    resampleTargetPerHit: boolean | null;
    targetScope: string | null;
    attribute: string | null;
    weightAddFront: number | null;
    weightAddMid: number | null;
    weightAddBack: number | null;
    logMessage: string | null;
    logMessageOnCondition: string | null;
  };
  skillEffects: AdminSkillEffectRow[];
  /** 選択可能な効果タイプ（DB に存在するもののみ） */
  effectTypeOptions: { effectType: string; label: string; description: string }[];
  /** 全効果タイプの説明（参照表示用） */
  effectTypeInfo: Record<string, { label: string; description: string }>;
};

export async function getAdminSkillEditData(
  skillId: string
): Promise<AdminSkillEditData | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const [skill, effectTypeOptions] = await Promise.all([
    prisma.skill.findUnique({
      where: { id: skillId },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        battleSkillType: true,
        mpCostCapCoef: true,
        mpCostFlat: true,
        chargeCycles: true,
        cooldownCycles: true,
        powerMultiplier: true,
        hitsMin: true,
        hitsMax: true,
        resampleTargetPerHit: true,
        targetScope: true,
        attribute: true,
        weightAddFront: true,
        weightAddMid: true,
        weightAddBack: true,
        logMessage: true,
        logMessageOnCondition: true,
        skillEffects: { select: { id: true, effectType: true, param: true } },
      },
    }),
    getExistingSkillEffectTypes(),
  ]);
  if (!skill || !effectTypeOptions) return null;
  const decimalToNum = (v: unknown) => (v != null ? Number(v) : null);
  return {
    skill: {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      description: skill.description,
      battleSkillType: skill.battleSkillType,
      mpCostCapCoef: decimalToNum(skill.mpCostCapCoef),
      mpCostFlat: skill.mpCostFlat,
      chargeCycles: skill.chargeCycles,
      cooldownCycles: skill.cooldownCycles,
      powerMultiplier: decimalToNum(skill.powerMultiplier),
      hitsMin: skill.hitsMin,
      hitsMax: skill.hitsMax,
      resampleTargetPerHit: skill.resampleTargetPerHit,
      targetScope: skill.targetScope,
      attribute: skill.attribute,
      weightAddFront: decimalToNum(skill.weightAddFront),
      weightAddMid: decimalToNum(skill.weightAddMid),
      weightAddBack: decimalToNum(skill.weightAddBack),
      logMessage: skill.logMessage,
      logMessageOnCondition: skill.logMessageOnCondition,
    },
    skillEffects: skill.skillEffects.map((e) => ({
      id: e.id,
      effectType: e.effectType,
      param: e.param,
    })),
    effectTypeOptions,
    effectTypeInfo: SKILL_EFFECT_TYPE_INFO,
  };
}

export type UpdateAdminSkillInput = {
  name: string;
  category: string;
  description: string | null;
  battleSkillType: string | null;
  mpCostCapCoef: number | null;
  mpCostFlat: number | null;
  chargeCycles: number | null;
  cooldownCycles: number | null;
  powerMultiplier: number | null;
  hitsMin: number | null;
  hitsMax: number | null;
  resampleTargetPerHit: boolean | null;
  targetScope: string | null;
  attribute: string | null;
  weightAddFront: number | null;
  weightAddMid: number | null;
  weightAddBack: number | null;
  logMessage: string | null;
  logMessageOnCondition: string | null;
  skillEffects: { effectType: string; param: unknown }[];
};

export async function updateAdminSkill(
  skillId: string,
  input: UpdateAdminSkillInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    select: { id: true },
  });
  if (!skill) return { success: false, error: "スキルが見つかりません。" };

  const allowedTypes = await prisma.skillEffect.findMany({
    select: { effectType: true },
    distinct: ["effectType"],
  });
  const allowedSet = new Set(allowedTypes.map((r) => r.effectType));
  const effects = (input.skillEffects ?? []).filter((e) => {
    if (!e.effectType?.trim()) return false;
    if (!allowedSet.has(e.effectType.trim())) return false;
    return true;
  });

  const name = input.name.trim();
  if (!name) return { success: false, error: "name は必須です。" };

  await prisma.$transaction(async (tx) => {
    await tx.skill.update({
      where: { id: skillId },
      data: {
        name,
        category: input.category.trim() || "battle_active",
        description: input.description?.trim() || null,
        battleSkillType: input.battleSkillType?.trim() || null,
        mpCostCapCoef: input.mpCostCapCoef != null ? input.mpCostCapCoef : null,
        mpCostFlat: input.mpCostFlat ?? null,
        chargeCycles: input.chargeCycles ?? null,
        cooldownCycles: input.cooldownCycles ?? null,
        powerMultiplier: input.powerMultiplier != null ? input.powerMultiplier : null,
        hitsMin: input.hitsMin ?? null,
        hitsMax: input.hitsMax ?? null,
        resampleTargetPerHit: input.resampleTargetPerHit ?? null,
        targetScope: input.targetScope?.trim() || null,
        attribute: input.attribute?.trim() || null,
        weightAddFront: input.weightAddFront != null ? input.weightAddFront : null,
        weightAddMid: input.weightAddMid != null ? input.weightAddMid : null,
        weightAddBack: input.weightAddBack != null ? input.weightAddBack : null,
        logMessage: input.logMessage?.trim() || null,
        logMessageOnCondition: input.logMessageOnCondition?.trim() || null,
      },
    });
    await tx.skillEffect.deleteMany({ where: { skillId } });
    if (effects.length > 0) {
      await tx.skillEffect.createMany({
        data: effects.map((e) => ({
          skillId,
          effectType: e.effectType.trim(),
          param: (e.param as object) ?? undefined,
        })),
      });
    }
  });
  return { success: true };
}

export type UpdateAdminItemInput = {
  code: string;
  name: string;
  category: string;
  skillId: string | null;
  /** JSON 文字列。空は null 扱い。 */
  consumableEffectJson: string | null;
  maxCarryPerExpedition: number | null;
  /** ユーザー別所持数上限。null は上限なし。 */
  maxOwnedPerUser: number | null;
  /** spec/075: 市場出品可 */
  marketListable: boolean;
  /** spec/075: 出品単価下限。null でグローバル定数使用。 */
  marketMinPricePerUnit: number | null;
  /** spec/075: 出品数量下限。null でグローバル定数使用。 */
  marketMinQuantity: number | null;
};

export async function updateAdminItem(
  itemId: string,
  input: UpdateAdminItemInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) return { success: false, error: "アイテムが見つかりません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  if (!ITEM_CATEGORIES.includes(input.category as "material" | "consumable" | "blueprint" | "skill_book" | "special")) {
    return { success: false, error: "不正な category です。" };
  }

  let consumableEffect: unknown = null;
  if (input.consumableEffectJson != null && input.consumableEffectJson.trim() !== "") {
    try {
      consumableEffect = JSON.parse(input.consumableEffectJson) as unknown;
    } catch {
      return { success: false, error: "consumableEffect は有効な JSON で入力してください。" };
    }
  }

  const maxCarry =
    input.maxCarryPerExpedition != null && Number.isInteger(input.maxCarryPerExpedition) && input.maxCarryPerExpedition >= 0
      ? input.maxCarryPerExpedition
      : null;

  const maxOwned =
    input.maxOwnedPerUser != null && Number.isInteger(input.maxOwnedPerUser) && input.maxOwnedPerUser >= 0
      ? input.maxOwnedPerUser
      : null;

  const marketMinPrice =
    input.marketMinPricePerUnit != null &&
    Number.isInteger(input.marketMinPricePerUnit) &&
    input.marketMinPricePerUnit >= 0
      ? input.marketMinPricePerUnit
      : null;
  const marketMinQty =
    input.marketMinQuantity != null &&
    Number.isInteger(input.marketMinQuantity) &&
    input.marketMinQuantity >= 0
      ? input.marketMinQuantity
      : null;

  const skillId = input.skillId?.trim() || null;
  if (input.category === "skill_book" && !skillId) {
    return { success: false, error: "スキル分析書の場合は skillId を選択してください。" };
  }

  await prisma.item.update({
    where: { id: itemId },
    data: {
      code,
      name,
      category: input.category,
      skillId,
      consumableEffect:
        consumableEffect === null
          ? Prisma.JsonNull
          : (consumableEffect as Prisma.InputJsonValue),
      maxCarryPerExpedition: maxCarry,
      maxOwnedPerUser: maxOwned,
      marketListable: input.marketListable,
      marketMinPricePerUnit: marketMinPrice,
      marketMinQuantity: marketMinQty,
    },
  });
  return { success: true };
}

/** 一覧画面で編集可能な項目のみ。一括保存用。 */
export type AdminItemListUpdateRow = {
  id: string;
  name: string;
  category: string;
  skillId: string | null;
  maxCarryPerExpedition: number | null;
  maxOwnedPerUser: number | null;
  marketListable: boolean;
  marketMinPricePerUnit: number | null;
  marketMinQuantity: number | null;
};

/**
 * 一覧画面から一括更新。表示項目のみ更新（code / consumableEffect は触らない）。テストユーザー1のみ。
 */
export async function bulkUpdateAdminItems(
  rows: AdminItemListUpdateRow[]
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const updates: { row: AdminItemListUpdateRow; data: Record<string, unknown> }[] = [];
  for (const row of rows) {
    const name = row.name?.trim() ?? "";
    if (!name) return { success: false, error: `id=${row.id}: name は必須です。` };
    if (!ITEM_CATEGORIES.includes(row.category as "material" | "consumable" | "blueprint" | "skill_book" | "special")) {
      return { success: false, error: `id=${row.id}: 不正な category です。` };
    }
    if (row.category === "skill_book" && !(row.skillId?.trim())) {
      return { success: false, error: `id=${row.id}: スキル分析書の場合は skillId を選択してください。` };
    }
    const maxCarry =
      row.maxCarryPerExpedition != null && Number.isInteger(row.maxCarryPerExpedition) && row.maxCarryPerExpedition >= 0
        ? row.maxCarryPerExpedition
        : null;
    const maxOwned =
      row.maxOwnedPerUser != null && Number.isInteger(row.maxOwnedPerUser) && row.maxOwnedPerUser >= 0
        ? row.maxOwnedPerUser
        : null;
    const marketMinPrice =
      row.marketMinPricePerUnit != null &&
      Number.isInteger(row.marketMinPricePerUnit) &&
      row.marketMinPricePerUnit >= 0
        ? row.marketMinPricePerUnit
        : null;
    const marketMinQty =
      row.marketMinQuantity != null &&
      Number.isInteger(row.marketMinQuantity) &&
      row.marketMinQuantity >= 0
        ? row.marketMinQuantity
        : null;
    const skillId = row.skillId?.trim() || null;
    updates.push({
      row,
      data: {
        name,
        category: row.category,
        skillId,
        maxCarryPerExpedition: maxCarry,
        maxOwnedPerUser: maxOwned,
        marketListable: row.marketListable,
        marketMinPricePerUnit: marketMinPrice,
        marketMinQuantity: marketMinQty,
      },
    });
  }

  await prisma.$transaction(
    updates.map(({ row, data }) =>
      prisma.item.update({ where: { id: row.id }, data: data as Prisma.ItemUpdateInput })
    )
  );
  return { success: true };
}

export type CreateAdminItemInput = UpdateAdminItemInput;

/**
 * 新規アイテムを作成。テストユーザー1のみ。成功時は itemId を返す。
 */
export async function createAdminItem(
  input: CreateAdminItemInput
): Promise<{ success: boolean; error?: string; itemId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  if (!ITEM_CATEGORIES.includes(input.category as "material" | "consumable" | "blueprint" | "skill_book" | "special")) {
    return { success: false, error: "不正な category です。" };
  }

  const existing = await prisma.item.findUnique({ where: { code }, select: { id: true } });
  if (existing) return { success: false, error: "この code は既に使用されています。" };

  let consumableEffect: unknown = null;
  if (input.consumableEffectJson != null && input.consumableEffectJson.trim() !== "") {
    try {
      consumableEffect = JSON.parse(input.consumableEffectJson) as unknown;
    } catch {
      return { success: false, error: "consumableEffect は有効な JSON で入力してください。" };
    }
  }

  const maxCarry =
    input.maxCarryPerExpedition != null && Number.isInteger(input.maxCarryPerExpedition) && input.maxCarryPerExpedition >= 0
      ? input.maxCarryPerExpedition
      : null;

  const maxOwned =
    input.maxOwnedPerUser != null && Number.isInteger(input.maxOwnedPerUser) && input.maxOwnedPerUser >= 0
      ? input.maxOwnedPerUser
      : null;

  const marketMinPrice =
    input.marketMinPricePerUnit != null &&
    Number.isInteger(input.marketMinPricePerUnit) &&
    input.marketMinPricePerUnit >= 0
      ? input.marketMinPricePerUnit
      : null;
  const marketMinQty =
    input.marketMinQuantity != null &&
    Number.isInteger(input.marketMinQuantity) &&
    input.marketMinQuantity >= 0
      ? input.marketMinQuantity
      : null;

  const skillId = input.skillId?.trim() || null;
  if (input.category === "skill_book" && !skillId) {
    return { success: false, error: "スキル分析書の場合は skillId を選択してください。" };
  }

  const created = await prisma.item.create({
    data: {
      code,
      name,
      category: input.category,
      skillId,
      consumableEffect:
        consumableEffect === null
          ? Prisma.JsonNull
          : (consumableEffect as Prisma.InputJsonValue),
      maxCarryPerExpedition: maxCarry,
      maxOwnedPerUser: maxOwned,
      marketListable: input.marketListable,
      marketMinPricePerUnit: marketMinPrice,
      marketMinQuantity: marketMinQty,
    },
    select: { id: true },
  });
  return { success: true, itemId: created.id };
}

/**
 * アイテムを削除。参照（所持・レシピ・ドロップ・研究コスト・設備レシピなど）がある場合は削除不可。
 */
export async function deleteAdminItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, code: true, name: true },
  });
  if (!item) return { success: false, error: "アイテムが見つかりません。" };

  const [inv, recipeInput, drop, research, facilityRecipe, recipeOutput, recipeInputCount] =
    await Promise.all([
      prisma.userInventory.count({ where: { itemId } }),
      prisma.craftRecipeInput.count({ where: { itemId } }),
      prisma.dropTableEntry.count({ where: { itemId } }),
      prisma.researchUnlockCost.count({ where: { itemId } }),
      prisma.facilityTypeConstructionInput.count({ where: { itemId } }),
      prisma.recipe.count({ where: { outputItemId: itemId } }),
      prisma.recipeInput.count({ where: { itemId } }),
    ]);

  const blocks: string[] = [];
  if (inv > 0) blocks.push(`所持アイテム（${inv}件）`);
  if (recipeInput > 0) blocks.push(`クラフトレシピ素材（${recipeInput}件）`);
  if (drop > 0) blocks.push(`ドロップテーブル（${drop}件）`);
  if (research > 0) blocks.push(`研究解放コスト（${research}件）`);
  if (facilityRecipe > 0) blocks.push(`設備建設レシピ（${facilityRecipe}件）`);
  if (recipeOutput > 0) blocks.push(`レシピ出力（${recipeOutput}件）`);
  if (recipeInputCount > 0) blocks.push(`レシピ素材（${recipeInputCount}件）`);

  if (blocks.length > 0) {
    return {
      success: false,
      error: `削除できません。${blocks.join("・")}で参照されています。`,
    };
  }

  await prisma.item.delete({ where: { id: itemId } });
  return { success: true };
}

// --- クラフトレシピ編集（spec/046）---

export type AdminCraftRecipeRow = {
  id: string;
  code: string;
  name: string;
  outputKind: string;
  outputName: string | null;
};

export type AdminCraftRecipeInputRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  amount: number;
};

/** 編集フォーム用：出力装備の詳細（CAP・ウェイト含む） */
export type AdminEquipmentOutputDetail = {
  id: string;
  code: string;
  name: string;
  slot: string;
  statGenConfig: EquipmentStatGenConfig | null;
};

/** 編集フォーム用：出力メカパーツの詳細（CAP・ウェイト・フレーム補正含む） */
export type AdminMechaPartOutputDetail = {
  id: string;
  name: string;
  slot: string;
  statRates: Record<string, number> | null;
  statGenConfig: MechaPartStatGenConfig | null;
  strAdd: number;
  intAdd: number;
  vitAdd: number;
  wisAdd: number;
  dexAdd: number;
  agiAdd: number;
  lukAdd: number;
  capAdd: number;
};

export type AdminCraftRecipeDetail = AdminCraftRecipeRow & {
  outputEquipmentTypeId: string | null;
  outputMechaPartTypeId: string | null;
  outputItemId: string | null;
  /** outputKind=equipment のときのみ */
  outputEquipmentType: AdminEquipmentOutputDetail | null;
  /** outputKind=mecha_part のときのみ */
  outputMechaPartType: AdminMechaPartOutputDetail | null;
  inputs: AdminCraftRecipeInputRow[];
};

/** 選択肢用：装備種別の詳細（編集フォームで「既存を選択」した装備の設定を変えるため） */
export type AdminEquipmentTypeOption = AdminEquipmentOutputDetail;

/** 選択肢用：メカパーツ種別の詳細 */
export type AdminMechaPartTypeOption = AdminMechaPartOutputDetail;

export type AdminCraftRecipeOptions = {
  items: { id: string; code: string; name: string }[];
  equipmentTypes: AdminEquipmentTypeOption[];
  mechaPartTypes: AdminMechaPartTypeOption[];
};

export async function getAdminCraftRecipeList(): Promise<AdminCraftRecipeRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.craftRecipe.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      outputKind: true,
      outputEquipmentType: { select: { name: true } },
      outputMechaPartType: { select: { name: true } },
      outputItem: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    outputKind: r.outputKind,
    outputName:
      r.outputEquipmentType?.name ?? r.outputMechaPartType?.name ?? r.outputItem?.name ?? null,
  }));
}

export async function getAdminCraftRecipe(
  craftRecipeId: string
): Promise<AdminCraftRecipeDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const r = await prisma.craftRecipe.findUnique({
    where: { id: craftRecipeId },
    select: {
      id: true,
      code: true,
      name: true,
      outputKind: true,
      outputEquipmentTypeId: true,
      outputMechaPartTypeId: true,
      outputItemId: true,
      outputEquipmentType: {
        select: { id: true, code: true, name: true, slot: true, statGenConfig: true },
      },
      outputMechaPartType: {
        select: {
          id: true,
          name: true,
          slot: true,
          statRates: true,
          statGenConfig: true,
          strAdd: true,
          intAdd: true,
          vitAdd: true,
          wisAdd: true,
          dexAdd: true,
          agiAdd: true,
          lukAdd: true,
          capAdd: true,
        },
      },
      outputItem: { select: { name: true } },
      inputs: { include: { item: { select: { id: true, code: true, name: true } } } },
    },
  });
  if (!r) return null;

  let outputEquipmentType: AdminEquipmentOutputDetail | null = null;
  if (r.outputEquipmentType) {
    const et = r.outputEquipmentType;
    outputEquipmentType = {
      id: et.id,
      code: et.code,
      name: et.name,
      slot: et.slot,
      statGenConfig: parseEquipmentStatGenConfig(et.statGenConfig),
    };
  }

  let outputMechaPartType: AdminMechaPartOutputDetail | null = null;
  if (r.outputMechaPartType) {
    const mp = r.outputMechaPartType;
    const statRates =
      mp.statRates && typeof mp.statRates === "object" && !Array.isArray(mp.statRates)
        ? (mp.statRates as Record<string, number>)
        : null;
    outputMechaPartType = {
      id: mp.id,
      name: mp.name,
      slot: mp.slot,
      statRates,
      statGenConfig: parseMechaPartStatGenConfig(mp.statGenConfig),
      strAdd: mp.strAdd ?? 0,
      intAdd: mp.intAdd ?? 0,
      vitAdd: mp.vitAdd ?? 0,
      wisAdd: mp.wisAdd ?? 0,
      dexAdd: mp.dexAdd ?? 0,
      agiAdd: mp.agiAdd ?? 0,
      lukAdd: mp.lukAdd ?? 0,
      capAdd: mp.capAdd ?? 0,
    };
  }

  return {
    id: r.id,
    code: r.code,
    name: r.name,
    outputKind: r.outputKind,
    outputName:
      r.outputEquipmentType?.name ?? r.outputMechaPartType?.name ?? r.outputItem?.name ?? null,
    outputEquipmentTypeId: r.outputEquipmentTypeId,
    outputMechaPartTypeId: r.outputMechaPartTypeId,
    outputItemId: r.outputItemId,
    outputEquipmentType,
    outputMechaPartType,
    inputs: r.inputs.map((inp) => ({
      itemId: inp.itemId,
      itemCode: inp.item.code,
      itemName: inp.item.name,
      amount: inp.amount,
    })),
  };
}

export async function getAdminCraftRecipeOptions(): Promise<AdminCraftRecipeOptions | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const [items, equipmentRows, mechaPartRows] = await Promise.all([
    prisma.item.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.equipmentType.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, slot: true, statGenConfig: true },
    }),
    prisma.mechaPartType.findMany({
      orderBy: { slot: "asc" },
      select: {
        id: true,
        name: true,
        slot: true,
        statRates: true,
        statGenConfig: true,
        strAdd: true,
        intAdd: true,
        vitAdd: true,
        wisAdd: true,
        dexAdd: true,
        agiAdd: true,
        lukAdd: true,
        capAdd: true,
      },
    }),
  ]);
  const equipmentTypes: AdminEquipmentTypeOption[] = equipmentRows.map((et) => ({
    id: et.id,
    code: et.code,
    name: et.name,
    slot: et.slot,
    statGenConfig: parseEquipmentStatGenConfig(et.statGenConfig),
  }));
  const mechaPartTypes: AdminMechaPartTypeOption[] = mechaPartRows.map((mp) => {
    const statRates =
      mp.statRates && typeof mp.statRates === "object" && !Array.isArray(mp.statRates)
        ? (mp.statRates as Record<string, number>)
        : null;
    return {
      id: mp.id,
      name: mp.name,
      slot: mp.slot,
      statRates,
      statGenConfig: parseMechaPartStatGenConfig(mp.statGenConfig),
      strAdd: mp.strAdd ?? 0,
      intAdd: mp.intAdd ?? 0,
      vitAdd: mp.vitAdd ?? 0,
      wisAdd: mp.wisAdd ?? 0,
      dexAdd: mp.dexAdd ?? 0,
      agiAdd: mp.agiAdd ?? 0,
      lukAdd: mp.lukAdd ?? 0,
      capAdd: mp.capAdd ?? 0,
    };
  });
  return { items, equipmentTypes, mechaPartTypes };
}

/** 装備のステ生成設定（フォーム送信用） */
export type AdminEquipmentStatGenInput = {
  capMin: number;
  capMax: number;
  weights: { key: string; weightMin: number; weightMax: number }[];
};

/** メカパーツのステ生成設定（フォーム送信用） */
export type AdminMechaPartStatGenInput = {
  capMin: number;
  capMax: number;
  weights: { key: string; weightMin: number; weightMax: number }[];
};

/** 出力装備の編集用（既存装備の CAP/ウェイト・code/name/slot を更新） */
export type AdminEquipmentOutputInput = {
  code: string;
  name: string;
  slot: string;
  statGenConfig: AdminEquipmentStatGenInput;
};

/** 出力メカパーツの編集用（既存メカの CAP/ウェイト・補正・フラット加算を更新） */
export type AdminMechaPartOutputInput = {
  name: string;
  slot: string;
  statRates: Record<string, number> | null;
  statGenConfig: AdminMechaPartStatGenInput;
  strAdd: number;
  intAdd: number;
  vitAdd: number;
  wisAdd: number;
  dexAdd: number;
  agiAdd: number;
  lukAdd: number;
  capAdd: number;
};

export type UpdateAdminCraftRecipeInput = {
  code: string;
  name: string;
  outputKind: "equipment" | "mecha_part" | "item";
  outputEquipmentTypeId: string | null;
  outputMechaPartTypeId: string | null;
  outputItemId: string | null;
  inputs: { itemId: string; amount: number }[];
  /** 装備出力時：指定するとその装備種別の code/name/slot/statGenConfig を更新 */
  equipmentOutput?: AdminEquipmentOutputInput;
  /** メカパーツ出力時：指定するとそのメカパーツ種別の設定を更新 */
  mechaPartOutput?: AdminMechaPartOutputInput;
};

export async function updateAdminCraftRecipe(
  craftRecipeId: string,
  input: UpdateAdminCraftRecipeInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const recipe = await prisma.craftRecipe.findUnique({
    where: { id: craftRecipeId },
    select: { id: true },
  });
  if (!recipe) return { success: false, error: "レシピが見つかりません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  const validKinds = ["equipment", "mecha_part", "item"] as const;
  if (!validKinds.includes(input.outputKind)) {
    return { success: false, error: "outputKind は equipment / mecha_part / item のいずれかです。" };
  }
  const outputEquipmentTypeId =
    input.outputKind === "equipment" ? (input.outputEquipmentTypeId?.trim() || null) : null;
  const outputMechaPartTypeId =
    input.outputKind === "mecha_part" ? (input.outputMechaPartTypeId?.trim() || null) : null;
  const outputItemId =
    input.outputKind === "item" ? (input.outputItemId?.trim() || null) : null;
  if (input.outputKind === "equipment" && !outputEquipmentTypeId) {
    return { success: false, error: "出力が装備の場合は outputEquipmentTypeId を選択してください。" };
  }
  if (input.outputKind === "mecha_part" && !outputMechaPartTypeId) {
    return { success: false, error: "出力がメカパーツの場合は outputMechaPartTypeId を選択してください。" };
  }
  if (input.outputKind === "item" && !outputItemId) {
    return { success: false, error: "出力がアイテムの場合は outputItemId を選択してください。" };
  }
  const rawInputs = input.inputs.filter((row) => row.itemId.trim() && row.amount > 0);
  if (rawInputs.length === 0) return { success: false, error: "入力素材を1件以上登録してください。" };
  const merged = new Map<string, number>();
  for (const row of rawInputs) {
    merged.set(row.itemId, (merged.get(row.itemId) ?? 0) + row.amount);
  }
  const inputs = Array.from(merged.entries(), ([itemId, amount]) => ({ itemId, amount }));

  if (input.outputKind === "equipment" && input.equipmentOutput && outputEquipmentTypeId) {
    if (!isEquipmentSlot(input.equipmentOutput.slot)) {
      return { success: false, error: "装備の slot が不正です。" };
    }
    const err = validateEquipmentStatGenInput(input.equipmentOutput.statGenConfig);
    if (err) return { success: false, error: err };
  }
  if (input.outputKind === "mecha_part" && input.mechaPartOutput && outputMechaPartTypeId) {
    if (!isMechaSlot(input.mechaPartOutput.slot)) {
      return { success: false, error: "メカパーツの slot が不正です。" };
    }
    const err = validateMechaPartStatGenInput(input.mechaPartOutput.statGenConfig);
    if (err) return { success: false, error: err };
  }

  await prisma.$transaction(async (tx) => {
    if (input.outputKind === "equipment" && input.equipmentOutput && outputEquipmentTypeId) {
      const cfg = input.equipmentOutput.statGenConfig;
      await tx.equipmentType.update({
        where: { id: outputEquipmentTypeId },
        data: {
          code: input.equipmentOutput.code.trim(),
          name: input.equipmentOutput.name.trim(),
          slot: input.equipmentOutput.slot,
          statGenConfig: {
            capMin: cfg.capMin,
            capMax: cfg.capMax,
            weights: cfg.weights,
          } as Prisma.InputJsonValue,
        },
      });
    }
    if (input.outputKind === "mecha_part" && input.mechaPartOutput && outputMechaPartTypeId) {
      const out = input.mechaPartOutput;
      const statRatesJson =
        out.statRates && Object.keys(out.statRates).length > 0
          ? (out.statRates as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      await tx.mechaPartType.update({
        where: { id: outputMechaPartTypeId },
        data: {
          name: out.name.trim(),
          slot: out.slot,
          statRates: statRatesJson,
          statGenConfig: {
            capMin: out.statGenConfig.capMin,
            capMax: out.statGenConfig.capMax,
            weights: out.statGenConfig.weights,
          } as Prisma.InputJsonValue,
          strAdd: out.strAdd,
          intAdd: out.intAdd,
          vitAdd: out.vitAdd,
          wisAdd: out.wisAdd,
          dexAdd: out.dexAdd,
          agiAdd: out.agiAdd,
          lukAdd: out.lukAdd,
          capAdd: out.capAdd,
        },
      });
    }
    await tx.craftRecipeInput.deleteMany({ where: { craftRecipeId } });
    await tx.craftRecipe.update({
      where: { id: craftRecipeId },
      data: {
        code,
        name,
        outputKind: input.outputKind,
        outputEquipmentTypeId,
        outputMechaPartTypeId,
        outputItemId,
      },
    });
    for (const row of inputs) {
      await tx.craftRecipeInput.create({
        data: {
          craftRecipeId,
          itemId: row.itemId,
          amount: row.amount,
        },
      });
    }
  });
  return { success: true };
}

/**
 * クラフトレシピを削除する。参照ごと削除する。
 * - CraftRecipeInput, UserCraftRecipeUnlock は Cascade で削除される。
 * - ResearchGroupItem, ResearchUnlockCost（targetType=craft_recipe, targetId=id）を明示削除。
 */
export async function deleteAdminCraftRecipe(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const recipe = await prisma.craftRecipe.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  });
  if (!recipe) return { success: false, error: "クラフトレシピが見つかりません。" };

  await prisma.$transaction(async (tx) => {
    await tx.researchGroupItem.deleteMany({
      where: { targetType: "craft_recipe", targetId: id },
    });
    await tx.researchUnlockCost.deleteMany({
      where: { targetType: "craft_recipe", targetId: id },
    });
    await tx.craftRecipe.delete({ where: { id } });
  });
  return { success: true };
}

function validateEquipmentStatGenInput(
  cfg: AdminEquipmentStatGenInput
): string | null {
  if (!Number.isInteger(cfg.capMin) || !Number.isInteger(cfg.capMax) || cfg.capMin > cfg.capMax) {
    return "装備の CAP は capMin ≤ capMax の整数で入力してください。";
  }
  if (!cfg.weights?.length) return "装備のステータス重みを1件以上登録してください。";
  const validKeys = new Set<string>(EQUIPMENT_STAT_KEYS);
  for (const w of cfg.weights) {
    if (!validKeys.has(w.key)) return `装備の重み key は ${EQUIPMENT_STAT_KEYS.join("/")} のいずれかにしてください。`;
    if (
      !Number.isInteger(w.weightMin) ||
      !Number.isInteger(w.weightMax) ||
      w.weightMin < 0 ||
      w.weightMax < w.weightMin
    ) {
      return "装備の重みは 0 以上の整数で weightMin ≤ weightMax にしてください。";
    }
  }
  return null;
}

function validateMechaPartStatGenInput(
  cfg: AdminMechaPartStatGenInput
): string | null {
  if (!Number.isInteger(cfg.capMin) || !Number.isInteger(cfg.capMax) || cfg.capMin > cfg.capMax) {
    return "メカパーツの CAP は capMin ≤ capMax の整数で入力してください。";
  }
  if (!cfg.weights?.length) return "メカパーツのステータス重みを1件以上登録してください。";
  const validKeys = new Set(["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"]);
  for (const w of cfg.weights) {
    if (!validKeys.has(w.key)) return `メカパーツの重み key は STR/INT/VIT/WIS/DEX/AGI/LUK のいずれかにしてください。`;
    if (
      !Number.isInteger(w.weightMin) ||
      !Number.isInteger(w.weightMax) ||
      w.weightMin < 0 ||
      w.weightMax < w.weightMin
    ) {
      return "メカパーツの重みは 0 以上の整数で weightMin ≤ weightMax にしてください。";
    }
  }
  return null;
}

/** 新規装備を作成してレシピに紐づけるときの入力 */
export type AdminEquipmentNewInput = {
  code: string;
  name: string;
  slot: string;
  statGenConfig: AdminEquipmentStatGenInput;
};

/** 新規メカパーツを作成してレシピに紐づけるときの入力 */
export type AdminMechaPartNewInput = {
  name: string;
  slot: string;
  statRates: Record<string, number> | null;
  statGenConfig: AdminMechaPartStatGenInput;
  strAdd: number;
  intAdd: number;
  vitAdd: number;
  wisAdd: number;
  dexAdd: number;
  agiAdd: number;
  lukAdd: number;
  capAdd: number;
};

export type CreateAdminCraftRecipeInput = UpdateAdminCraftRecipeInput & {
  /** 装備出力時：指定すると新規 EquipmentType を作成し、その ID をレシピに紐づける */
  equipmentNew?: AdminEquipmentNewInput;
  /** メカパーツ出力時：指定すると新規 MechaPartType を作成し、その ID をレシピに紐づける */
  mechaPartNew?: AdminMechaPartNewInput;
};

export async function createAdminCraftRecipe(
  input: CreateAdminCraftRecipeInput
): Promise<{ success: boolean; error?: string; craftRecipeId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.craftRecipe.findUnique({ where: { code }, select: { id: true } });
  if (existing) return { success: false, error: "この code は既に使用されています。" };

  const validKinds = ["equipment", "mecha_part", "item"] as const;
  if (!validKinds.includes(input.outputKind)) {
    return { success: false, error: "outputKind は equipment / mecha_part / item のいずれかです。" };
  }

  let outputEquipmentTypeId: string | null =
    input.outputKind === "equipment" ? (input.outputEquipmentTypeId?.trim() || null) : null;
  let outputMechaPartTypeId: string | null =
    input.outputKind === "mecha_part" ? (input.outputMechaPartTypeId?.trim() || null) : null;
  const outputItemId =
    input.outputKind === "item" ? (input.outputItemId?.trim() || null) : null;

  if (input.outputKind === "equipment") {
    if (input.equipmentNew) {
      if (!isEquipmentSlot(input.equipmentNew.slot)) {
        return { success: false, error: "装備の slot が不正です。" };
      }
      const err = validateEquipmentStatGenInput(input.equipmentNew.statGenConfig);
      if (err) return { success: false, error: err };
      const etCode = input.equipmentNew.code.trim();
      if (!etCode) return { success: false, error: "新規装備の code を入力してください。" };
      const etExisting = await prisma.equipmentType.findUnique({
        where: { code: etCode },
        select: { id: true },
      });
      if (etExisting) return { success: false, error: "この装備 code は既に使用されています。" };
    } else if (!outputEquipmentTypeId) {
      return { success: false, error: "出力が装備の場合は既存を選択するか、新規装備を作成してください。" };
    }
  }
  if (input.outputKind === "mecha_part") {
    if (input.mechaPartNew) {
      if (!isMechaSlot(input.mechaPartNew.slot)) {
        return { success: false, error: "メカパーツの slot が不正です。" };
      }
      const err = validateMechaPartStatGenInput(input.mechaPartNew.statGenConfig);
      if (err) return { success: false, error: err };
    } else if (!outputMechaPartTypeId) {
      return { success: false, error: "出力がメカパーツの場合は既存を選択するか、新規メカパーツを作成してください。" };
    }
  }
  if (input.outputKind === "item" && !outputItemId) {
    return { success: false, error: "出力がアイテムの場合は outputItemId を選択してください。" };
  }

  const rawInputs = input.inputs.filter((row) => row.itemId.trim() && row.amount > 0);
  if (rawInputs.length === 0) return { success: false, error: "入力素材を1件以上登録してください。" };
  const merged = new Map<string, number>();
  for (const row of rawInputs) {
    merged.set(row.itemId, (merged.get(row.itemId) ?? 0) + row.amount);
  }
  const inputs = Array.from(merged.entries(), ([itemId, amount]) => ({ itemId, amount }));

  const created = await prisma.$transaction(async (tx) => {
    if (input.outputKind === "equipment" && input.equipmentNew) {
      const cfg = input.equipmentNew!.statGenConfig;
      const et = await tx.equipmentType.create({
        data: {
          code: input.equipmentNew!.code.trim(),
          name: input.equipmentNew!.name.trim(),
          slot: input.equipmentNew!.slot,
          statGenConfig: {
            capMin: cfg.capMin,
            capMax: cfg.capMax,
            weights: cfg.weights,
          } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      outputEquipmentTypeId = et.id;
    }
    if (input.outputKind === "mecha_part" && input.mechaPartNew) {
      const out = input.mechaPartNew!;
      const statRatesJson =
        out.statRates && Object.keys(out.statRates).length > 0
          ? (out.statRates as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      const mp = await tx.mechaPartType.create({
        data: {
          name: out.name.trim(),
          slot: out.slot,
          statRates: statRatesJson,
          statGenConfig: {
            capMin: out.statGenConfig.capMin,
            capMax: out.statGenConfig.capMax,
            weights: out.statGenConfig.weights,
          } as Prisma.InputJsonValue,
          strAdd: out.strAdd,
          intAdd: out.intAdd,
          vitAdd: out.vitAdd,
          wisAdd: out.wisAdd,
          dexAdd: out.dexAdd,
          agiAdd: out.agiAdd,
          lukAdd: out.lukAdd,
          capAdd: out.capAdd,
        },
        select: { id: true },
      });
      outputMechaPartTypeId = mp.id;
    }

    const recipe = await tx.craftRecipe.create({
      data: {
        code,
        name,
        outputKind: input.outputKind,
        outputEquipmentTypeId,
        outputMechaPartTypeId,
        outputItemId,
      },
      select: { id: true },
    });
    for (const row of inputs) {
      await tx.craftRecipeInput.create({
        data: {
          craftRecipeId: recipe.id,
          itemId: row.itemId,
          amount: row.amount,
        },
      });
    }
    return recipe;
  });
  return { success: true, craftRecipeId: created.id };
}

// --- 設備種別編集（FacilityType, spec/035）---

export type AdminFacilityTypeRow = {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  cost: number;
};

export type AdminFacilityTypeDetail = AdminFacilityTypeRow;

const FACILITY_KINDS = ["resource_exploration", "industrial", "training"] as const;

export async function getAdminFacilityTypeList(): Promise<AdminFacilityTypeRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.facilityType.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true, description: true, cost: true },
  });
  return rows;
}

export async function getAdminFacilityType(
  facilityTypeId: string
): Promise<AdminFacilityTypeDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const row = await prisma.facilityType.findUnique({
    where: { id: facilityTypeId },
    select: { id: true, name: true, kind: true, description: true, cost: true },
  });
  return row;
}

export type UpdateAdminFacilityTypeInput = {
  name: string;
  kind: string;
  description: string | null;
  cost: number;
};

export async function updateAdminFacilityType(
  facilityTypeId: string,
  input: UpdateAdminFacilityTypeInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const ft = await prisma.facilityType.findUnique({
    where: { id: facilityTypeId },
    select: { id: true },
  });
  if (!ft) return { success: false, error: "設備種別が見つかりません。" };

  const name = input.name.trim();
  if (!name) return { success: false, error: "name は必須です。" };
  if (!FACILITY_KINDS.includes(input.kind as (typeof FACILITY_KINDS)[number])) {
    return { success: false, error: "kind は resource_exploration / industrial / training のいずれかです。" };
  }
  const cost =
    typeof input.cost === "number" && Number.isInteger(input.cost) && input.cost >= 0
      ? input.cost
      : 40;

  const existing = await prisma.facilityType.findFirst({
    where: { name, id: { not: facilityTypeId } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この name は既に使用されています。" };

  await prisma.facilityType.update({
    where: { id: facilityTypeId },
    data: {
      name,
      kind: input.kind,
      description: input.description?.trim() || null,
      cost,
    },
  });
  return { success: true };
}

export type CreateAdminFacilityTypeInput = UpdateAdminFacilityTypeInput;

export async function createAdminFacilityType(
  input: CreateAdminFacilityTypeInput
): Promise<{ success: boolean; error?: string; facilityTypeId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const name = input.name.trim();
  if (!name) return { success: false, error: "name は必須です。" };
  if (!FACILITY_KINDS.includes(input.kind as (typeof FACILITY_KINDS)[number])) {
    return { success: false, error: "kind は resource_exploration / industrial / training のいずれかです。" };
  }
  const cost =
    typeof input.cost === "number" && Number.isInteger(input.cost) && input.cost >= 0
      ? input.cost
      : 40;

  const existing = await prisma.facilityType.findUnique({
    where: { name },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この name は既に使用されています。" };

    const created = await prisma.$transaction(async (tx) => {
    const ft = await tx.facilityType.create({
      data: {
        name,
        kind: input.kind,
        description: input.description?.trim() || null,
        cost,
      },
      select: { id: true },
    });
    return ft;
  });
  return { success: true, facilityTypeId: created.id };
}

/**
 * 設備種別を削除する。参照がある場合は削除不可。
 * 参照: FacilityInstance, UserFacilityTypeUnlock, ResearchGroupItem, ResearchUnlockCost
 */
export async function deleteAdminFacilityType(
  facilityTypeId: string
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const ft = await prisma.facilityType.findUnique({
    where: { id: facilityTypeId },
    select: { id: true, name: true },
  });
  if (!ft) return { success: false, error: "設備種別が見つかりません。" };

  const [instanceCount, unlockCount, groupItemCount, unlockCostCount] = await Promise.all([
    prisma.facilityInstance.count({ where: { facilityTypeId } }),
    prisma.userFacilityTypeUnlock.count({ where: { facilityTypeId } }),
    prisma.researchGroupItem.count({
      where: { targetType: "facility_type", targetId: facilityTypeId },
    }),
    prisma.researchUnlockCost.count({
      where: { targetType: "facility_type", targetId: facilityTypeId },
    }),
  ]);

  if (instanceCount > 0) {
    return { success: false, error: "この設備は設置済みのため削除できません。" };
  }
  if (unlockCount > 0) {
    return { success: false, error: "この設備は解放済みユーザーがいるため削除できません。" };
  }
  if (groupItemCount > 0 || unlockCostCount > 0) {
    return { success: false, error: "この設備は研究解放に紐づいているため削除できません。" };
  }

  await prisma.facilityType.delete({ where: { id: facilityTypeId } });
  return { success: true };
}

// --- 設備建設材料（FacilityTypeConstructionInput, spec/047, docs/078）---

export type AdminFacilityConstructionInputRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  amount: number;
};

export type AdminFacilityTypeWithConstruction = AdminFacilityTypeDetail & {
  constructionInputs: AdminFacilityConstructionInputRow[];
};

export async function getAdminFacilityTypeWithConstruction(
  facilityTypeId: string
): Promise<AdminFacilityTypeWithConstruction | null> {
  const ok = await isTestUser1();
  if (!ok) return null;

  const ft = await prisma.facilityType.findUnique({
    where: { id: facilityTypeId },
    select: {
      id: true,
      name: true,
      kind: true,
      description: true,
      cost: true,
      constructionInputs: {
        orderBy: { item: { code: "asc" } },
        include: { item: { select: { id: true, code: true, name: true } } },
      },
    },
  });
  if (!ft) return null;

  return {
    id: ft.id,
    name: ft.name,
    kind: ft.kind,
    description: ft.description,
    cost: ft.cost,
    constructionInputs: ft.constructionInputs.map((inp) => ({
      itemId: inp.itemId,
      itemCode: inp.item.code,
      itemName: inp.item.name,
      amount: inp.amount,
    })),
  };
}

export type AdminFacilityConstructionInputEntry = { itemId: string; amount: number };

export async function updateAdminFacilityConstructionInputs(
  facilityTypeId: string,
  inputs: AdminFacilityConstructionInputEntry[]
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const ft = await prisma.facilityType.findUnique({
    where: { id: facilityTypeId },
    select: { id: true },
  });
  if (!ft) return { success: false, error: "設備種別が見つかりません。" };

  const normalized: { itemId: string; amount: number }[] = [];
  const seen = new Set<string>();
  for (const e of inputs) {
    const amount = typeof e.amount === "number" && Number.isInteger(e.amount) && e.amount >= 1 ? e.amount : 0;
    if (amount === 0) continue;
    if (seen.has(e.itemId)) continue;
    seen.add(e.itemId);
    normalized.push({ itemId: e.itemId, amount });
  }

  const itemIds = [...new Set(normalized.map((n) => n.itemId))];
  const existingItems = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true },
  });
  const existingIds = new Set(existingItems.map((i) => i.id));
  if (itemIds.some((id) => !existingIds.has(id))) {
    return { success: false, error: "無効なアイテムが含まれています。" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.facilityTypeConstructionInput.deleteMany({
      where: { facilityTypeId },
    });
    if (normalized.length > 0) {
      await tx.facilityTypeConstructionInput.createMany({
        data: normalized.map((n) => ({
          facilityTypeId,
          itemId: n.itemId,
          amount: n.amount,
        })),
      });
    }
  });
  return { success: true };
}

// --- 闇市・黒市（SystemShopItem, docs/079）特別アイテムのみ ---

export type AdminSystemShopRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  priceGRA: number;
  displayOrder: number;
};

/** 特別カテゴリのアイテム一覧（闇市・黒市の品目選択用）。 */
export async function getAdminSpecialItems(): Promise<
  { id: string; code: string; name: string }[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.item.findMany({
    where: { category: "special" },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  return rows;
}

export async function getAdminSystemShopItems(
  marketType: "underground" | "black"
): Promise<AdminSystemShopRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.systemShopItem.findMany({
    where: { marketType },
    include: { item: { select: { id: true, code: true, name: true } } },
    orderBy: { displayOrder: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    itemCode: r.item.code,
    itemName: r.item.name,
    priceGRA: r.priceGRA,
    displayOrder: r.displayOrder,
  }));
}

export async function createAdminSystemShopItem(
  marketType: "underground" | "black",
  itemId: string,
  priceGRA: number,
  displayOrder: number
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { category: true },
  });
  if (!item) return { success: false, error: "アイテムが見つかりません。" };
  if (item.category !== "special") {
    return { success: false, error: "闇市・黒市では特別カテゴリのアイテムのみ登録できます。" };
  }
  if (!Number.isInteger(priceGRA) || priceGRA < 1) {
    return { success: false, error: "価格は1以上の整数で指定してください。" };
  }
  try {
    await prisma.systemShopItem.create({
      data: { marketType, itemId, priceGRA, displayOrder },
    });
    return { success: true };
  } catch (e) {
    const isUnique = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
    return {
      success: false,
      error: isUnique ? "このアイテムは既に登録されています。" : "登録に失敗しました。",
    };
  }
}

export async function updateAdminSystemShopItem(
  id: string,
  priceGRA: number,
  displayOrder: number
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  if (!Number.isInteger(priceGRA) || priceGRA < 1) {
    return { success: false, error: "価格は1以上の整数で指定してください。" };
  }
  const existing = await prisma.systemShopItem.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "販売品が見つかりません。" };
  await prisma.systemShopItem.update({
    where: { id },
    data: { priceGRA, displayOrder },
  });
  return { success: true };
}

export async function deleteAdminSystemShopItem(id: string): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const existing = await prisma.systemShopItem.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "販売品が見つかりません。" };
  await prisma.systemShopItem.delete({ where: { id } });
  return { success: true };
}

// --- 設備生産レシピ編集（Recipe, spec/035）---

export type AdminRecipeRow = {
  id: string;
  facilityTypeId: string;
  facilityName: string;
  facilityKind: string;
  cycleMinutes: number;
  outputItemId: string;
  outputItemName: string;
  outputAmount: number;
  inputCount: number;
};

export type AdminRecipeInputRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  amount: number;
};

export type AdminRecipeDetail = {
  id: string;
  facilityTypeId: string;
  facilityName: string;
  facilityKind: string;
  cycleMinutes: number;
  outputItemId: string;
  outputItemName: string;
  outputAmount: number;
  inputs: AdminRecipeInputRow[];
};

export type AdminRecipeOptions = {
  items: { id: string; code: string; name: string }[];
  /** レシピが未登録の設備（新規作成用） */
  facilityTypesWithoutRecipe: { id: string; name: string; kind: string }[];
};

export async function getAdminRecipeList(): Promise<AdminRecipeRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.recipe.findMany({
    orderBy: { facilityType: { name: "asc" } },
    select: {
      id: true,
      facilityTypeId: true,
      facilityType: { select: { name: true, kind: true } },
      cycleMinutes: true,
      outputItemId: true,
      outputItem: { select: { name: true } },
      outputAmount: true,
      inputs: { select: { id: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    facilityTypeId: r.facilityTypeId,
    facilityName: r.facilityType.name,
    facilityKind: r.facilityType.kind,
    cycleMinutes: r.cycleMinutes,
    outputItemId: r.outputItemId,
    outputItemName: r.outputItem.name,
    outputAmount: r.outputAmount,
    inputCount: r.inputs.length,
  }));
}

export async function getAdminRecipe(recipeId: string): Promise<AdminRecipeDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const r = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      id: true,
      facilityTypeId: true,
      facilityType: { select: { name: true, kind: true } },
      cycleMinutes: true,
      outputItemId: true,
      outputItem: { select: { name: true } },
      outputAmount: true,
      inputs: { include: { item: { select: { id: true, code: true, name: true } } } },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    facilityTypeId: r.facilityTypeId,
    facilityName: r.facilityType.name,
    facilityKind: r.facilityType.kind,
    cycleMinutes: r.cycleMinutes,
    outputItemId: r.outputItemId,
    outputItemName: r.outputItem.name,
    outputAmount: r.outputAmount,
    inputs: r.inputs.map((inp) => ({
      itemId: inp.itemId,
      itemCode: inp.item.code,
      itemName: inp.item.name,
      amount: inp.amount,
    })),
  };
}

/** 設備種別の建設材料選択用。素材（category=material）のみ。 */
export async function getAdminMaterialItemsForConstruction(): Promise<
  { id: string; code: string; name: string }[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.item.findMany({
    where: { category: "material" },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function getAdminRecipeOptions(): Promise<AdminRecipeOptions | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const [items, facilityTypes, recipeFacilityIds] = await Promise.all([
    prisma.item.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.facilityType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    prisma.recipe.findMany({ select: { facilityTypeId: true } }),
  ]);
  const withRecipe = new Set(recipeFacilityIds.map((r) => r.facilityTypeId));
  const facilityTypesWithoutRecipe = facilityTypes
    .filter((ft) => !withRecipe.has(ft.id))
    .map((ft) => ({ id: ft.id, name: ft.name, kind: ft.kind }));
  return { items, facilityTypesWithoutRecipe };
}

export type UpdateAdminRecipeInput = {
  cycleMinutes: number;
  outputItemId: string;
  outputAmount: number;
  inputs: { itemId: string; amount: number }[];
};

export async function updateAdminRecipe(
  recipeId: string,
  input: UpdateAdminRecipeInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true },
  });
  if (!recipe) return { success: false, error: "レシピが見つかりません。" };

  if (
    !Number.isInteger(input.cycleMinutes) ||
    input.cycleMinutes < 1 ||
    !Number.isInteger(input.outputAmount) ||
    input.outputAmount < 1
  ) {
    return { success: false, error: "周期(分)と出力数は 1 以上の整数です。" };
  }
  const outputItemId = input.outputItemId?.trim() || null;
  if (!outputItemId) return { success: false, error: "出力アイテムを選択してください。" };

  const rawInputs = input.inputs.filter((row) => row.itemId.trim() && row.amount > 0);
  const merged = new Map<string, number>();
  for (const row of rawInputs) {
    merged.set(row.itemId, (merged.get(row.itemId) ?? 0) + row.amount);
  }
  const inputs = Array.from(merged.entries(), ([itemId, amount]) => ({ itemId, amount }));

  await prisma.$transaction(async (tx) => {
    await tx.recipeInput.deleteMany({ where: { recipeId } });
    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        cycleMinutes: input.cycleMinutes,
        outputItemId,
        outputAmount: input.outputAmount,
      },
    });
    for (const row of inputs) {
      await tx.recipeInput.create({
        data: { recipeId, itemId: row.itemId, amount: row.amount },
      });
    }
  });
  return { success: true };
}

export type CreateAdminRecipeInput = {
  facilityTypeId: string;
  cycleMinutes: number;
  outputItemId: string;
  outputAmount: number;
  inputs: { itemId: string; amount: number }[];
};

export async function createAdminRecipe(
  input: CreateAdminRecipeInput
): Promise<{ success: boolean; error?: string; recipeId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const facilityTypeId = input.facilityTypeId?.trim() || null;
  if (!facilityTypeId) return { success: false, error: "設備を選択してください。" };

  const existingRecipe = await prisma.recipe.findUnique({
    where: { facilityTypeId },
    select: { id: true },
  });
  if (existingRecipe) {
    return { success: false, error: "この設備には既にレシピが登録されています。" };
  }

  if (
    !Number.isInteger(input.cycleMinutes) ||
    input.cycleMinutes < 1 ||
    !Number.isInteger(input.outputAmount) ||
    input.outputAmount < 1
  ) {
    return { success: false, error: "周期(分)と出力数は 1 以上の整数です。" };
  }
  const outputItemId = input.outputItemId?.trim() || null;
  if (!outputItemId) return { success: false, error: "出力アイテムを選択してください。" };

  const rawInputs = input.inputs.filter((row) => row.itemId.trim() && row.amount > 0);
  const merged = new Map<string, number>();
  for (const row of rawInputs) {
    merged.set(row.itemId, (merged.get(row.itemId) ?? 0) + row.amount);
  }
  const inputs = Array.from(merged.entries(), ([itemId, amount]) => ({ itemId, amount }));

  const created = await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: {
        facilityTypeId,
        cycleMinutes: input.cycleMinutes,
        outputItemId,
        outputAmount: input.outputAmount,
      },
      select: { id: true },
    });
    for (const row of inputs) {
      await tx.recipeInput.create({
        data: { recipeId: recipe.id, itemId: row.itemId, amount: row.amount },
      });
    }
    return recipe;
  });
  return { success: true, recipeId: created.id };
}

// --- 遺物型・遺物パッシブ効果編集（spec/051）---

export type AdminRelicTypeRow = {
  id: string;
  code: string;
  name: string;
  groupCode: string | null;
};

export type AdminRelicTypeDetail = AdminRelicTypeRow;

export async function getAdminRelicTypeList(): Promise<AdminRelicTypeRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.relicType.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, groupCode: true },
  });
}

export async function getAdminRelicType(id: string): Promise<AdminRelicTypeDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const row = await prisma.relicType.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, groupCode: true },
  });
  return row;
}

export type UpdateAdminRelicTypeInput = {
  code: string;
  name: string;
  groupCode: string | null;
};

export async function updateAdminRelicType(
  id: string,
  input: UpdateAdminRelicTypeInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const row = await prisma.relicType.findUnique({ where: { id }, select: { id: true } });
  if (!row) return { success: false, error: "遺物型が見つかりません。" };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.relicType.findFirst({
    where: { code, id: { not: id } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  await prisma.relicType.update({
    where: { id },
    data: { code, name, groupCode: input.groupCode?.trim() || null },
  });
  return { success: true };
}

export type CreateAdminRelicTypeInput = UpdateAdminRelicTypeInput;

export async function createAdminRelicType(
  input: CreateAdminRelicTypeInput
): Promise<{ success: boolean; error?: string; relicTypeId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.relicType.findUnique({ where: { code }, select: { id: true } });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const created = await prisma.relicType.create({
    data: { code, name, groupCode: input.groupCode?.trim() || null },
    select: { id: true },
  });
  return { success: true, relicTypeId: created.id };
}

export type AdminRelicPassiveEffectRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  effectType: string | null;
  param: Record<string, unknown> | null;
};

export type AdminRelicPassiveEffectDetail = AdminRelicPassiveEffectRow;

export async function getAdminRelicPassiveEffectList(): Promise<
  AdminRelicPassiveEffectRow[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.relicPassiveEffect.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, description: true, effectType: true, param: true },
  });
  return rows.map((r) => ({
    ...r,
    param: r.param && typeof r.param === "object" && !Array.isArray(r.param) ? (r.param as Record<string, unknown>) : null,
  }));
}

export async function getAdminRelicPassiveEffect(
  id: string
): Promise<AdminRelicPassiveEffectDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const row = await prisma.relicPassiveEffect.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, description: true, effectType: true, param: true },
  });
  if (!row) return null;
  return {
    ...row,
    param: row.param && typeof row.param === "object" && !Array.isArray(row.param) ? (row.param as Record<string, unknown>) : null,
  };
}

export type UpdateAdminRelicPassiveEffectInput = {
  code: string;
  name: string;
  description: string | null;
  effectType: string | null;
  param: Record<string, unknown> | null;
};

export async function updateAdminRelicPassiveEffect(
  id: string,
  input: UpdateAdminRelicPassiveEffectInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const row = await prisma.relicPassiveEffect.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!row) return { success: false, error: "遺物パッシブ効果が見つかりません。" };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.relicPassiveEffect.findFirst({
    where: { code, id: { not: id } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  await prisma.relicPassiveEffect.update({
    where: { id },
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      effectType: input.effectType?.trim() || null,
      param: input.param ? (input.param as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
  return { success: true };
}

export type CreateAdminRelicPassiveEffectInput = UpdateAdminRelicPassiveEffectInput;

export async function createAdminRelicPassiveEffect(
  input: CreateAdminRelicPassiveEffectInput
): Promise<{ success: boolean; error?: string; relicPassiveEffectId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.relicPassiveEffect.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const created = await prisma.relicPassiveEffect.create({
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      effectType: input.effectType?.trim() || null,
      param: input.param ? (input.param as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
    select: { id: true },
  });
  return { success: true, relicPassiveEffectId: created.id };
}

/**
 * 遺物パッシブ効果を削除する。
 * 紐づく RelicInstance の relicPassiveEffectId は SetNull で null になる。
 * RelicGroupPassiveEffect は Cascade で削除される。
 */
export async function deleteAdminRelicPassiveEffect(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const row = await prisma.relicPassiveEffect.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!row) return { success: false, error: "遺物パッシブ効果が見つかりません。" };
  await prisma.relicPassiveEffect.delete({ where: { id } });
  return { success: true };
}

// --- 遺物グループ設定（RelicGroupConfig）---

export type AdminRelicGroupConfigRow = {
  id: string;
  groupCode: string;
  name: string | null;
  statBonus1Min: number;
  statBonus1Max: number;
  statBonus2Min: number;
  statBonus2Max: number;
  attributeResistMin: number;
  attributeResistMax: number;
  includeNoEffect: boolean;
};

export type AdminRelicGroupConfigDetail = AdminRelicGroupConfigRow & {
  passiveEffects: { id: string; code: string; name: string }[];
};

export async function getAdminRelicGroupConfigList(): Promise<
  AdminRelicGroupConfigRow[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.relicGroupConfig.findMany({
    orderBy: { groupCode: "asc" },
    select: {
      id: true,
      groupCode: true,
      name: true,
      statBonus1Min: true,
      statBonus1Max: true,
      statBonus2Min: true,
      statBonus2Max: true,
      attributeResistMin: true,
      attributeResistMax: true,
      includeNoEffect: true,
    },
  });
}

export async function getAdminRelicGroupConfig(
  id: string
): Promise<AdminRelicGroupConfigDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const row = await prisma.relicGroupConfig.findUnique({
    where: { id },
    select: {
      id: true,
      groupCode: true,
      name: true,
      statBonus1Min: true,
      statBonus1Max: true,
      statBonus2Min: true,
      statBonus2Max: true,
      attributeResistMin: true,
      attributeResistMax: true,
      includeNoEffect: true,
      passiveEffects: {
        select: {
          relicPassiveEffect: {
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    passiveEffects: row.passiveEffects.map((p) => ({
      id: p.relicPassiveEffect.id,
      code: p.relicPassiveEffect.code,
      name: p.relicPassiveEffect.name,
    })),
  };
}

export type UpdateAdminRelicGroupConfigInput = {
  groupCode: string;
  name: string | null;
  statBonus1Min: number;
  statBonus1Max: number;
  statBonus2Min: number;
  statBonus2Max: number;
  attributeResistMin: number;
  attributeResistMax: number;
  includeNoEffect: boolean;
  /** 抽選対象にするパッシブ効果の id 一覧。空でも可。 */
  passiveEffectIds: string[];
};

export async function updateAdminRelicGroupConfig(
  id: string,
  input: UpdateAdminRelicGroupConfigInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const config = await prisma.relicGroupConfig.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!config) return { success: false, error: "遺物グループ設定が見つかりません。" };
  const groupCode = input.groupCode.trim();
  if (!groupCode) return { success: false, error: "groupCode は必須です。" };
  const existing = await prisma.relicGroupConfig.findFirst({
    where: { groupCode, id: { not: id } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この groupCode は既に使用されています。" };
  if (
    input.statBonus1Min > input.statBonus1Max ||
    input.statBonus2Min > input.statBonus2Max ||
    input.attributeResistMin > input.attributeResistMax
  ) {
    return { success: false, error: "各 min は max 以下にしてください。" };
  }
  await prisma.$transaction(async (tx) => {
    await tx.relicGroupConfig.update({
      where: { id },
      data: {
        groupCode,
        name: input.name?.trim() || null,
        statBonus1Min: input.statBonus1Min,
        statBonus1Max: input.statBonus1Max,
        statBonus2Min: input.statBonus2Min,
        statBonus2Max: input.statBonus2Max,
        attributeResistMin: input.attributeResistMin,
        attributeResistMax: input.attributeResistMax,
        includeNoEffect: input.includeNoEffect,
      },
    });
    await tx.relicGroupPassiveEffect.deleteMany({ where: { relicGroupConfigId: id } });
    if (input.passiveEffectIds.length > 0) {
      await tx.relicGroupPassiveEffect.createMany({
        data: input.passiveEffectIds.map((relicPassiveEffectId) => ({
          relicGroupConfigId: id,
          relicPassiveEffectId,
        })),
      });
    }
  });
  return { success: true };
}

export type CreateAdminRelicGroupConfigInput = Omit<
  UpdateAdminRelicGroupConfigInput,
  never
>;

export async function createAdminRelicGroupConfig(
  input: CreateAdminRelicGroupConfigInput
): Promise<{ success: boolean; error?: string; relicGroupConfigId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const groupCode = input.groupCode.trim();
  if (!groupCode) return { success: false, error: "groupCode は必須です。" };
  const existing = await prisma.relicGroupConfig.findUnique({
    where: { groupCode },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この groupCode は既に使用されています。" };
  if (
    input.statBonus1Min > input.statBonus1Max ||
    input.statBonus2Min > input.statBonus2Max ||
    input.attributeResistMin > input.attributeResistMax
  ) {
    return { success: false, error: "各 min は max 以下にしてください。" };
  }
  const created = await prisma.relicGroupConfig.create({
    data: {
      groupCode,
      name: input.name?.trim() || null,
      statBonus1Min: input.statBonus1Min,
      statBonus1Max: input.statBonus1Max,
      statBonus2Min: input.statBonus2Min,
      statBonus2Max: input.statBonus2Max,
      attributeResistMin: input.attributeResistMin,
      attributeResistMax: input.attributeResistMax,
      includeNoEffect: input.includeNoEffect,
    },
    select: { id: true },
  });
  if (input.passiveEffectIds.length > 0) {
    await prisma.relicGroupPassiveEffect.createMany({
      data: input.passiveEffectIds.map((relicPassiveEffectId) => ({
        relicGroupConfigId: created.id,
        relicPassiveEffectId,
      })),
    });
  }
  return { success: true, relicGroupConfigId: created.id };
}

// --- 敵マスタ（Enemy）＋作戦スロット（EnemyTacticSlot）---

export type AdminEnemyTacticSlotRow = {
  id: string;
  orderIndex: number;
  subject: string;
  conditionKind: string;
  conditionParam: unknown;
  actionType: string;
  skillId: string | null;
  skillName: string | null;
};

export type AdminEnemyRow = {
  id: string;
  code: string;
  name: string;
  iconFilename: string | null;
  description: string | null;
  STR: number;
  INT: number;
  VIT: number;
  WIS: number;
  DEX: number;
  AGI: number;
  LUK: number;
  CAP: number;
  defaultBattleRow: number;
  defaultBattleCol: number;
};

export type AdminEnemyDetail = AdminEnemyRow & {
  tacticSlots: AdminEnemyTacticSlotRow[];
};

export async function getAdminEnemyList(): Promise<AdminEnemyRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.enemy.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      iconFilename: true,
      description: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
      CAP: true,
      defaultBattleRow: true,
      defaultBattleCol: true,
    },
  });
}

export async function getAdminEnemy(id: string): Promise<AdminEnemyDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const row = await prisma.enemy.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      iconFilename: true,
      description: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
      CAP: true,
      defaultBattleRow: true,
      defaultBattleCol: true,
      tacticSlots: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          orderIndex: true,
          subject: true,
          conditionKind: true,
          conditionParam: true,
          actionType: true,
          skillId: true,
          skill: { select: { name: true } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    tacticSlots: row.tacticSlots.map((s) => ({
      id: s.id,
      orderIndex: s.orderIndex,
      subject: s.subject,
      conditionKind: s.conditionKind,
      conditionParam: s.conditionParam,
      actionType: s.actionType,
      skillId: s.skillId,
      skillName: s.skill?.name ?? null,
    })),
  };
}

/** 作戦スキル選択用。category=battle_active のスキル一覧 */
export async function getAdminBattleSkillOptions(): Promise<
  { id: string; name: string; battleSkillType: string | null }[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.skill.findMany({
    where: { category: "battle_active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, battleSkillType: true },
  });
}

export type AdminEnemyTacticSlotInput = {
  orderIndex: number;
  subject: string;
  conditionKind: string;
  conditionParam: unknown;
  actionType: string;
  skillId: string | null;
};

export type UpdateAdminEnemyInput = {
  code: string;
  name: string;
  iconFilename: string | null;
  description: string | null;
  STR: number;
  INT: number;
  VIT: number;
  WIS: number;
  DEX: number;
  AGI: number;
  LUK: number;
  CAP: number;
  defaultBattleRow: number;
  defaultBattleCol: number;
  tacticSlots: AdminEnemyTacticSlotInput[];
};

export async function updateAdminEnemy(
  id: string,
  input: UpdateAdminEnemyInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const enemy = await prisma.enemy.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!enemy) return { success: false, error: "敵が見つかりません。" };
  const code = input.code.trim();
  if (!code || !input.name.trim()) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.enemy.findFirst({
    where: { code, id: { not: id } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const row = Math.max(1, Math.min(3, input.defaultBattleRow));
  const col = Math.max(1, Math.min(3, input.defaultBattleCol));
  const slots = (input.tacticSlots ?? [])
    .slice(0, 10)
    .map((s, i) => ({
      orderIndex: i + 1,
      subject: s.subject || "self",
      conditionKind: s.conditionKind || "always",
      conditionParam: s.conditionParam ?? undefined,
      actionType: s.actionType || "normal_attack",
      skillId: s.skillId?.trim() || null,
    }));
  await prisma.$transaction(async (tx) => {
    await tx.enemy.update({
      where: { id },
      data: {
        code,
        name: input.name.trim(),
        iconFilename: input.iconFilename?.trim() || null,
        description: input.description?.trim() || null,
        STR: Math.max(0, input.STR),
        INT: Math.max(0, input.INT),
        VIT: Math.max(0, input.VIT),
        WIS: Math.max(0, input.WIS),
        DEX: Math.max(0, input.DEX),
        AGI: Math.max(0, input.AGI),
        LUK: Math.max(0, input.LUK),
        CAP: Math.max(0, input.CAP),
        defaultBattleRow: row,
        defaultBattleCol: col,
      },
    });
    await tx.enemyTacticSlot.deleteMany({ where: { enemyId: id } });
    if (slots.length > 0) {
      await tx.enemyTacticSlot.createMany({
        data: slots.map((s) => ({
          enemyId: id,
          orderIndex: s.orderIndex,
          subject: s.subject,
          conditionKind: s.conditionKind,
          conditionParam: s.conditionParam as object | undefined,
          actionType: s.actionType,
          skillId: s.skillId,
        })),
      });
    }
  });
  return { success: true };
}

export type CreateAdminEnemyInput = UpdateAdminEnemyInput;

export async function createAdminEnemy(
  input: CreateAdminEnemyInput
): Promise<{ success: boolean; error?: string; enemyId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const code = input.code.trim();
  if (!code || !input.name.trim()) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.enemy.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const row = Math.max(1, Math.min(3, input.defaultBattleRow));
  const col = Math.max(1, Math.min(3, input.defaultBattleCol));
  const slots = (input.tacticSlots ?? [])
    .slice(0, 10)
    .map((s, i) => ({
      orderIndex: i + 1,
      subject: s.subject || "self",
      conditionKind: s.conditionKind || "always",
      conditionParam: s.conditionParam ?? undefined,
      actionType: s.actionType || "normal_attack",
      skillId: s.skillId?.trim() || null,
    }));
  const created = await prisma.enemy.create({
    data: {
      code,
      name: input.name.trim(),
      iconFilename: input.iconFilename?.trim() || null,
      description: input.description?.trim() || null,
      STR: Math.max(0, input.STR),
      INT: Math.max(0, input.INT),
      VIT: Math.max(0, input.VIT),
      WIS: Math.max(0, input.WIS),
      DEX: Math.max(0, input.DEX),
      AGI: Math.max(0, input.AGI),
      LUK: Math.max(0, input.LUK),
      CAP: Math.max(0, input.CAP),
      defaultBattleRow: row,
      defaultBattleCol: col,
    },
    select: { id: true },
  });
  if (slots.length > 0) {
    await prisma.enemyTacticSlot.createMany({
      data: slots.map((s) => ({
        enemyId: created.id,
        orderIndex: s.orderIndex,
        subject: s.subject,
        conditionKind: s.conditionKind,
        conditionParam: s.conditionParam as object | undefined,
        actionType: s.actionType,
        skillId: s.skillId,
      })),
    });
  }
  return { success: true, enemyId: created.id };
}

// --- 探索テーマ・エリア編集（spec/049, docs/020）---

/** 敵グループの code 一覧（通常戦雑魚用ドロップダウン） */
export async function getAdminEnemyGroupCodeList(): Promise<{ code: string }[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.enemyGroup.findMany({
    orderBy: { code: "asc" },
    select: { code: true },
  });
  return rows;
}

// --- 敵グループ編集（spec/050）---

export type AdminEnemyGroupRow = {
  id: string;
  code: string;
  entryCount: number;
};

export async function getAdminEnemyGroupList(): Promise<AdminEnemyGroupRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.enemyGroup.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      _count: { select: { entries: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    entryCount: r._count.entries,
  }));
}

export type AdminEnemyGroupEditData = {
  group: { id: string; code: string };
  entries: AdminEnemyGroupEntryRow[];
  enemies: { id: string; code: string; name: string }[];
};

export async function getAdminEnemyGroupEditData(
  groupId: string
): Promise<AdminEnemyGroupEditData | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const [group, enemies] = await Promise.all([
    prisma.enemyGroup.findUnique({
      where: { id: groupId },
      include: {
        entries: {
          include: { enemy: { select: { id: true, code: true, name: true } } },
        },
      },
    }),
    prisma.enemy.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  if (!group) return null;
  return {
    group: { id: group.id, code: group.code },
    entries: group.entries.map((e) => ({
      id: e.id,
      enemyId: e.enemyId,
      enemyCode: e.enemy.code,
      enemyName: e.enemy.name,
      weight: e.weight,
    })),
    enemies,
  };
}

export async function createAdminEnemyGroup(input: {
  code: string;
}): Promise<{ success: boolean; error?: string; enemyGroupId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const code = input.code.trim();
  if (!code) return { success: false, error: "code は必須です。" };
  const existing = await prisma.enemyGroup.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const created = await prisma.enemyGroup.create({
    data: { code },
    select: { id: true },
  });
  return { success: true, enemyGroupId: created.id };
}

export async function updateAdminEnemyGroup(
  groupId: string,
  input: { code: string }
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const group = await prisma.enemyGroup.findUnique({
    where: { id: groupId },
    select: { id: true },
  });
  if (!group) return { success: false, error: "敵グループが見つかりません。" };
  const code = input.code.trim();
  if (!code) return { success: false, error: "code は必須です。" };
  const existing = await prisma.enemyGroup.findFirst({
    where: { code, id: { not: groupId } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  await prisma.enemyGroup.update({
    where: { id: groupId },
    data: { code },
  });
  return { success: true };
}

// --- 研究グループ編集（docs/054）---

export type AdminResearchGroupRow = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  itemCount: number;
};

export async function getAdminResearchGroupList(): Promise<
  AdminResearchGroupRow[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.researchGroup.findMany({
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      displayOrder: true,
      _count: { select: { items: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    displayOrder: r.displayOrder,
    itemCount: r._count.items,
  }));
}

export type AdminResearchGroupItemRow = {
  id: string;
  targetType: "facility_type" | "craft_recipe";
  targetId: string;
  targetName: string;
  isVariant: boolean;
  displayOrder: number;
  /** 解放時に必要な研究記録書の数。0=不要 */
  requiredResearchPoint: number;
  costs: { itemId: string; itemCode: string; itemName: string; amount: number }[];
};

export type AdminResearchGroupEditData = {
  group: {
    id: string;
    code: string;
    name: string;
    displayOrder: number;
    /** spec/089: 設備コスト拡張可能回数。0=無効 */
    facilityCostExpansionLimit: number;
    /** spec/089: 1回あたりのコスト増分 */
    facilityCostExpansionAmount: number;
    /** spec/089: 1回あたり必要研究記録書 */
    facilityCostExpansionResearchPoint: number;
    /** spec/089: 設備設置上限拡張可能回数。0=無効 */
    facilitySlotsExpansionLimit: number;
    /** spec/089: 1回あたりの枠増分 */
    facilitySlotsExpansionAmount: number;
    /** spec/089: 1回あたり必要研究記録書 */
    facilitySlotsExpansionResearchPoint: number;
  };
  groupItems: AdminResearchGroupItemRow[];
  facilityTypes: { id: string; name: string }[];
  craftRecipes: { id: string; name: string }[];
  items: { id: string; code: string; name: string }[];
};

export async function getAdminResearchGroupEditData(
  groupId: string
): Promise<AdminResearchGroupEditData | null> {
  const ok = await isTestUser1();
  if (!ok) return null;

  const group = await prisma.researchGroup.findUnique({
    where: { id: groupId },
    include: {
      items: { orderBy: { displayOrder: "asc" } },
    },
  });
  if (!group) return null;

  const facilityIds = group.items
    .filter((i) => i.targetType === "facility_type")
    .map((i) => i.targetId);
  const recipeIds = group.items
    .filter((i) => i.targetType === "craft_recipe")
    .map((i) => i.targetId);

  const [facilityNames, recipeNames, costRows, facilityTypes, craftRecipes, items] =
    await Promise.all([
      facilityIds.length
        ? prisma.facilityType.findMany({
            where: { id: { in: facilityIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      recipeIds.length
        ? prisma.craftRecipe.findMany({
            where: { id: { in: recipeIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      prisma.researchUnlockCost.findMany({
        where: {
          OR: [
            ...(facilityIds.length
              ? [{ targetType: "facility_type" as const, targetId: { in: facilityIds } }]
              : []),
            ...(recipeIds.length
              ? [{ targetType: "craft_recipe" as const, targetId: { in: recipeIds } }]
              : []),
          ],
        },
        include: { item: { select: { id: true, code: true, name: true } } },
      }),
      prisma.facilityType.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.craftRecipe.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.item.findMany({
        orderBy: [{ category: "asc" }, { code: "asc" }],
        select: { id: true, code: true, name: true },
      }),
    ]);

  const facilityNameMap = new Map(facilityNames.map((r) => [r.id, r.name]));
  const recipeNameMap = new Map(recipeNames.map((r) => [r.id, r.name]));
  const costByTarget = new Map<
    string,
    { itemId: string; itemCode: string; itemName: string; amount: number }[]
  >();
  for (const c of costRows) {
    const key = `${c.targetType}:${c.targetId}`;
    const arr = costByTarget.get(key) ?? [];
    arr.push({
      itemId: c.itemId,
      itemCode: c.item.code,
      itemName: c.item.name,
      amount: c.amount,
    });
    costByTarget.set(key, arr);
  }

  const itemsWithCosts: AdminResearchGroupItemRow[] = group.items.map((it) => {
    const targetName =
      it.targetType === "facility_type"
        ? facilityNameMap.get(it.targetId) ?? it.targetId
        : recipeNameMap.get(it.targetId) ?? it.targetId;
    return {
      id: it.id,
      targetType: it.targetType as "facility_type" | "craft_recipe",
      targetId: it.targetId,
      targetName,
      isVariant: it.isVariant,
      displayOrder: it.displayOrder,
      requiredResearchPoint: it.requiredResearchPoint ?? 0,
      costs: costByTarget.get(`${it.targetType}:${it.targetId}`) ?? [],
    };
  });

  return {
    group: {
      id: group.id,
      code: group.code,
      name: group.name,
      displayOrder: group.displayOrder,
      facilityCostExpansionLimit: group.facilityCostExpansionLimit ?? 0,
      facilityCostExpansionAmount: group.facilityCostExpansionAmount ?? 0,
      facilityCostExpansionResearchPoint: group.facilityCostExpansionResearchPoint ?? 0,
      facilitySlotsExpansionLimit: group.facilitySlotsExpansionLimit ?? 0,
      facilitySlotsExpansionAmount: group.facilitySlotsExpansionAmount ?? 0,
      facilitySlotsExpansionResearchPoint: group.facilitySlotsExpansionResearchPoint ?? 0,
    },
    groupItems: itemsWithCosts,
    facilityTypes,
    craftRecipes,
    items,
  };
}

export async function createAdminResearchGroup(input: {
  code: string;
  name: string;
  displayOrder?: number;
}): Promise<{ success: boolean; error?: string; researchGroupId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { success: false, error: "code は必須です。" };
  if (!name) return { success: false, error: "name は必須です。" };
  const existing = await prisma.researchGroup.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const displayOrder =
    typeof input.displayOrder === "number" && Number.isInteger(input.displayOrder)
      ? input.displayOrder
      : 0;
  const created = await prisma.researchGroup.create({
    data: {
      code,
      name,
      displayOrder,
    },
    select: { id: true },
  });
  return { success: true, researchGroupId: created.id };
}

export async function updateAdminResearchGroup(
  groupId: string,
  input: {
    code: string;
    name: string;
    displayOrder: number;
    facilityCostExpansionLimit?: number;
    facilityCostExpansionAmount?: number;
    facilityCostExpansionResearchPoint?: number;
    facilitySlotsExpansionLimit?: number;
    facilitySlotsExpansionAmount?: number;
    facilitySlotsExpansionResearchPoint?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const group = await prisma.researchGroup.findUnique({
    where: { id: groupId },
    select: { id: true },
  });
  if (!group) return { success: false, error: "研究グループが見つかりません。" };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { success: false, error: "code は必須です。" };
  if (!name) return { success: false, error: "name は必須です。" };
  const existing = await prisma.researchGroup.findFirst({
    where: { code, id: { not: groupId } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const displayOrder =
    typeof input.displayOrder === "number" && Number.isInteger(input.displayOrder)
      ? input.displayOrder
      : 0;
  const facilityCostExpansionLimit =
    typeof input.facilityCostExpansionLimit === "number" && input.facilityCostExpansionLimit >= 0
      ? input.facilityCostExpansionLimit
      : 0;
  const facilityCostExpansionAmount =
    typeof input.facilityCostExpansionAmount === "number" && input.facilityCostExpansionAmount >= 0
      ? input.facilityCostExpansionAmount
      : 0;
  const facilityCostExpansionResearchPoint =
    typeof input.facilityCostExpansionResearchPoint === "number" &&
    input.facilityCostExpansionResearchPoint >= 0
      ? input.facilityCostExpansionResearchPoint
      : 0;
  const facilitySlotsExpansionLimit =
    typeof input.facilitySlotsExpansionLimit === "number" && input.facilitySlotsExpansionLimit >= 0
      ? input.facilitySlotsExpansionLimit
      : 0;
  const facilitySlotsExpansionAmount =
    typeof input.facilitySlotsExpansionAmount === "number" &&
    input.facilitySlotsExpansionAmount >= 0
      ? input.facilitySlotsExpansionAmount
      : 0;
  const facilitySlotsExpansionResearchPoint =
    typeof input.facilitySlotsExpansionResearchPoint === "number" &&
    input.facilitySlotsExpansionResearchPoint >= 0
      ? input.facilitySlotsExpansionResearchPoint
      : 0;
  await prisma.researchGroup.update({
    where: { id: groupId },
    data: {
      code,
      name,
      displayOrder,
      facilityCostExpansionLimit,
      facilityCostExpansionAmount,
      facilityCostExpansionResearchPoint,
      facilitySlotsExpansionLimit,
      facilitySlotsExpansionAmount,
      facilitySlotsExpansionResearchPoint,
    },
  });
  return { success: true };
}

export async function saveAdminResearchGroupItems(
  groupId: string,
  items: {
    targetType: "facility_type" | "craft_recipe";
    targetId: string;
    isVariant: boolean;
    displayOrder: number;
    requiredResearchPoint?: number;
  }[]
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const group = await prisma.researchGroup.findUnique({
    where: { id: groupId },
    select: { id: true },
  });
  if (!group) return { success: false, error: "研究グループが見つかりません。" };

  const normalized = items
    .filter((i) => i.targetType && i.targetId.trim())
    .map((i, idx) => ({
      targetType: i.targetType,
      targetId: i.targetId.trim(),
      isVariant: !!i.isVariant,
      displayOrder: Number.isInteger(i.displayOrder) ? i.displayOrder : idx,
      requiredResearchPoint:
        typeof i.requiredResearchPoint === "number" && i.requiredResearchPoint >= 0
          ? i.requiredResearchPoint
          : 0,
    }));
  const uniqueKeys = new Set(normalized.map((n) => `${n.targetType}:${n.targetId}`));
  if (uniqueKeys.size !== normalized.length) {
    return { success: false, error: "同一対象が重複しています。" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.researchGroupItem.deleteMany({ where: { researchGroupId: groupId } });
    for (const it of normalized) {
      await tx.researchGroupItem.create({
        data: {
          researchGroupId: groupId,
          targetType: it.targetType,
          targetId: it.targetId,
          isVariant: it.isVariant,
          displayOrder: it.displayOrder,
          requiredResearchPoint: it.requiredResearchPoint,
        },
      });
    }
  });
  return { success: true };
}

export async function saveAdminResearchUnlockCosts(
  targetType: "facility_type" | "craft_recipe",
  targetId: string,
  costs: { itemId: string; amount: number }[]
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  if (!targetType || !targetId.trim()) {
    return { success: false, error: "対象が指定されていません。" };
  }

  const normalized = costs
    .filter((c) => c.itemId.trim() && Number.isInteger(c.amount) && c.amount >= 1)
    .map((c) => ({ itemId: c.itemId.trim(), amount: Math.max(1, c.amount) }));
  const byItem = new Map<string, number>();
  for (const c of normalized) byItem.set(c.itemId, (byItem.get(c.itemId) ?? 0) + c.amount);

  await prisma.$transaction(async (tx) => {
    await tx.researchUnlockCost.deleteMany({
      where: { targetType, targetId: targetId.trim() },
    });
    for (const [itemId, amount] of byItem.entries()) {
      await tx.researchUnlockCost.create({
        data: { targetType, targetId: targetId.trim(), itemId, amount },
      });
    }
  });
  return { success: true };
}

// --- クエスト編集（spec/054）---

export type AdminQuestRow = {
  id: string;
  code: string;
  questType: string;
  name: string;
  prerequisiteCodes: string[];
};

export async function getAdminQuestList(): Promise<AdminQuestRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.quest.findMany({
    orderBy: [{ questType: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      questType: true,
      name: true,
      prerequisites: { select: { prerequisiteQuest: { select: { code: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    questType: r.questType,
    name: r.name,
    prerequisiteCodes: r.prerequisites.map((p) => p.prerequisiteQuest.code),
  }));
}

export type AdminQuestDetail = {
  id: string;
  code: string;
  questType: string;
  name: string;
  description: string | null;
  clearReportMessage: string | null;
  /** spec/094: クリア報告時に全体チャットに達成メッセージを投稿するか */
  notifyChatOnClear: boolean;
  /** この任務のクリア報告で市場を解放する（spec/075） */
  unlocksMarket: boolean;
  prerequisiteQuestIds: string[];
  /** spec/068: この任務クリアで解放する探索テーマの ID */
  unlockThemeIds: string[];
  /** spec/068: この任務クリアで解禁する研究グループの ID */
  unlockResearchGroupIds: string[];
  achievementType: string;
  achievementParam: unknown;
  rewardGra: number;
  rewardResearchPoint: number;
  rewardTitleId: string | null;
  rewardItems: { itemId: string; amount: number }[];
};

export async function getAdminQuest(questId: string): Promise<AdminQuestDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const q = await prisma.quest.findUnique({
    where: { id: questId },
    select: {
      id: true,
      code: true,
      questType: true,
      name: true,
      description: true,
      clearReportMessage: true,
      notifyChatOnClear: true,
      unlocksMarket: true,
      prerequisites: { select: { prerequisiteQuestId: true } },
      unlockExplorationThemes: { select: { themeId: true } },
      unlockResearchGroups: { select: { researchGroupId: true } },
      achievementType: true,
      achievementParam: true,
      rewardGra: true,
      rewardResearchPoint: true,
      rewardTitleId: true,
      rewardItems: true,
    },
  });
  if (!q) return null;
  const rawItems = q.rewardItems;
  const items: { itemId: string; amount: number }[] = Array.isArray(rawItems)
    ? (rawItems as unknown[]).filter(
        (e): e is { itemId: string; amount: number } =>
          e != null &&
          typeof (e as { itemId?: unknown }).itemId === "string" &&
          typeof (e as { amount?: unknown }).amount === "number"
      )
    : [];
  return {
    id: q.id,
    code: q.code,
    questType: q.questType,
    name: q.name,
    description: q.description,
    clearReportMessage: q.clearReportMessage,
    notifyChatOnClear: q.notifyChatOnClear,
    unlocksMarket: q.unlocksMarket,
    prerequisiteQuestIds: q.prerequisites.map((p) => p.prerequisiteQuestId),
    unlockThemeIds: q.unlockExplorationThemes.map((u) => u.themeId),
    unlockResearchGroupIds: q.unlockResearchGroups.map((u) => u.researchGroupId),
    achievementType: q.achievementType,
    achievementParam: q.achievementParam,
    rewardGra: q.rewardGra,
    rewardResearchPoint: q.rewardResearchPoint,
    rewardTitleId: q.rewardTitleId,
    rewardItems: items,
  };
}

export type UpdateAdminQuestInput = {
  code: string;
  questType: string;
  name: string;
  description: string | null;
  clearReportMessage: string | null;
  /** spec/094: クリア報告時に全体チャットに達成メッセージを投稿するか */
  notifyChatOnClear: boolean;
  /** この任務のクリア報告で市場を解放する（spec/075） */
  unlocksMarket: boolean;
  prerequisiteQuestIds: string[];
  /** spec/068: この任務クリアで解放する探索テーマの ID 一覧 */
  unlockThemeIds: string[];
  /** spec/068: この任務クリアで解禁する研究グループの ID 一覧 */
  unlockResearchGroupIds: string[];
  achievementType: string;
  achievementParamJson: string;
  rewardGra: number;
  rewardResearchPoint: number;
  rewardTitleId: string | null;
  rewardItems: { itemId: string; amount: number }[];
};

export async function updateAdminQuest(
  questId: string,
  input: UpdateAdminQuestInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    select: { id: true },
  });
  if (!quest) return { success: false, error: "開拓任務が見つかりません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  const questType = input.questType.trim() || "story";
  if (!code) return { success: false, error: "code は必須です。" };
  if (!name) return { success: false, error: "name は必須です。" };

  const existingCode = await prisma.quest.findFirst({
    where: { code, id: { not: questId } },
    select: { id: true },
  });
  if (existingCode) return { success: false, error: "この code は既に使用されています。" };

  let achievementParam: unknown = null;
  if (input.achievementParamJson.trim()) {
    try {
      achievementParam = JSON.parse(input.achievementParamJson.trim()) as unknown;
    } catch {
      return { success: false, error: "achievementParam の JSON が不正です。" };
    }
  }

  const rewardItems = input.rewardItems.filter(
    (r) => r.itemId.trim() && Number.isInteger(r.amount) && r.amount > 0
  );
  const rewardItemsJson: { itemId: string; amount: number }[] = rewardItems.map((r) => ({
    itemId: r.itemId.trim(),
    amount: Math.max(1, r.amount),
  }));

  const prereqIds = (input.prerequisiteQuestIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id && id !== questId);

  const unlockThemeIds = (input.unlockThemeIds ?? []).filter((id) => id.trim());
  const unlockResearchGroupIds = (input.unlockResearchGroupIds ?? []).filter((id) => id.trim());

  await prisma.$transaction(async (tx) => {
    await tx.quest.update({
      where: { id: questId },
      data: {
        code,
        questType,
        name,
        description: input.description?.trim() || null,
        clearReportMessage: input.clearReportMessage?.trim() || null,
        notifyChatOnClear: input.notifyChatOnClear === true,
        unlocksMarket: input.unlocksMarket === true,
        achievementType: input.achievementType.trim() || "area_clear",
        achievementParam: achievementParam ?? Prisma.JsonNull,
        rewardGra: Number.isInteger(input.rewardGra) && input.rewardGra >= 0 ? input.rewardGra : 0,
        rewardResearchPoint:
          Number.isInteger(input.rewardResearchPoint) && input.rewardResearchPoint >= 0
            ? input.rewardResearchPoint
            : 0,
        rewardTitleId: input.rewardTitleId?.trim() || null,
        rewardItems: rewardItemsJson.length > 0 ? rewardItemsJson : Prisma.JsonNull,
      },
    });
    await tx.questPrerequisite.deleteMany({ where: { questId } });
    for (const pid of prereqIds) {
      await tx.questPrerequisite.create({
        data: { questId, prerequisiteQuestId: pid },
      });
    }
    await tx.questUnlockExplorationTheme.deleteMany({ where: { questId } });
    for (const themeId of unlockThemeIds) {
      await tx.questUnlockExplorationTheme.create({
        data: { questId, themeId },
      });
    }
    await tx.questUnlockResearchGroup.deleteMany({ where: { questId } });
    for (const researchGroupId of unlockResearchGroupIds) {
      await tx.questUnlockResearchGroup.create({
        data: { questId, researchGroupId },
      });
    }
  });
  return { success: true };
}

/** 開拓任務を新規作成。入力は UpdateAdminQuestInput と同じ。作成後に編集ページへリダイレクトするために questId を返す。 */
export async function createAdminQuest(
  input: UpdateAdminQuestInput
): Promise<{ success: true; questId: string } | { success: false; error: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  const questType = input.questType.trim() || "story";
  if (!code) return { success: false, error: "code は必須です。" };
  if (!name) return { success: false, error: "name は必須です。" };

  const existingCode = await prisma.quest.findFirst({
    where: { code },
    select: { id: true },
  });
  if (existingCode) return { success: false, error: "この code は既に使用されています。" };

  let achievementParam: unknown = null;
  if (input.achievementParamJson.trim()) {
    try {
      achievementParam = JSON.parse(input.achievementParamJson.trim()) as unknown;
    } catch {
      return { success: false, error: "achievementParam の JSON が不正です。" };
    }
  }

  const rewardItems = input.rewardItems.filter(
    (r) => r.itemId.trim() && Number.isInteger(r.amount) && r.amount > 0
  );
  const rewardItemsJson: { itemId: string; amount: number }[] = rewardItems.map((r) => ({
    itemId: r.itemId.trim(),
    amount: Math.max(1, r.amount),
  }));

  const prereqIds = (input.prerequisiteQuestIds ?? []).map((id) => id.trim()).filter(Boolean);
  const unlockThemeIds = (input.unlockThemeIds ?? []).filter((id) => id.trim());
  const unlockResearchGroupIds = (input.unlockResearchGroupIds ?? []).filter((id) => id.trim());

  const quest = await prisma.$transaction(async (tx) => {
    const created = await tx.quest.create({
      data: {
        code,
        questType,
        name,
        description: input.description?.trim() || null,
        clearReportMessage: input.clearReportMessage?.trim() || null,
        notifyChatOnClear: input.notifyChatOnClear === true,
        unlocksMarket: input.unlocksMarket === true,
        achievementType: input.achievementType.trim() || "area_clear",
        achievementParam: achievementParam ?? Prisma.JsonNull,
        rewardGra: Number.isInteger(input.rewardGra) && input.rewardGra >= 0 ? input.rewardGra : 0,
        rewardResearchPoint:
          Number.isInteger(input.rewardResearchPoint) && input.rewardResearchPoint >= 0
            ? input.rewardResearchPoint
            : 0,
        rewardTitleId: input.rewardTitleId?.trim() || null,
        rewardItems: rewardItemsJson.length > 0 ? rewardItemsJson : Prisma.JsonNull,
      },
      select: { id: true },
    });
    for (const pid of prereqIds) {
      await tx.questPrerequisite.create({
        data: { questId: created.id, prerequisiteQuestId: pid },
      });
    }
    for (const themeId of unlockThemeIds) {
      await tx.questUnlockExplorationTheme.create({
        data: { questId: created.id, themeId },
      });
    }
    for (const researchGroupId of unlockResearchGroupIds) {
      await tx.questUnlockResearchGroup.create({
        data: { questId: created.id, researchGroupId },
      });
    }
    return created;
  });
  return { success: true, questId: quest.id };
}

export type AdminExplorationThemeRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  areas: { id: string; code: string; name: string }[];
};

export async function getAdminExplorationThemeList(): Promise<
  AdminExplorationThemeRow[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.explorationTheme.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      displayOrder: true,
      areas: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      },
    },
  });
  return rows;
}

export async function getAdminExplorationTheme(
  themeId: string
): Promise<AdminExplorationThemeRow | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const row = await prisma.explorationTheme.findUnique({
    where: { id: themeId },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      displayOrder: true,
      areas: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      },
    },
  });
  return row;
}

export type UpdateAdminExplorationThemeInput = {
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
};

export async function updateAdminExplorationTheme(
  themeId: string,
  input: UpdateAdminExplorationThemeInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const theme = await prisma.explorationTheme.findUnique({
    where: { id: themeId },
    select: { id: true },
  });
  if (!theme) return { success: false, error: "テーマが見つかりません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { success: false, error: "code は必須です。" };
  if (!name) return { success: false, error: "name は必須です。" };

  const existingCode = await prisma.explorationTheme.findFirst({
    where: { code, id: { not: themeId } },
    select: { id: true },
  });
  if (existingCode) return { success: false, error: "この code は既に使用されています。" };

  const displayOrder =
    typeof input.displayOrder === "number" && Number.isInteger(input.displayOrder)
      ? input.displayOrder
      : 0;

  await prisma.explorationTheme.update({
    where: { id: themeId },
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      displayOrder,
    },
  });
  return { success: true };
}

export type CreateAdminExplorationThemeInput = UpdateAdminExplorationThemeInput;

export async function createAdminExplorationTheme(
  input: CreateAdminExplorationThemeInput
): Promise<{ success: boolean; error?: string; themeId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { success: false, error: "code は必須です。" };
  if (!name) return { success: false, error: "name は必須です。" };

  const existing = await prisma.explorationTheme.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };

  const displayOrder =
    typeof input.displayOrder === "number" && Number.isInteger(input.displayOrder)
      ? input.displayOrder
      : 0;

  const created = await prisma.explorationTheme.create({
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      displayOrder,
    },
    select: { id: true },
  });
  return { success: true, themeId: created.id };
}

export type AdminExplorationAreaDetail = {
  id: string;
  themeId: string;
  themeName: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  difficultyRank: number;
  recommendedLevel: number;
  baseDropMin: number;
  baseDropMax: number;
  baseSkillEventRate: number;
  skillCheckRequiredValue: number;
  normalBattleCount: number;
  normalEnemyGroupCode: string | null;
  enemyCount1Rate: number;
  enemyCount2Rate: number;
  enemyCount3Rate: number;
  strongEnemyEnemyId: string | null;
  areaLordEnemyId: string | null;
  areaLordAppearanceRate: number;
};

export type AdminEnemyGroupEntryRow = {
  id: string;
  enemyId: string;
  enemyCode: string;
  enemyName: string;
  weight: number;
};

export type AdminNormalEnemyGroup = {
  id: string;
  code: string;
  entries: AdminEnemyGroupEntryRow[];
};

/** エリア出撃コスト 1 行（管理画面用） */
export type AdminExplorationAreaCostRow = {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
};

export type AdminExplorationAreaEditData = {
  area: AdminExplorationAreaDetail;
  enemyGroupCodes: string[];
  enemies: { id: string; code: string; name: string }[];
  /** 通常戦で使うグループのメンバー（normalEnemyGroupCode が設定されていてグループが存在する場合のみ） */
  normalEnemyGroup: AdminNormalEnemyGroup | null;
  /** 出撃コスト（探索開始時に消費するアイテム・数量）。spec/049 §7.1 */
  areaCosts: AdminExplorationAreaCostRow[];
  /** 出撃コストのアイテム選択用（id, code, name） */
  itemsForCost: { id: string; code: string; name: string }[];
  /** spec/073: このエリアに紐づく技能イベント（重み付き） */
  areaExplorationEvents: AdminAreaExplorationEventRow[];
  /** spec/073: 紐づけ追加用の技能イベント一覧（id, code, name） */
  explorationEventsForSelect: { id: string; code: string; name: string }[];
};

export async function getAdminExplorationAreaEditData(
  areaId: string
): Promise<AdminExplorationAreaEditData | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const area = await prisma.explorationArea.findUnique({
    where: { id: areaId },
    select: {
      id: true,
      themeId: true,
      theme: { select: { name: true } },
      code: true,
      name: true,
      description: true,
      displayOrder: true,
      difficultyRank: true,
      recommendedLevel: true,
      baseDropMin: true,
      baseDropMax: true,
      baseSkillEventRate: true,
      skillCheckRequiredValue: true,
      normalBattleCount: true,
      normalEnemyGroupCode: true,
      enemyCount1Rate: true,
      enemyCount2Rate: true,
      enemyCount3Rate: true,
      strongEnemyEnemyId: true,
      areaLordEnemyId: true,
      areaLordAppearanceRate: true,
    },
  });
  if (!area) return null;

  const [enemyGroupCodes, enemies, normalGroup, areaCosts, itemsForCost, areaExplorationEvents, explorationEventsForSelect] = await Promise.all([
    prisma.enemyGroup.findMany({ orderBy: { code: "asc" }, select: { code: true } }),
    prisma.enemy.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    !area.normalEnemyGroupCode
      ? Promise.resolve(null)
      : prisma.enemyGroup.findUnique({
          where: { code: area.normalEnemyGroupCode },
          include: {
            entries: {
              include: { enemy: { select: { id: true, code: true, name: true } } },
            },
          },
        }).then((group) => {
          if (!group) return null;
          return {
            id: group.id,
            code: group.code,
            entries: group.entries.map((e) => ({
              id: e.id,
              enemyId: e.enemyId,
              enemyCode: e.enemy.code,
              enemyName: e.enemy.name,
              weight: e.weight,
            })),
          };
        }),
    prisma.explorationAreaCost.findMany({
      where: { areaId },
      include: { item: { select: { id: true, code: true, name: true } } },
      orderBy: { item: { code: "asc" } },
    }),
    prisma.item.findMany({
      orderBy: [{ category: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    prisma.areaExplorationEvent.findMany({
      where: { areaId },
      include: { explorationEvent: { select: { id: true, code: true, name: true } } },
      orderBy: { explorationEvent: { code: "asc" } },
    }),
    prisma.explorationEvent.findMany({
      where: { eventType: "skill_check" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const { theme, ...rest } = area;
  return {
    area: {
      ...rest,
      themeName: theme.name,
    },
    enemyGroupCodes: enemyGroupCodes.map((r) => r.code),
    enemies: enemies,
    normalEnemyGroup: normalGroup,
    areaCosts: areaCosts.map((c) => ({
      id: c.id,
      itemId: c.itemId,
      itemCode: c.item.code,
      itemName: c.item.name,
      quantity: c.quantity,
    })),
    itemsForCost,
    areaExplorationEvents: areaExplorationEvents.map((ae) => ({
      explorationEventId: ae.explorationEventId,
      explorationEventCode: ae.explorationEvent.code,
      explorationEventName: ae.explorationEvent.name,
      weight: ae.weight,
    })),
    explorationEventsForSelect: explorationEventsForSelect,
  };
}

/** 通常戦雑魚グループのメンバーを一括更新（既存を削除して指定エントリで置き換え）。テストユーザー1のみ。 */
export async function saveEnemyGroupEntries(
  enemyGroupId: string,
  entries: { enemyId: string; weight: number }[]
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const group = await prisma.enemyGroup.findUnique({
    where: { id: enemyGroupId },
    select: { id: true },
  });
  if (!group) return { success: false, error: "敵グループが見つかりません。" };

  const valid = entries.filter(
    (e) => e.enemyId.trim() && Number.isInteger(e.weight) && e.weight >= 1
  );
  const uniqueByEnemy = new Map<string, number>();
  for (const e of valid) {
    uniqueByEnemy.set(e.enemyId.trim(), Math.max(1, e.weight));
  }

  await prisma.$transaction([
    prisma.enemyGroupEntry.deleteMany({ where: { enemyGroupId } }),
    ...Array.from(uniqueByEnemy.entries()).map(([enemyId, weight]) =>
      prisma.enemyGroupEntry.create({
        data: { enemyGroupId, enemyId, weight },
      })
    ),
  ]);
  return { success: true };
}

/** エリアの出撃コストを一括保存（既存を削除して指定で置き換え）。テストユーザー1のみ。 */
export async function saveAdminExplorationAreaCosts(
  areaId: string,
  costs: { itemId: string; quantity: number }[]
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const area = await prisma.explorationArea.findUnique({
    where: { id: areaId },
    select: { id: true },
  });
  if (!area) return { success: false, error: "エリアが見つかりません。" };

  const valid = costs.filter(
    (c) => c.itemId.trim() && Number.isInteger(c.quantity) && c.quantity >= 1
  );
  const uniqueByItem = new Map<string, number>();
  for (const c of valid) {
    const id = c.itemId.trim();
    uniqueByItem.set(id, Math.max(1, c.quantity));
  }

  const itemIds = [...uniqueByItem.keys()];
  const existingItems = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true },
  });
  const existingIdSet = new Set(existingItems.map((i) => i.id));
  for (const id of itemIds) {
    if (!existingIdSet.has(id)) {
      return { success: false, error: "存在しないアイテムが含まれています。" };
    }
  }

  await prisma.$transaction([
    prisma.explorationAreaCost.deleteMany({ where: { areaId } }),
    ...Array.from(uniqueByItem.entries()).map(([itemId, quantity]) =>
      prisma.explorationAreaCost.create({
        data: { areaId, itemId, quantity },
      })
    ),
  ]);
  return { success: true };
}

// --- 技能イベント（ExplorationEvent / SkillEventDetail / SkillEventStatOption）spec/073 ---

const SKILL_EVENT_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

export type AdminExplorationEventRow = {
  id: string;
  code: string;
  eventType: string;
  name: string;
  description: string | null;
  occurrenceMessage: string | null;
};

export type AdminSkillEventStatOptionRow = {
  statKey: string;
  sortOrder: number;
  difficultyCoefficient: number;
  successMessage: string;
  failMessage: string;
};

export type AdminExplorationEventDetail = {
  id: string;
  code: string;
  eventType: string;
  name: string;
  description: string | null;
  occurrenceMessage: string;
  statOptions: AdminSkillEventStatOptionRow[];
};

export async function getAdminExplorationEventList(): Promise<AdminExplorationEventRow[] | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const rows = await prisma.explorationEvent.findMany({
    where: { eventType: "skill_check" },
    orderBy: { code: "asc" },
    include: {
      skillEventDetail: { select: { occurrenceMessage: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    eventType: r.eventType,
    name: r.name,
    description: r.description,
    occurrenceMessage: r.skillEventDetail?.occurrenceMessage ?? null,
  }));
}

export async function getAdminExplorationEvent(
  id: string
): Promise<AdminExplorationEventDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const row = await prisma.explorationEvent.findUnique({
    where: { id },
    include: {
      skillEventDetail: {
        include: {
          statOptions: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!row || row.eventType !== "skill_check") return null;
  const detail = row.skillEventDetail;
  if (!detail) return null;
  return {
    id: row.id,
    code: row.code,
    eventType: row.eventType,
    name: row.name,
    description: row.description,
    occurrenceMessage: detail.occurrenceMessage,
    statOptions: detail.statOptions.map((o) => ({
      statKey: o.statKey,
      sortOrder: o.sortOrder,
      difficultyCoefficient: o.difficultyCoefficient,
      successMessage: o.successMessage,
      failMessage: o.failMessage,
    })),
  };
}

export type CreateAdminExplorationEventInput = {
  code: string;
  name: string;
  description: string | null;
  occurrenceMessage: string;
  statOptions: { statKey: string; sortOrder: number; difficultyCoefficient: number; successMessage: string; failMessage: string }[];
};

export async function createAdminExplorationEvent(
  input: CreateAdminExplorationEventInput
): Promise<{ success: boolean; error?: string; explorationEventId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.explorationEvent.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const occurrenceMessage = (input.occurrenceMessage ?? "").trim() || "何かが起きた…。どう対処する？";
  const statKeys = [...SKILL_EVENT_STAT_KEYS];
  const optionMap = new Map(
    (input.statOptions ?? []).map((o) => [o.statKey, o])
  );
  const defaultOption = {
    sortOrder: 0,
    difficultyCoefficient: 1,
    successMessage: "うまくいった。",
    failMessage: "うまくいかなかった。",
  };
  await prisma.$transaction(async (tx) => {
    const event = await tx.explorationEvent.create({
      data: {
        code,
        eventType: "skill_check",
        name,
        description: input.description?.trim() || null,
      },
      select: { id: true },
    });
    await tx.skillEventDetail.create({
      data: {
        explorationEventId: event.id,
        occurrenceMessage,
      },
    });
    for (let i = 0; i < statKeys.length; i += 1) {
      const statKey = statKeys[i]!;
      const o = optionMap.get(statKey) ?? {
        statKey,
        sortOrder: i,
        difficultyCoefficient: defaultOption.difficultyCoefficient,
        successMessage: defaultOption.successMessage,
        failMessage: defaultOption.failMessage,
      };
      await tx.skillEventStatOption.create({
        data: {
          skillEventDetailId: event.id,
          statKey,
          sortOrder: Number.isFinite(o.sortOrder) ? o.sortOrder : i,
          difficultyCoefficient: Number(o.difficultyCoefficient) || 1,
          successMessage: (o.successMessage ?? defaultOption.successMessage).trim() || defaultOption.successMessage,
          failMessage: (o.failMessage ?? defaultOption.failMessage).trim() || defaultOption.failMessage,
        },
      });
    }
  });
  const created = await prisma.explorationEvent.findUnique({
    where: { code },
    select: { id: true },
  });
  return { success: true, explorationEventId: created!.id };
}

export type UpdateAdminExplorationEventInput = {
  code: string;
  name: string;
  description: string | null;
  occurrenceMessage: string;
  statOptions: { statKey: string; sortOrder: number; difficultyCoefficient: number; successMessage: string; failMessage: string }[];
};

export async function updateAdminExplorationEvent(
  id: string,
  input: UpdateAdminExplorationEventInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const row = await prisma.explorationEvent.findUnique({
    where: { id },
    select: { id: true, skillEventDetail: { select: { explorationEventId: true } } },
  });
  if (!row || !row.skillEventDetail) return { success: false, error: "技能イベントが見つかりません。" };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) return { success: false, error: "code と name は必須です。" };
  const existing = await prisma.explorationEvent.findFirst({
    where: { code, id: { not: id } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };
  const occurrenceMessage = (input.occurrenceMessage ?? "").trim() || "何かが起きた…。どう対処する？";
  const detailId = row.skillEventDetail.explorationEventId;
  await prisma.$transaction(async (tx) => {
    await tx.explorationEvent.update({
      where: { id },
      data: { code, name, description: input.description?.trim() || null },
    });
    await tx.skillEventDetail.update({
      where: { explorationEventId: id },
      data: { occurrenceMessage },
    });
    const optionMap = new Map(
      (input.statOptions ?? []).map((o) => [o.statKey, o])
    );
    const defaultOption = { sortOrder: 0, difficultyCoefficient: 1, successMessage: "うまくいった。", failMessage: "うまくいかなかった。" };
    for (const statKey of SKILL_EVENT_STAT_KEYS) {
      const o = optionMap.get(statKey) ?? { statKey, ...defaultOption, successMessage: defaultOption.successMessage, failMessage: defaultOption.failMessage };
      await tx.skillEventStatOption.upsert({
        where: {
          skillEventDetailId_statKey: { skillEventDetailId: detailId, statKey },
        },
        create: {
          skillEventDetailId: detailId,
          statKey,
          sortOrder: Number.isFinite(o.sortOrder) ? o.sortOrder : 0,
          difficultyCoefficient: Number(o.difficultyCoefficient) || 1,
          successMessage: (o.successMessage ?? defaultOption.successMessage).trim() || defaultOption.successMessage,
          failMessage: (o.failMessage ?? defaultOption.failMessage).trim() || defaultOption.failMessage,
        },
        update: {
          sortOrder: Number.isFinite(o.sortOrder) ? o.sortOrder : 0,
          difficultyCoefficient: Number(o.difficultyCoefficient) || 1,
          successMessage: (o.successMessage ?? defaultOption.successMessage).trim() || defaultOption.successMessage,
          failMessage: (o.failMessage ?? defaultOption.failMessage).trim() || defaultOption.failMessage,
        },
      });
    }
  });
  return { success: true };
}

/** エリアに紐づく技能イベント一覧（重み付き）。編集データ用。 */
export type AdminAreaExplorationEventRow = {
  explorationEventId: string;
  explorationEventCode: string;
  explorationEventName: string;
  weight: number;
};

/** エリアの技能イベント紐づけを一括保存（既存を削除して指定で置き換え）。テストユーザー1のみ。 */
export async function saveAdminAreaExplorationEvents(
  areaId: string,
  entries: { explorationEventId: string; weight: number }[]
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const area = await prisma.explorationArea.findUnique({
    where: { id: areaId },
    select: { id: true },
  });
  if (!area) return { success: false, error: "エリアが見つかりません。" };
  const valid = entries.filter(
    (e) => e.explorationEventId.trim() && Number.isInteger(e.weight) && e.weight >= 0
  );
  const uniqueByEvent = new Map<string, number>();
  for (const e of valid) {
    uniqueByEvent.set(e.explorationEventId.trim(), Math.max(0, e.weight));
  }
  const eventIds = [...uniqueByEvent.keys()];
  const existingEvents = await prisma.explorationEvent.findMany({
    where: { id: { in: eventIds }, eventType: "skill_check" },
    select: { id: true },
  });
  const existingIdSet = new Set(existingEvents.map((e) => e.id));
  for (const id of eventIds) {
    if (!existingIdSet.has(id)) {
      return { success: false, error: "存在しない技能イベントが含まれています。" };
    }
  }
  await prisma.$transaction([
    prisma.areaExplorationEvent.deleteMany({ where: { areaId } }),
    ...Array.from(uniqueByEvent.entries())
      .filter(([, w]) => w > 0)
      .map(([explorationEventId, weight]) =>
        prisma.areaExplorationEvent.create({
          data: { areaId, explorationEventId, weight },
        })
      ),
  ]);
  return { success: true };
}

export type UpdateAdminExplorationAreaInput = {
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  difficultyRank: number;
  recommendedLevel: number;
  baseDropMin: number;
  baseDropMax: number;
  baseSkillEventRate: number;
  skillCheckRequiredValue: number;
  normalBattleCount: number;
  normalEnemyGroupCode: string | null;
  enemyCount1Rate: number;
  enemyCount2Rate: number;
  enemyCount3Rate: number;
  strongEnemyEnemyId: string | null;
  areaLordEnemyId: string | null;
  areaLordAppearanceRate: number;
};

export async function updateAdminExplorationArea(
  areaId: string,
  input: UpdateAdminExplorationAreaInput
): Promise<{ success: boolean; error?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };
  const area = await prisma.explorationArea.findUnique({
    where: { id: areaId },
    select: { id: true },
  });
  if (!area) return { success: false, error: "エリアが見つかりません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { success: false, error: "code は必須です。" };
  if (!name) return { success: false, error: "name は必須です。" };

  const existingCode = await prisma.explorationArea.findFirst({
    where: { code, id: { not: areaId } },
    select: { id: true },
  });
  if (existingCode) return { success: false, error: "この code は既に使用されています。" };

  const r1 = Math.max(0, Math.min(100, Number(input.enemyCount1Rate) || 0));
  const r2 = Math.max(0, Math.min(100, Number(input.enemyCount2Rate) || 0));
  const r3 = Math.max(0, Math.min(100, Number(input.enemyCount3Rate) || 0));

  await prisma.explorationArea.update({
    where: { id: areaId },
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      displayOrder: Number.isInteger(input.displayOrder) ? input.displayOrder : 0,
      difficultyRank: Math.max(1, Number(input.difficultyRank) || 1),
      recommendedLevel: Math.max(1, Number(input.recommendedLevel) || 1),
      baseDropMin: Math.max(0, Number(input.baseDropMin) ?? 3),
      baseDropMax: Math.max(0, Number(input.baseDropMax) ?? 5),
      baseSkillEventRate: Math.max(0, Math.min(100, Number(input.baseSkillEventRate) ?? 25)),
      skillCheckRequiredValue: Math.max(1, Number(input.skillCheckRequiredValue) ?? 80),
      normalBattleCount: Math.max(1, Number(input.normalBattleCount) ?? 5),
      normalEnemyGroupCode: input.normalEnemyGroupCode?.trim() || null,
      enemyCount1Rate: r1,
      enemyCount2Rate: r2,
      enemyCount3Rate: r3,
      strongEnemyEnemyId: input.strongEnemyEnemyId?.trim() || null,
      areaLordEnemyId: input.areaLordEnemyId?.trim() || null,
      areaLordAppearanceRate: Math.max(0, Math.min(100, Number(input.areaLordAppearanceRate) ?? 50)),
    },
  });
  return { success: true };
}

export type CreateAdminExplorationAreaInput = UpdateAdminExplorationAreaInput & {
  themeId: string;
};

export async function createAdminExplorationArea(
  input: CreateAdminExplorationAreaInput
): Promise<{ success: boolean; error?: string; areaId?: string }> {
  const ok = await isTestUser1();
  if (!ok) return { success: false, error: "権限がありません。" };

  const theme = await prisma.explorationTheme.findUnique({
    where: { id: input.themeId },
    select: { id: true },
  });
  if (!theme) return { success: false, error: "テーマが見つかりません。" };

  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { success: false, error: "code は必須です。" };
  if (!name) return { success: false, error: "name は必須です。" };

  const existing = await prisma.explorationArea.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing) return { success: false, error: "この code は既に使用されています。" };

  const r1 = Math.max(0, Math.min(100, Number(input.enemyCount1Rate) || 0));
  const r2 = Math.max(0, Math.min(100, Number(input.enemyCount2Rate) || 0));
  const r3 = Math.max(0, Math.min(100, Number(input.enemyCount3Rate) || 0));

  const DROP_TABLE_KINDS = [
    { kind: "base", nameSuffix: "基本ドロップ", codeSuffix: "base" },
    { kind: "battle_bonus", nameSuffix: "戦闘ボーナス", codeSuffix: "battle" },
    { kind: "skill", nameSuffix: "技能イベント枠", codeSuffix: "skill" },
    { kind: "strong_enemy", nameSuffix: "強敵", codeSuffix: "strong_enemy" },
    { kind: "area_lord_special", nameSuffix: "領域主専用", codeSuffix: "area_lord" },
  ] as const;

  const created = await prisma.$transaction(async (tx) => {
    const area = await tx.explorationArea.create({
      data: {
        themeId: input.themeId,
        code,
        name,
        description: input.description?.trim() || null,
        displayOrder: Number.isInteger(input.displayOrder) ? input.displayOrder : 0,
        difficultyRank: Math.max(1, Number(input.difficultyRank) || 1),
        recommendedLevel: Math.max(1, Number(input.recommendedLevel) || 1),
        baseDropMin: Math.max(0, Number(input.baseDropMin) ?? 3),
        baseDropMax: Math.max(0, Number(input.baseDropMax) ?? 5),
        baseSkillEventRate: Math.max(0, Math.min(100, Number(input.baseSkillEventRate) ?? 25)),
        skillCheckRequiredValue: Math.max(1, Number(input.skillCheckRequiredValue) ?? 80),
        normalBattleCount: Math.max(1, Number(input.normalBattleCount) ?? 5),
        normalEnemyGroupCode: input.normalEnemyGroupCode?.trim() || null,
        enemyCount1Rate: r1,
        enemyCount2Rate: r2,
        enemyCount3Rate: r3,
        strongEnemyEnemyId: input.strongEnemyEnemyId?.trim() || null,
        areaLordEnemyId: input.areaLordEnemyId?.trim() || null,
        areaLordAppearanceRate: Math.max(0, Math.min(100, Number(input.areaLordAppearanceRate) ?? 50)),
      },
      select: { id: true, code: true, name: true },
    });

    const codePrefix = `drop_${area.code}_`;
    const tableIds: Record<string, string> = {};
    for (const k of DROP_TABLE_KINDS) {
      const dt = await tx.dropTable.create({
        data: {
          code: `${codePrefix}${k.codeSuffix}`,
          name: `${area.name} ${k.nameSuffix}`,
          kind: k.kind,
          areaId: area.id,
        },
        select: { id: true },
      });
      tableIds[k.codeSuffix] = dt.id;
    }

    await tx.explorationArea.update({
      where: { id: area.id },
      data: {
        baseDropTableId: tableIds.base,
        battleDropTableId: tableIds.battle,
        skillDropTableId: tableIds.skill,
        strongEnemyDropTableId: tableIds.strong_enemy,
        areaLordDropTableId: tableIds.area_lord,
      },
    });
    return area;
  });
  return { success: true, areaId: created.id };
}
