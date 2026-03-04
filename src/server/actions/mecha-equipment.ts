"use server";

// spec/044, 046 - メカパーツの着脱（個体参照）

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isMechaSlot } from "@/lib/constants/mecha-slots";
import { MECHA_SLOTS } from "@/lib/constants/mecha-slots";

export type MechaEquipmentSlotRow = {
  slot: string;
  mechaPartInstanceId: string | null;
  mechaPartTypeName: string | null;
  statsSummary: string | null;
};

export type GetMechaEquipmentResult = {
  characterId: string;
  slots: MechaEquipmentSlotRow[];
} | null;

export type MechaPartInstanceWithEquipped = {
  id: string;
  mechaPartTypeName: string;
  slot: string;
  statsSummary: string | null;
  equippedCharacterId: string | null;
};

/**
 * メカの装着状況（部位ごとのパーツ個体）。spec/046。
 */
export async function getMechaEquipment(
  characterId: string
): Promise<GetMechaEquipmentResult | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  const mech = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId, category: "mech" },
    select: { id: true },
  });
  if (!mech) return null;

  const rows = await prisma.mechaEquipment.findMany({
    where: { characterId },
    include: {
      mechaPartInstance: {
        include: { mechaPartType: { select: { name: true } } },
      },
      mechaPartType: { select: { name: true } },
    },
  });
  const bySlot = new Map(rows.map((r) => [r.slot, r]));

  const slots: MechaEquipmentSlotRow[] = MECHA_SLOTS.map((slot) => {
    const row = bySlot.get(slot);
    const inst = row?.mechaPartInstance;
    const typeFromInstance = inst?.mechaPartType?.name;
    const typeFromLegacy = row?.mechaPartType?.name;
    return {
      slot,
      mechaPartInstanceId: inst?.id ?? null,
      mechaPartTypeName: typeFromInstance ?? typeFromLegacy ?? null,
      statsSummary: inst?.stats ? JSON.stringify(inst.stats).slice(0, 60) : null,
    };
  });

  return { characterId, slots };
}

/**
 * ユーザー所持のメカパーツ個体一覧と装着先メカ（未装着なら null）。着脱UI用。
 */
export async function getMechaPartInstancesWithEquipped(): Promise<
  MechaPartInstanceWithEquipped[] | null
> {
  const session = await getSession();
  if (!session?.userId) return null;

  const instances = await prisma.mechaPartInstance.findMany({
    where: { userId: session.userId },
    include: {
      mechaPartType: { select: { name: true, slot: true } },
      mechaEquipments: { take: 1, select: { characterId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return instances.map((inst) => ({
    id: inst.id,
    mechaPartTypeName: inst.mechaPartType.name,
    slot: inst.mechaPartType.slot,
    statsSummary: inst.stats ? JSON.stringify(inst.stats).slice(0, 60) : null,
    equippedCharacterId: inst.mechaEquipments[0]?.characterId ?? null,
  }));
}

/**
 * メカの指定部位にパーツ個体を装着。spec/046。
 */
export async function equipMechaPart(
  characterId: string,
  slot: string,
  mechaPartInstanceId: string
): Promise<{ success: true } | { success: false; error: string; message: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  if (!isMechaSlot(slot)) {
    return { success: false, error: "INVALID_SLOT", message: "無効な部位です。" };
  }

  const [mech, instance] = await Promise.all([
    prisma.character.findFirst({
      where: { id: characterId, userId: session.userId, category: "mech" },
      select: { id: true },
    }),
    prisma.mechaPartInstance.findFirst({
      where: { id: mechaPartInstanceId, userId: session.userId },
      include: { mechaPartType: { select: { slot: true } } },
    }),
  ]);
  if (!mech) {
    return { success: false, error: "NOT_FOUND", message: "メカが見つかりません。" };
  }
  if (!instance) {
    return { success: false, error: "NOT_FOUND", message: "パーツが見つかりません。" };
  }
  if (instance.mechaPartType.slot !== slot) {
    return { success: false, error: "SLOT_MISMATCH", message: "この部位用のパーツではありません。" };
  }

  await prisma.mechaEquipment.upsert({
    where: { characterId_slot: { characterId, slot } },
    create: {
      characterId,
      slot,
      mechaPartInstanceId,
    },
    update: { mechaPartInstanceId, mechaPartTypeId: null },
  });
  revalidatePath("/dashboard/characters");
  revalidatePath("/dashboard/bag");
  return { success: true };
}

/**
 * メカの指定部位からパーツを外す。spec/046。
 */
export async function unequipMechaPart(
  characterId: string,
  slot: string
): Promise<{ success: true } | { success: false; error: string; message: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }
  if (!isMechaSlot(slot)) {
    return { success: false, error: "INVALID_SLOT", message: "無効な部位です。" };
  }

  const mech = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId, category: "mech" },
    select: { id: true },
  });
  if (!mech) {
    return { success: false, error: "NOT_FOUND", message: "メカが見つかりません。" };
  }

  const existing = await prisma.mechaEquipment.findUnique({
    where: { characterId_slot: { characterId, slot } },
    select: { id: true },
  });
  if (existing) {
    await prisma.mechaEquipment.update({
      where: { id: existing.id },
      data: { mechaPartInstanceId: null, mechaPartTypeId: null },
    });
  }
  revalidatePath("/dashboard/characters");
  revalidatePath("/dashboard/bag");
  return { success: true };
}
