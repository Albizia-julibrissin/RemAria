"use server";

// spec/046 - アイテムクラフト・装備着脱

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isEquipmentSlot } from "@/lib/constants/equipment-slots";
import {
  type EquipmentStatGenConfig,
  generateEquipmentStatsFromConfig,
  generateEquipmentStatsWithFixedCap,
} from "@/lib/craft/equipment-stat-gen";
import {
  TEMPER_MATERIAL_MULTIPLIER,
  INHERIT_BASE_SUCCESS_RATE_PERCENT,
  INHERIT_SUCCESS_RATE_INCREMENT,
} from "@/lib/constants/craft";
import {
  type MechaPartStatGenConfig,
  generateMechaPartStatsFromConfig,
} from "@/lib/craft/mecha-part-stat-gen";
import {
  parseEquipmentStatGenConfig,
  parseMechaPartStatGenConfig,
} from "@/lib/craft/parse-stat-gen-config";
import { grantStackableItem } from "@/server/lib/inventory";

export type CraftRecipeInputRow = {
  itemId: string;
  itemCode: string;
  itemName: string;
  amount: number;
};

export type CraftRecipeOutput = {
  kind: "equipment" | "mecha_part" | "item";
  equipmentTypeId?: string;
  equipmentTypeName?: string;
  equipmentSlot?: string;
  mechaPartTypeId?: string;
  mechaPartTypeName?: string;
  mechaPartSlot?: string;
  itemId?: string;
  itemName?: string;
};

export type CraftRecipeRow = {
  id: string;
  code: string;
  name: string;
  inputs: CraftRecipeInputRow[];
  output: CraftRecipeOutput;
};

export type ExecuteCraftResult =
  | {
      success: true;
      message: string;
      equipmentInstanceId?: string;
      equipmentTypeName?: string;
      equipmentStats?: Record<string, number>;
      statCap?: number;
      capCeiling?: number;
      mechaPartInstanceId?: string;
      mechaPartTypeName?: string;
      mechaPartStats?: Record<string, number>;
      mechaPartSlot?: string;
      itemId?: string;
      quantity?: number;
    }
  | { success: false; error: string; message: string };

export type CharacterEquipmentSlot = {
  slot: string;
  equipmentInstanceId: string | null;
  equipmentInstanceName: string | null;
  statsSummary: string | null;
};

export type GetCharacterEquipmentResult = {
  characterId: string;
  slots: CharacterEquipmentSlot[];
} | null;

/**
 * 解放済みクラフトレシピ一覧。MVP では全レシピを返す。spec/046。
 */
export async function getCraftRecipes(): Promise<CraftRecipeRow[] | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const unlockedIds = await prisma.userCraftRecipeUnlock.findMany({
    where: { userId: session.userId },
    select: { craftRecipeId: true },
  });
  const unlockedSet = new Set(unlockedIds.map((u) => u.craftRecipeId));

  const recipes = await prisma.craftRecipe.findMany({
    where: { id: { in: [...unlockedSet] } },
    orderBy: { code: "asc" },
    include: {
      inputs: { include: { item: { select: { id: true, code: true, name: true } } } },
      outputEquipmentType: { select: { id: true, name: true, slot: true } },
      outputMechaPartType: { select: { id: true, name: true, slot: true } },
      outputItem: { select: { id: true, name: true } },
    },
  });

  return recipes.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    inputs: r.inputs.map((inp) => ({
      itemId: inp.itemId,
      itemCode: inp.item.code,
      itemName: inp.item.name,
      amount: inp.amount,
    })),
    output: (() => {
      if (r.outputKind === "equipment" && r.outputEquipmentType) {
        return {
          kind: "equipment" as const,
          equipmentTypeId: r.outputEquipmentType.id,
          equipmentTypeName: r.outputEquipmentType.name,
          equipmentSlot: r.outputEquipmentType.slot,
        };
      }
      if (r.outputKind === "mecha_part" && r.outputMechaPartType) {
        return {
          kind: "mecha_part" as const,
          mechaPartTypeId: r.outputMechaPartType.id,
          mechaPartTypeName: r.outputMechaPartType.name,
          mechaPartSlot: r.outputMechaPartType.slot,
        };
      }
      if (r.outputKind === "item" && r.outputItem) {
        return {
          kind: "item" as const,
          itemId: r.outputItem.id,
          itemName: r.outputItem.name,
        };
      }
      return { kind: "item" as const, itemId: "", itemName: "" };
    })(),
  }));
}

export type RecipeMaterialStockRow = {
  itemId: string;
  itemName: string;
  required: number;
  stock: number;
};

/**
 * 指定レシピの材料ごとの必要数とユーザー在庫を返す。製造準備モーダル用。
 */
