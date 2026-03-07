"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isTestUser1 } from "@/server/lib/admin";
import {
  parseEquipmentStatGenConfig,
  parseMechaPartStatGenConfig,
} from "@/lib/craft/parse-stat-gen-config";
import type { EquipmentStatGenConfig } from "@/lib/craft/equipment-stat-gen";
import type { MechaPartStatGenConfig } from "@/lib/craft/mecha-part-stat-gen";
import { isEquipmentSlot } from "@/lib/constants/equipment-slots";
import { isMechaSlot } from "@/lib/constants/mecha-slots";

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
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        areas: {
          orderBy: { name: "asc" },
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
    orderBy: [{ name: "asc" }],
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
};

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
  }));
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

export type UpdateAdminItemInput = {
  code: string;
  name: string;
  category: string;
  skillId: string | null;
  /** JSON 文字列。空は null 扱い。 */
  consumableEffectJson: string | null;
  maxCarryPerExpedition: number | null;
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
  if (!ITEM_CATEGORIES.includes(input.category as "material" | "consumable" | "blueprint" | "skill_book" | "paid")) {
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
    },
  });
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
  if (!ITEM_CATEGORIES.includes(input.category as "material" | "consumable" | "blueprint" | "skill_book" | "paid")) {
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
    },
    select: { id: true },
  });
  return { success: true, itemId: created.id };
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

function validateEquipmentStatGenInput(
  cfg: AdminEquipmentStatGenInput
): string | null {
  if (!Number.isInteger(cfg.capMin) || !Number.isInteger(cfg.capMax) || cfg.capMin > cfg.capMax) {
    return "装備の CAP は capMin ≤ capMax の整数で入力してください。";
  }
  if (!cfg.weights?.length) return "装備のステータス重みを1件以上登録してください。";
  const validKeys = new Set(["PATK", "MATK", "PDEF", "MDEF", "HIT", "EVA"]);
  for (const w of cfg.weights) {
    if (!validKeys.has(w.key)) return `装備の重み key は PATK/MATK/PDEF/MDEF/HIT/EVA のいずれかにしてください。`;
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

  const created = await prisma.facilityType.create({
    data: {
      name,
      kind: input.kind,
      description: input.description?.trim() || null,
      cost,
    },
    select: { id: true },
  });
  return { success: true, facilityTypeId: created.id };
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
};

export type AdminRelicPassiveEffectDetail = AdminRelicPassiveEffectRow;

export async function getAdminRelicPassiveEffectList(): Promise<
  AdminRelicPassiveEffectRow[] | null
> {
  const ok = await isTestUser1();
  if (!ok) return null;
  return prisma.relicPassiveEffect.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, description: true },
  });
}

export async function getAdminRelicPassiveEffect(
  id: string
): Promise<AdminRelicPassiveEffectDetail | null> {
  const ok = await isTestUser1();
  if (!ok) return null;
  const row = await prisma.relicPassiveEffect.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, description: true },
  });
  return row;
}

export type UpdateAdminRelicPassiveEffectInput = {
  code: string;
  name: string;
  description: string | null;
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
    data: { code, name, description: input.description?.trim() || null },
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
    data: { code, name, description: input.description?.trim() || null },
    select: { id: true },
  });
  return { success: true, relicPassiveEffectId: created.id };
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
