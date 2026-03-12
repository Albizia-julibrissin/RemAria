"use server";

// spec/046 - アイテムクラフト・装備着脱

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isEquipmentSlot } from "@/lib/constants/equipment-slots";
import {
  type EquipmentStatGenConfig,
  generateEquipmentStatsFromConfig,
} from "@/lib/craft/equipment-stat-gen";
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
  | { success: true; message: string; equipmentInstanceId?: string; mechaPartInstanceId?: string; itemId?: string; quantity?: number }
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
      return { kind: r.outputKind as "item", itemName: "不明" };
    })(),
  }));
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
        const inst = await tx.equipmentInstance.create({
          data: {
            userId,
            equipmentTypeId: recipe!.outputEquipmentTypeId!,
            stats: stats ?? undefined,
          },
          select: { id: true },
        });
        return {
          kind: "equipment" as const,
          equipmentInstanceId: inst.id,
          name: recipe!.outputEquipmentType!.name,
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
      };
    }
    if ("mechaPartInstanceId" in result) {
      return {
        success: true,
        message: `「${result.name}」を1個作成しました。`,
        mechaPartInstanceId: result.mechaPartInstanceId,
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