export async function getRecipeMaterialStocks(
  recipeId: string
): Promise<{ materialRows: RecipeMaterialStockRow[] } | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const unlocked = await prisma.userCraftRecipeUnlock.findFirst({
    where: { userId: session.userId, craftRecipeId: recipeId },
  });
  if (!unlocked) return null;

  const recipe = await prisma.craftRecipe.findMany({
    where: { id: recipeId },
    include: {
      inputs: { include: { item: { select: { id: true, name: true } } } },
    },
  });
  const r = recipe[0];
  if (!r?.inputs.length) return { materialRows: [] };

  const itemIds = r.inputs.map((i) => i.itemId);
  const stocks = await prisma.userInventory.findMany({
    where: { userId: session.userId, itemId: { in: itemIds } },
    select: { itemId: true, quantity: true },
  });
  const stockByItemId = new Map(stocks.map((s) => [s.itemId, s.quantity]));

  const materialRows: RecipeMaterialStockRow[] = r.inputs.map((inp) => ({
    itemId: inp.itemId,
    itemName: inp.item.name,
    required: inp.amount,
    stock: stockByItemId.get(inp.itemId) ?? 0,
  }));

  return { materialRows };
}

/**
 * 指定レシピを 1 回実行。入力消費・出力作成。spec/046。
 */
export async function executeCraft(craftRecipeId: string): Promise<ExecuteCraftResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  const userId = session.userId;

  const recipe = await prisma.craftRecipe.findUnique({
    where: { id: craftRecipeId },
    include: {
      inputs: { include: { item: true } },
      outputEquipmentType: { select: { id: true, code: true, name: true, statGenConfig: true } },
      outputMechaPartType: { select: { id: true, name: true, slot: true, statGenConfig: true } },
      outputItem: true,
    },
  });
  if (!recipe) {
    return { success: false, error: "NOT_FOUND", message: "レシピが見つかりません。" };
  }

  // docs/053: マスタに statGenConfig がなければクラフト失敗（素材は消費しない）
  let equipmentStatConfig: EquipmentStatGenConfig | null = null;
  let mechaPartStatConfig: MechaPartStatGenConfig | null = null;
  if (recipe.outputKind === "equipment" && recipe.outputEquipmentType) {
    equipmentStatConfig = parseEquipmentStatGenConfig(recipe.outputEquipmentType.statGenConfig);
    if (!equipmentStatConfig) {
      return {
        success: false,
        error: "STAT_GEN_CONFIG_MISSING",
        message: "この装備はステータス生成設定がありません。クラフトできません。",
      };
    }
  }
  if (recipe.outputKind === "mecha_part" && recipe.outputMechaPartType) {
    mechaPartStatConfig = parseMechaPartStatGenConfig(recipe.outputMechaPartType.statGenConfig);
    if (!mechaPartStatConfig) {
      return {
        success: false,
        error: "STAT_GEN_CONFIG_MISSING",
        message: "このメカパーツはステータス生成設定がありません。クラフトできません。",
      };
    }
  }

  const inventories = await prisma.userInventory.findMany({
    where: { userId },
    select: { itemId: true, quantity: true },
  });
  const qtyByItemId = new Map(inventories.map((i) => [i.itemId, i.quantity]));

  for (const inp of recipe.inputs) {
    const have = qtyByItemId.get(inp.itemId) ?? 0;
    if (have < inp.amount) {
      return {
        success: false,
        error: "INVENTORY",
        message: `${inp.item.name}が${inp.amount - have}個不足しています。`,
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const inp of recipe!.inputs) {
        const row = await tx.userInventory.findUnique({
          where: { userId_itemId: { userId, itemId: inp.itemId } },
        });
        if (!row || row.quantity < inp.amount) {
          throw new Error("INVENTORY");
        }
        await tx.userInventory.update({
          where: { userId_itemId: { userId, itemId: inp.itemId } },
          data: { quantity: row.quantity - inp.amount },
        });
      }

      if (recipe!.outputKind === "equipment" && recipe!.outputEquipmentType && equipmentStatConfig) {
        const stats = generateEquipmentStatsFromConfig(equipmentStatConfig);
        const statCap =
          stats != null ? Object.values(stats).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0) : 0;
        const capCeiling = equipmentStatConfig.capMax;
        const inst = await tx.equipmentInstance.create({
          data: {
            userId,
            equipmentTypeId: recipe!.outputEquipmentTypeId!,
            stats: stats ?? undefined,
            statCap,
            capCeiling,
            inheritanceFailCount: 0,
          },
          select: { id: true },
        });
        return {
          kind: "equipment" as const,
          equipmentInstanceId: inst.id,
          name: recipe!.outputEquipmentType!.name,
          stats: stats ?? {},
          statCap,
          capCeiling,
        };
      }

      if (recipe!.outputKind === "mecha_part" && recipe!.outputMechaPartType && mechaPartStatConfig) {
        const stats = generateMechaPartStatsFromConfig(mechaPartStatConfig);
        const inst = await tx.mechaPartInstance.create({
          data: {
            userId,
            mechaPartTypeId: recipe!.outputMechaPartTypeId!,
            stats: stats ?? undefined,
          },
          select: { id: true },
        });
        return {
          kind: "mecha_part" as const,
          mechaPartInstanceId: inst.id,
          name: recipe!.outputMechaPartType!.name,
          stats: stats ?? {},
          slot: recipe!.outputMechaPartType!.slot,
        };
      }

      if (recipe!.outputKind === "item" && recipe!.outputItemId) {
        const itemId = recipe!.outputItemId;
        const itemName = recipe!.outputItem?.name ?? "アイテム";
        const granted = await grantStackableItem(tx, {
          userId,
          itemId,
          delta: 1,
        });
        return { kind: "item" as const, itemId, name: itemName, quantity: granted };
      }

      throw new Error("INVALID_RECIPE");
    });

    revalidatePath("/dashboard/craft");
    revalidatePath("/dashboard/bag");

    if ("equipmentInstanceId" in result) {
      return {
        success: true,
        message: `「${result.name}」を1個作成しました。`,
        equipmentInstanceId: result.equipmentInstanceId,
        equipmentTypeName: result.name,
        equipmentStats: result.stats,
        statCap: result.statCap,
        capCeiling: result.capCeiling,
      };
    }
    if ("mechaPartInstanceId" in result) {
      return {
        success: true,
        message: `「${result.name}」を1個作成しました。`,
        mechaPartInstanceId: result.mechaPartInstanceId,
        mechaPartTypeName: result.name,
        mechaPartStats: result.stats,
        mechaPartSlot: result.slot,
      };
    }
    return {
      success: true,
      message: `「${result.name}」を1個入手しました。`,
      itemId: result.itemId,
      quantity: result.quantity,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVENTORY") {
      return { success: false, error: "INVENTORY", message: "在庫が不足しています。" };
    }
    return { success: false, error: "UNKNOWN", message: "クラフトに失敗しました。" };
  }
}

// --- spec/084 鍛錬 ---

export type TemperableEquipmentInputRow = {
  itemId: string;
  itemName: string;
  amount: number;
};

export type TemperableEquipmentRow = {
  id: string;
  equipmentTypeName: string;
  slot: string;
  stats: Record<string, number>;
  statCap: number;
  capCeiling: number;
  statsSum: number;
  recipeId: string | null;
  recipeName: string | null;
  requiredInputs: TemperableEquipmentInputRow[];
};

/**
 * 鍛錬可能な装備一覧（未装着・statCap/capCeiling 有効・レシピ存在時は必要素材付き）。spec/084 Phase2。
 */
export async function getTemperableEquipment(): Promise<TemperableEquipmentRow[] | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const unlockedIds = await prisma.userCraftRecipeUnlock.findMany({
    where: { userId: session.userId },
    select: { craftRecipeId: true },
  });
  const unlockedSet = new Set(unlockedIds.map((u) => u.craftRecipeId));

  const [instances, recipesByTypeId] = await Promise.all([
    prisma.equipmentInstance.findMany({
      where: {
        userId: session.userId,
        statCap: { gt: 0 },
        capCeiling: { gt: 0 },
      },
      include: {
        equipmentType: { select: { name: true, slot: true, statGenConfig: true } },
        characterEquipments: { take: 1, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.craftRecipe.findMany({
      where: {
        id: { in: [...unlockedSet] },
        outputKind: "equipment",
        outputEquipmentTypeId: { not: null },
      },
      orderBy: { code: "asc" },
      include: {
        inputs: { include: { item: { select: { id: true, name: true } } } },
        outputEquipmentType: { select: { id: true } },
      },
    }),
  ]);

  const recipeByEquipmentTypeId = new Map<string | null, (typeof recipesByTypeId)[0]>();
  for (const r of recipesByTypeId) {
    const typeId = r.outputEquipmentTypeId ?? r.outputEquipmentType?.id;
    if (typeId && !recipeByEquipmentTypeId.has(typeId)) {
      recipeByEquipmentTypeId.set(typeId, r);
    }
  }

  const result: TemperableEquipmentRow[] = [];
  for (const inst of instances) {
    if (inst.characterEquipments.length > 0) continue; // 装着中は除外
    const stats =
      inst.stats && typeof inst.stats === "object" && !Array.isArray(inst.stats)
        ? (inst.stats as Record<string, number>)
        : {};
    const statsSum = Object.values(stats).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
    if (inst.capCeiling < statsSum) continue; // capCeiling >= sum(stats) でないと鍛錬不可
    const recipe = recipeByEquipmentTypeId.get(inst.equipmentTypeId) ?? null;
    const requiredInputs: TemperableEquipmentInputRow[] =
      recipe?.inputs.map((inp) => ({
        itemId: inp.itemId,
        itemName: inp.item.name,
        amount: inp.amount * TEMPER_MATERIAL_MULTIPLIER,
      })) ?? [];
    result.push({
      id: inst.id,
      equipmentTypeName: inst.equipmentType.name,
      slot: inst.equipmentType.slot,
      stats,
      statCap: inst.statCap,
      capCeiling: inst.capCeiling,
      statsSum,
      recipeId: recipe?.id ?? null,
      recipeName: recipe?.name ?? null,
      requiredInputs,
    });
  }
  return result;
}

// --- spec/093 装備解体 ---

const DISMANTLE_RETURN_DIVISOR = 10;

export type DismantleReturnRow = {
  itemId: string;
  itemName: string;
  amount: number;
};

export type DismantlableEquipmentRow = {
  id: string;
  equipmentTypeName: string;
  slot: string;
  stats: Record<string, number>;
  statCap: number;
  capCeiling: number;
  statsSum: number;
  recipeId: string | null;
  recipeName: string | null;
  returnInputs: DismantleReturnRow[];
};

/**
 * 解体可能な装備一覧（未装着・当該装備種別を出力とするレシピが存在するもの）。spec/093。
 */
export async function getDismantlableEquipment(): Promise<DismantlableEquipmentRow[] | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const [instances, recipesByTypeId] = await Promise.all([
    prisma.equipmentInstance.findMany({
      where: { userId: session.userId },
      include: {
        equipmentType: { select: { name: true, slot: true } },
        characterEquipments: { take: 1, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.craftRecipe.findMany({
      where: {
        outputKind: "equipment",
        outputEquipmentTypeId: { not: null },
      },
      orderBy: { code: "asc" },
      include: {
        inputs: { include: { item: { select: { id: true, name: true } } } },
        outputEquipmentType: { select: { id: true } },
      },
    }),
  ]);

  const recipeByEquipmentTypeId = new Map<string | null, (typeof recipesByTypeId)[0]>();
  for (const r of recipesByTypeId) {
    const typeId = r.outputEquipmentTypeId ?? r.outputEquipmentType?.id;
    if (typeId && !recipeByEquipmentTypeId.has(typeId)) {
      recipeByEquipmentTypeId.set(typeId, r);
    }
  }

  const result: DismantlableEquipmentRow[] = [];
  for (const inst of instances) {
    if (inst.characterEquipments.length > 0) continue;
    const recipe = recipeByEquipmentTypeId.get(inst.equipmentTypeId) ?? null;
    if (!recipe) continue;
    const stats =
      inst.stats && typeof inst.stats === "object" && !Array.isArray(inst.stats)
        ? (inst.stats as Record<string, number>)
        : {};
    const statsSum = Object.values(stats).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
    const returnInputs: DismantleReturnRow[] = recipe.inputs.map((inp) => ({
      itemId: inp.itemId,
      itemName: inp.item.name,
      amount: Math.floor(inp.amount / DISMANTLE_RETURN_DIVISOR),
    }));
    result.push({
      id: inst.id,
      equipmentTypeName: inst.equipmentType.name,
      slot: inst.equipmentType.slot,
      stats,
      statCap: inst.statCap,
      capCeiling: inst.capCeiling,
      statsSum,
      recipeId: recipe.id,
      recipeName: recipe.name,
      returnInputs,
    });
  }
  return result;
}

export type DismantleEquipmentResult =
  | { success: true; returned: DismantleReturnRow[] }
  | { success: false; error: string; message: string };

export type DismantleEquipmentBulkResult =
  | { success: true; dismantledCount: number; returned: { itemId: string; itemName: string; totalAmount: number }[] }
  | { success: false; error: string; message: string };

/**
 * 装備 1 件を解体する。未装着・レシピ存在を検証し、返却素材を付与してインスタンス削除。spec/093。
 */
export async function dismantleEquipment(equipmentInstanceId: string): Promise<DismantleEquipmentResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const equipment = await prisma.equipmentInstance.findFirst({
    where: { id: equipmentInstanceId, userId: session.userId },
    include: {
      equipmentType: { select: { id: true } },
      characterEquipments: { take: 1, select: { id: true } },
    },
  });
  if (!equipment) {
    return { success: false, error: "NOT_FOUND", message: "装備が見つかりません。" };
  }
  if (equipment.characterEquipments.length > 0) {
    return { success: false, error: "EQUIPPED", message: "装着中の装備は解体できません。" };
  }

  const recipe = await prisma.craftRecipe.findFirst({
    where: { outputEquipmentTypeId: equipment.equipmentTypeId },
    orderBy: { code: "asc" },
    include: { inputs: { include: { item: { select: { id: true, name: true } } } } },
  });
  if (!recipe) {
    return { success: false, error: "NO_RECIPE", message: "この装備のレシピが見つかりません。" };
  }

  const returned: DismantleReturnRow[] = recipe.inputs.map((inp) => ({
    itemId: inp.itemId,
    itemName: inp.item.name,
    amount: Math.floor(inp.amount / DISMANTLE_RETURN_DIVISOR),
  }));

  await prisma.$transaction(async (tx) => {
    for (const row of returned) {
      if (row.amount > 0) {
        await grantStackableItem(tx, {
          userId: session.userId!,
          itemId: row.itemId,
          delta: row.amount,
        });
      }
    }
    await tx.equipmentInstance.delete({ where: { id: equipmentInstanceId } });
  });

  revalidatePath("/dashboard/craft");
  revalidatePath("/dashboard/bag");
  return { success: true, returned };
}

/**
 * 複数装備を一括解体。1 件でも検証失敗したら全件ロールバック。spec/093。
 */
export async function dismantleEquipmentBulk(
  equipmentInstanceIds: string[]
): Promise<DismantleEquipmentBulkResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  if (equipmentInstanceIds.length === 0) {
    return { success: false, error: "EMPTY", message: "対象が選択されていません。" };
  }

  const uniqIds = [...new Set(equipmentInstanceIds)];
  const instances = await prisma.equipmentInstance.findMany({
    where: { id: { in: uniqIds }, userId: session.userId },
    include: {
      equipmentType: { select: { id: true } },
      characterEquipments: { take: 1, select: { id: true } },
    },
  });
  if (instances.length !== uniqIds.length) {
    return { success: false, error: "NOT_FOUND", message: "一部の装備が見つかりません。" };
  }

  const recipes = await prisma.craftRecipe.findMany({
    where: {
      outputKind: "equipment",
      outputEquipmentTypeId: { in: instances.map((i) => i.equipmentTypeId) },
    },
    orderBy: { code: "asc" },
    include: { inputs: { include: { item: { select: { id: true, name: true } } } } },
  });
  const recipeByTypeId = new Map<string, (typeof recipes)[0]>();
  for (const r of recipes) {
    const typeId = r.outputEquipmentTypeId;
    if (typeId && !recipeByTypeId.has(typeId)) recipeByTypeId.set(typeId, r);
  }

  for (const inst of instances) {
    if (inst.characterEquipments.length > 0) {
      return { success: false, error: "EQUIPPED", message: "装着中の装備が含まれています。" };
    }
    if (!recipeByTypeId.has(inst.equipmentTypeId)) {
      return { success: false, error: "NO_RECIPE", message: "レシピが存在しない装備が含まれています。" };
    }
  }

  const toReturn = new Map<string, { itemName: string; totalAmount: number }>();
  for (const inst of instances) {
    const recipe = recipeByTypeId.get(inst.equipmentTypeId)!;
    for (const inp of recipe.inputs) {
      const amount = Math.floor(inp.amount / DISMANTLE_RETURN_DIVISOR);
      if (amount <= 0) continue;
      const cur = toReturn.get(inp.itemId);
      if (cur) {
        cur.totalAmount += amount;
      } else {
        toReturn.set(inp.itemId, { itemName: inp.item.name, totalAmount: amount });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const [itemId, { totalAmount }] of toReturn) {
      await grantStackableItem(tx, {
        userId: session.userId!,
        itemId,
        delta: totalAmount,
      });
    }
    await tx.equipmentInstance.deleteMany({
      where: { id: { in: uniqIds } },
    });
  });

  revalidatePath("/dashboard/craft");
  revalidatePath("/dashboard/bag");
  return {
    success: true,
    dismantledCount: uniqIds.length,
    returned: [...toReturn.entries()].map(([itemId, { itemName, totalAmount }]) => ({
      itemId,
      itemName,
      totalAmount,
    })),
  };
}

/**
 * 指定装備の鍛錬に必要な材料の必要数とユーザー在庫を返す。鍛錬準備モーダル用。
 */
export async function getTemperMaterialStocks(
  equipmentInstanceId: string
): Promise<{ materialRows: RecipeMaterialStockRow[] } | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const equipment = await prisma.equipmentInstance.findFirst({
    where: { id: equipmentInstanceId, userId: session.userId },
    include: {
      equipmentType: { select: { id: true } },
      characterEquipments: { take: 1, select: { id: true } },
    },
  });
  if (!equipment || equipment.characterEquipments.length > 0) return null;

  const recipe = await prisma.craftRecipe.findFirst({
    where: { outputEquipmentTypeId: equipment.equipmentTypeId },
    include: { inputs: { include: { item: { select: { id: true, name: true } } } } },
  });
  if (!recipe?.inputs.length) return { materialRows: [] };

  const itemIds = recipe.inputs.map((i) => i.itemId);
  const stocks = await prisma.userInventory.findMany({
    where: { userId: session.userId, itemId: { in: itemIds } },
    select: { itemId: true, quantity: true },
  });
  const stockByItemId = new Map(stocks.map((s) => [s.itemId, s.quantity]));

  const multiplier = TEMPER_MATERIAL_MULTIPLIER;
  const materialRows: RecipeMaterialStockRow[] = recipe.inputs.map((inp) => ({
    itemId: inp.itemId,
    itemName: inp.item.name,
    required: inp.amount * multiplier,
    stock: stockByItemId.get(inp.itemId) ?? 0,
  }));

  return { materialRows };
}

export type TemperEquipmentResult =
  | { success: true; message: string; stats: Record<string, number>; statCap: number }
  | { success: false; error: string; message: string };

/**
 * 装備を鍛錬する。spec/084 §2。素材消費・CAP リロール・stats/statCap 更新。
 */
export async function temperEquipment(equipmentInstanceId: string): Promise<TemperEquipmentResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const equipment = await prisma.equipmentInstance.findFirst({
    where: { id: equipmentInstanceId, userId: session.userId },
    include: {
      equipmentType: { select: { id: true, statGenConfig: true } },
      characterEquipments: { take: 1, select: { id: true } },
    },
  });
  if (!equipment) {
    return { success: false, error: "NOT_FOUND", message: "装備が見つかりません。" };
  }
  if (equipment.characterEquipments.length > 0) {
    return { success: false, error: "EQUIPPED", message: "装着中の装備は鍛錬できません。" };
  }
  if (equipment.statCap <= 0 || equipment.capCeiling <= 0) {
    return { success: false, error: "STAT_CAP_INVALID", message: "この装備は鍛錬できません（ステータス未設定）。" };
  }
  const stats =
    equipment.stats && typeof equipment.stats === "object" && !Array.isArray(equipment.stats)
      ? (equipment.stats as Record<string, number>)
      : {};
  const statsSum = Object.values(stats).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
  if (equipment.capCeiling < statsSum) {
    return { success: false, error: "STAT_CAP_INVALID", message: "ステータス合計が上限を超えています。" };
  }

  const config = parseEquipmentStatGenConfig(equipment.equipmentType.statGenConfig);
  if (!config) {
    return { success: false, error: "STAT_GEN_CONFIG_MISSING", message: "この装備種別は鍛錬設定がありません。" };
  }

  const recipe = await prisma.craftRecipe.findFirst({
    where: { outputEquipmentTypeId: equipment.equipmentTypeId },
    orderBy: { code: "asc" },
    include: { inputs: { include: { item: true } } },
  });
  if (!recipe) {
    return { success: false, error: "RECIPE_NOT_FOUND", message: "この装備の製造レシピが見つかりません。" };
  }

  const multiplier = TEMPER_MATERIAL_MULTIPLIER;
  const inventories = await prisma.userInventory.findMany({
    where: { userId: session.userId },
    select: { itemId: true, quantity: true },
  });
  const qtyByItemId = new Map(inventories.map((i) => [i.itemId, i.quantity]));
  for (const inp of recipe.inputs) {
    const need = inp.amount * multiplier;
    const have = qtyByItemId.get(inp.itemId) ?? 0;
    if (have < need) {
      return {
        success: false,
        error: "INVENTORY",
        message: `${inp.item.name}が${need - have}個不足しています。（必要: ${need}）`,
      };
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      for (const inp of recipe.inputs) {
        const row = await tx.userInventory.findUnique({
          where: { userId_itemId: { userId: session.userId!, itemId: inp.itemId } },
        });
        if (!row || row.quantity < inp.amount * multiplier) throw new Error("INVENTORY");
        await tx.userInventory.update({
          where: { userId_itemId: { userId: session.userId!, itemId: inp.itemId } },
          data: { quantity: row.quantity - inp.amount * multiplier },
        });
      }

      const minCap = statsSum;
      const maxCap = equipment.capCeiling;
      const newCap = minCap <= maxCap ? Math.floor(Math.random() * (maxCap - minCap + 1)) + minCap : minCap;
      const newStats = generateEquipmentStatsWithFixedCap(config, newCap);
      if (!newStats) throw new Error("STAT_GEN_FAILED");

      const newStatCap = Object.values(newStats).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
      await tx.equipmentInstance.update({
        where: { id: equipmentInstanceId },
        data: { stats: newStats, statCap: newStatCap },
      });
      return { stats: newStats, statCap: newStatCap };
    });

    revalidatePath("/dashboard/craft");
    revalidatePath("/dashboard/bag");
    return {
      success: true,
      message: "鍛錬しました。ステータスが振り直されました。",
      stats: updated.stats,
      statCap: updated.statCap,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVENTORY") {
      return { success: false, error: "INVENTORY", message: "在庫が不足しています。" };
    }
    return { success: false, error: "UNKNOWN", message: "鍛錬に失敗しました。" };
  }
}

// --- spec/084 継承 ---

export type InheritTargetRow = {
  id: string;
  equipmentTypeName: string;
  slot: string;
  stats: Record<string, number>;
  statCap: number;
  capCeiling: number;
  statsSum: number;
  inheritanceFailCount: number;
  nextSuccessRatePercent: number;
};

export type InheritConsumeOptionRow = {
  id: string;
  equipmentTypeName: string;
  slot: string;
  statCap: number;
  capCeiling: number;
};

/**
 * 継承の対象候補・消費候補。対象は「現在値が上限CAPに達している」未装着装備のみ。消費は未装着装備すべて（上限CAPでフィルタはUI側）。spec/084 Phase3。
 */
export async function getInheritCandidates(): Promise<{
  targets: InheritTargetRow[];
  consumeOptions: InheritConsumeOptionRow[];
} | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const instances = await prisma.equipmentInstance.findMany({
    where: { userId: session.userId },
    include: {
      equipmentType: { select: { name: true, slot: true } },
      characterEquipments: { take: 1, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const targets: InheritTargetRow[] = [];
  const consumeOptions: InheritConsumeOptionRow[] = [];

  for (const inst of instances) {
    if (inst.characterEquipments.length > 0) continue;
    const stats =
      inst.stats && typeof inst.stats === "object" && !Array.isArray(inst.stats)
        ? (inst.stats as Record<string, number>)
        : {};
    const statsSum = Object.values(stats).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
    const nextRate = Math.min(
      100,
      INHERIT_BASE_SUCCESS_RATE_PERCENT + inst.inheritanceFailCount * INHERIT_SUCCESS_RATE_INCREMENT
    );
    consumeOptions.push({
      id: inst.id,
      equipmentTypeName: inst.equipmentType.name,
      slot: inst.equipmentType.slot,
      statCap: inst.statCap,
      capCeiling: inst.capCeiling,
    });
    const isMaxedToCeiling = inst.capCeiling > 0 && statsSum === inst.capCeiling;
    if (isMaxedToCeiling) {
      targets.push({
        id: inst.id,
        equipmentTypeName: inst.equipmentType.name,
        slot: inst.equipmentType.slot,
        stats,
        statCap: inst.statCap,
        capCeiling: inst.capCeiling,
        statsSum,
        inheritanceFailCount: inst.inheritanceFailCount,
        nextSuccessRatePercent: nextRate,
      });
    }
  }
  return { targets, consumeOptions };
}

export type InheritEquipmentCapResult =
  | { success: true; message: string; statCap: number; capCeiling: number }
  | {
      success: false;
      error: string;
      message: string;
      reason?: "INHERIT_FAILED";
      nextSuccessRatePercent?: number;
    };

/**
 * 継承を実行する。対象の statCap/capCeiling を消費装備の値に引き上げ。成功率判定あり。spec/084 §3。
 */
export async function inheritEquipmentCap(
  targetEquipmentInstanceId: string,
  consumeEquipmentInstanceId: string
): Promise<InheritEquipmentCapResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  if (targetEquipmentInstanceId === consumeEquipmentInstanceId) {
    return { success: false, error: "SAME_EQUIPMENT", message: "対象と消費に同じ装備は指定できません。" };
  }

  const [target, consume] = await Promise.all([
    prisma.equipmentInstance.findFirst({
      where: { id: targetEquipmentInstanceId, userId: session.userId },
      include: { equipmentType: { select: { name: true } }, characterEquipments: { take: 1 } },
    }),
    prisma.equipmentInstance.findFirst({
      where: { id: consumeEquipmentInstanceId, userId: session.userId },
      include: { characterEquipments: { take: 1 } },
    }),
  ]);
  if (!target) {
    return { success: false, error: "NOT_FOUND", message: "対象装備が見つかりません。" };
  }
  if (!consume) {
    return { success: false, error: "NOT_FOUND", message: "消費装備が見つかりません。" };
  }
  if (target.characterEquipments.length > 0) {
    return { success: false, error: "EQUIPPED", message: "対象装備は装着中のため継承できません。" };
  }
  if (consume.characterEquipments.length > 0) {
    return { success: false, error: "EQUIPPED", message: "消費装備は装着中のため継承できません。" };
  }

  const targetStats =
    target.stats && typeof target.stats === "object" && !Array.isArray(target.stats)
      ? (target.stats as Record<string, number>)
      : {};
  const targetStatsSum = Object.values(targetStats).reduce(
    (s, v) => s + (typeof v === "number" ? v : 0),
    0
  );
  if (targetStatsSum !== target.capCeiling) {
    return {
      success: false,
      error: "STAT_SUM_MISMATCH",
      message: "対象装備は現在値が上限CAPに達している状態でのみ継承できます。",
    };
  }
  if (consume.capCeiling <= target.capCeiling) {
    return {
      success: false,
      error: "CAP_NOT_HIGHER",
      message: "消費装備の上限CAPが対象より高い必要があります。",
    };
  }

  const successRate = Math.min(
    100,
    INHERIT_BASE_SUCCESS_RATE_PERCENT + target.inheritanceFailCount * INHERIT_SUCCESS_RATE_INCREMENT
  );
  const roll = Math.floor(Math.random() * 100) + 1;
  const success = roll <= successRate;

  try {
    if (success) {
      await prisma.$transaction(async (tx) => {
        await tx.equipmentInstance.update({
          where: { id: targetEquipmentInstanceId },
          data: {
            statCap: consume.statCap,
            capCeiling: consume.capCeiling,
            inheritanceFailCount: 0,
          },
        });
        await tx.equipmentInstance.delete({ where: { id: consumeEquipmentInstanceId } });
      });
      revalidatePath("/dashboard/craft");
      revalidatePath("/dashboard/bag");
      return {
        success: true,
        message: "継承に成功しました。対象装備の上限が引き上げられました。",
        statCap: consume.statCap,
        capCeiling: consume.capCeiling,
      };
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.equipmentInstance.update({
          where: { id: targetEquipmentInstanceId },
          data: { inheritanceFailCount: target.inheritanceFailCount + 1 },
        });
        await tx.equipmentInstance.delete({ where: { id: consumeEquipmentInstanceId } });
      });
      const nextRate = Math.min(
        100,
        INHERIT_BASE_SUCCESS_RATE_PERCENT +
          (target.inheritanceFailCount + 1) * INHERIT_SUCCESS_RATE_INCREMENT
      );
      revalidatePath("/dashboard/craft");
      revalidatePath("/dashboard/bag");
      return {
        success: false,
        error: "INHERIT_FAILED",
        message: `継承に失敗しました。消費装備は失われました。次の成功率は ${nextRate}％ です。`,
        reason: "INHERIT_FAILED",
        nextSuccessRatePercent: nextRate,
      };
    }
  } catch (e) {
    return { success: false, error: "UNKNOWN", message: "継承の処理に失敗しました。" };
  }
}

/**
 * 指定キャラの指定スロットに装備を装着。spec/046。
 */
export async function equipEquipment(
  characterId: string,
  slot: string,
  equipmentInstanceId: string
): Promise<{ success: true } | { success: false; error: string; message: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  if (!isEquipmentSlot(slot)) {
    return { success: false, error: "INVALID_SLOT", message: "無効なスロットです。" };
  }

  const [character, equipment] = await Promise.all([
    prisma.character.findFirst({
      where: { id: characterId, userId: session.userId },
      select: { id: true },
    }),
    prisma.equipmentInstance.findFirst({
      where: { id: equipmentInstanceId, userId: session.userId },
      select: { id: true },
    }),
  ]);
  if (!character) {
    return { success: false, error: "NOT_FOUND", message: "キャラクターが見つかりません。" };
  }
  if (!equipment) {
    return { success: false, error: "NOT_FOUND", message: "装備が見つかりません。" };
  }

  await prisma.characterEquipment.upsert({
    where: { characterId_slot: { characterId, slot } },
    create: { characterId, slot, equipmentInstanceId },
    update: { equipmentInstanceId },
  });
  revalidatePath("/dashboard/equipment");
  revalidatePath("/dashboard/characters");
  revalidatePath("/dashboard/bag");
  return { success: true };
}

/**
 * 指定キャラの指定スロットから装備を外す。spec/046。
 */
export async function unequipEquipment(
  characterId: string,
  slot: string
): Promise<{ success: true } | { success: false; error: string; message: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  if (!isEquipmentSlot(slot)) {
    return { success: false, error: "INVALID_SLOT", message: "無効なスロットです。" };
  }

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: { id: true },
  });
  if (!character) {
    return { success: false, error: "NOT_FOUND", message: "キャラクターが見つかりません。" };
  }

  await prisma.characterEquipment.upsert({
    where: { characterId_slot: { characterId, slot } },
    create: { characterId, slot, equipmentInstanceId: null },
    update: { equipmentInstanceId: null },
  });
  revalidatePath("/dashboard/equipment");
  revalidatePath("/dashboard/characters");
  revalidatePath("/dashboard/bag");
  return { success: true };
}

/**
 * 指定キャラの装着状況（スロットごとの装備個体）を返す。spec/046。
 */
export async function getCharacterEquipment(
  characterId: string
): Promise<GetCharacterEquipmentResult | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: { id: true },
  });
  if (!character) return null;

  const { EQUIPMENT_SLOTS } = await import("@/lib/constants/equipment-slots");
  const rows = await prisma.characterEquipment.findMany({
    where: { characterId },
    include: {
      equipmentInstance: {
        include: { equipmentType: { select: { name: true } } },
      },
    },
  });
  const bySlot = new Map(rows.map((r) => [r.slot, r]));

  const slots: CharacterEquipmentSlot[] = EQUIPMENT_SLOTS.map((slot) => {
    const row = bySlot.get(slot);
    const inst = row?.equipmentInstance;
    return {
      slot,
      equipmentInstanceId: inst?.id ?? null,
      equipmentInstanceName: inst?.equipmentType.name ?? null,
      statsSummary: inst?.stats ? JSON.stringify(inst.stats).slice(0, 60) : null,
    };
  });

  return { characterId, slots };
}

export type EquipmentInstanceWithEquipped = {
  id: string;
  equipmentTypeName: string;
  slot: string;
  /** 戦闘用ステ補正。PATK, PDEF 等。装着モーダルで一覧表示用 */
  stats: Record<string, number> | null;
  equippedCharacterId: string | null;
};

/**
 * ユーザー所持の装備個体一覧と、各々の装着先キャラ（未装着なら null）。装備画面で「このスロットに装着可能」を判定する用。
 */
export async function getEquipmentInstancesWithEquipped(): Promise<
  EquipmentInstanceWithEquipped[] | null
> {
  const session = await getSession();
  if (!session?.userId) return null;

  const instances = await prisma.equipmentInstance.findMany({
    where: { userId: session.userId },
    include: {
      equipmentType: { select: { name: true, slot: true } },
      characterEquipments: { take: 1, select: { characterId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return instances.map((inst) => ({
    id: inst.id,
    equipmentTypeName: inst.equipmentType.name,
    slot: inst.equipmentType.slot,
    stats:
      inst.stats && typeof inst.stats === "object" && !Array.isArray(inst.stats)
        ? (inst.stats as Record<string, number>)
        : null,
    equippedCharacterId: inst.characterEquipments[0]?.characterId ?? null,
  }));
}
