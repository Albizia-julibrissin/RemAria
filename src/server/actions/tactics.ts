"use server";

// spec/039: 作戦室 - パーティプリセットと作戦スロットの取得・保存

import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { characterRepository } from "@/server/repositories/character-repository";
import { revalidatePath } from "next/cache";

// --- パーティプリセット ---

export type PartyPresetWithCharacters = {
  id: string;
  name: string | null;
  slot1: { characterId: string; displayName: string; category: string; battleCol: number } | null;
  slot2: { characterId: string; displayName: string; category: string; battleCol: number } | null;
  slot3: { characterId: string; displayName: string; category: string; battleCol: number } | null;
};

function clampBattleCol(v: number | null | undefined): number {
  if (v == null) return 1;
  return Math.max(1, Math.min(3, v));
}

/** ログインユーザーのパーティプリセット一覧を取得 */
export async function getPartyPresets() {
  const session = await getSession();
  if (!session.userId) return { presets: [] as PartyPresetWithCharacters[], error: "UNAUTHORIZED" as const };

  const presets = await prisma.partyPreset.findMany({
    where: { userId: session.userId },
    include: {
      slot1Character: { select: { id: true, displayName: true, category: true } },
      slot2Character: { select: { id: true, displayName: true, category: true } },
      slot3Character: { select: { id: true, displayName: true, category: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result: PartyPresetWithCharacters[] = presets.map((p) => ({
    id: p.id,
    name: p.name ?? null,
    slot1: p.slot1Character ? { characterId: p.slot1Character.id, displayName: p.slot1Character.displayName, category: p.slot1Character.category, battleCol: clampBattleCol(p.slot1BattleCol) } : null,
    slot2: p.slot2Character ? { characterId: p.slot2Character.id, displayName: p.slot2Character.displayName, category: p.slot2Character.category, battleCol: clampBattleCol(p.slot2BattleCol) } : null,
    slot3: p.slot3Character ? { characterId: p.slot3Character.id, displayName: p.slot3Character.displayName, category: p.slot3Character.category, battleCol: clampBattleCol(p.slot3BattleCol) } : null,
  }));

  return { presets: result };
}

/** 1件のプリセットを取得（編成3人分の情報付き）。他人のプリセットは null */
export async function getPartyPresetWithCharacters(presetId: string) {
  const session = await getSession();
  if (!session.userId) return null;

  const preset = await prisma.partyPreset.findFirst({
    where: { id: presetId, userId: session.userId },
    include: {
      slot1Character: { select: { id: true, displayName: true, category: true } },
      slot2Character: { select: { id: true, displayName: true, category: true } },
      slot3Character: { select: { id: true, displayName: true, category: true } },
    },
  });
  if (!preset) return null;

  return {
    id: preset.id,
    name: preset.name ?? null,
    slot1: preset.slot1Character ? { characterId: preset.slot1Character.id, displayName: preset.slot1Character.displayName, category: preset.slot1Character.category, battleCol: clampBattleCol(preset.slot1BattleCol) } : null,
    slot2: preset.slot2Character ? { characterId: preset.slot2Character.id, displayName: preset.slot2Character.displayName, category: preset.slot2Character.category, battleCol: clampBattleCol(preset.slot2BattleCol) } : null,
    slot3: preset.slot3Character ? { characterId: preset.slot3Character.id, displayName: preset.slot3Character.displayName, category: preset.slot3Character.category, battleCol: clampBattleCol(preset.slot3BattleCol) } : null,
  };
}

export type CreatePartyPresetResult =
  | { success: true; presetId: string }
  | { success: false; error: string; message: string };

/** 新規プリセット作成。slot1=主人公で作成。失敗時は message を返す。 */
export async function createPartyPreset(): Promise<CreatePartyPresetResult> {
  const session = await getSession();
  if (!session.userId) return { success: false as const, error: "UNAUTHORIZED", message: "ログインし直してください" };

  const protagonist = await characterRepository.getProtagonistByUserId(session.userId);
  if (!protagonist) return { success: false as const, error: "NO_PROTAGONIST", message: "主人公が存在しません" };

  const count = await prisma.partyPreset.count({ where: { userId: session.userId } });
  const name = `プリセット${count + 1}`;

  const preset = await prisma.partyPreset.create({
    data: {
      userId: session.userId,
      name,
      slot1CharacterId: protagonist.id,
    },
    select: { id: true },
  });
  revalidatePath("/dashboard/tactics");
  return { success: true as const, presetId: preset.id };
}

/** 新規プリセット作成後に作戦室の編集画面へリダイレクト。form action 用（戻り値 void） */
export async function createPartyPresetFormAction(): Promise<void> {
  const result = await createPartyPreset();
  if (result.success) {
    const { redirect } = await import("next/navigation");
    redirect(`/dashboard/tactics?presetId=${result.presetId}`);
  }
}

/** プリセットの編成・名前・列位置を更新。slot1 のキャラは変更不可。 */
export async function updatePartyPreset(
  presetId: string,
  data: {
    name?: string | null;
    slot2CharacterId?: string | null;
    slot3CharacterId?: string | null;
    slot1BattleCol?: number;
    slot2BattleCol?: number | null;
    slot3BattleCol?: number | null;
  }
) {
  const session = await getSession();
  if (!session.userId) return { success: false as const, error: "UNAUTHORIZED" as const };

  const preset = await prisma.partyPreset.findFirst({
    where: { id: presetId, userId: session.userId },
    select: { id: true },
  });
  if (!preset) return { success: false as const, error: "NOT_FOUND" as const };

  const slot2Id = data.slot2CharacterId?.trim() || null;
  const slot3Id = data.slot3CharacterId?.trim() || null;
  if (slot2Id || slot3Id) {
    const chars = await prisma.character.findMany({
      where: { userId: session.userId },
      select: { id: true },
    });
    const ids = new Set(chars.map((c) => c.id));
    if (slot2Id && !ids.has(slot2Id)) return { success: false as const, error: "INVALID_CHARACTER" as const };
    if (slot3Id && !ids.has(slot3Id)) return { success: false as const, error: "INVALID_CHARACTER" as const };
  }

  const updateData: Parameters<typeof prisma.partyPreset.update>[0]["data"] = {};
  if (data.name !== undefined) updateData.name = data.name ?? null;
  if (data.slot1BattleCol !== undefined) updateData.slot1BattleCol = clampBattleCol(data.slot1BattleCol);
  if (data.slot2BattleCol !== undefined) updateData.slot2BattleCol = data.slot2BattleCol == null ? null : clampBattleCol(data.slot2BattleCol);
  if (data.slot3BattleCol !== undefined) updateData.slot3BattleCol = data.slot3BattleCol == null ? null : clampBattleCol(data.slot3BattleCol);
  if (data.slot2CharacterId !== undefined) {
    updateData.slot2Character = slot2Id ? { connect: { id: slot2Id } } : { disconnect: true };
  }
  if (data.slot3CharacterId !== undefined) {
    updateData.slot3Character = slot3Id ? { connect: { id: slot3Id } } : { disconnect: true };
  }

  await prisma.partyPreset.update({
    where: { id: presetId },
    data: updateData,
  });
  revalidatePath("/dashboard/tactics");
  return { success: true as const };
}

// --- 作戦スロット ---

export type TacticSlotRow = {
  orderIndex: number;
  subject: string;
  conditionKind: string;
  conditionParam: Record<string, unknown> | null;
  actionType: string;
  skillId: string | null;
};

/** 指定した 3 キャラ分の作戦スロットを取得。所有キャラ以外は無視 */
export async function getTacticsForCharacters(characterIds: string[]) {
  const session = await getSession();
  if (!session.userId) return { tactics: [], error: "UNAUTHORIZED" as const };

  const owned = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId: session.userId },
    select: { id: true },
  });
  const allowedIds = new Set(owned.map((c) => c.id));
  const ids = characterIds.filter((id) => allowedIds.has(id));
  if (ids.length === 0) return { tactics: [] as { characterId: string; slots: TacticSlotRow[] }[] };

  const slots = await prisma.tacticSlot.findMany({
    where: { characterId: { in: ids } },
    orderBy: [{ characterId: "asc" }, { orderIndex: "asc" }],
    select: { characterId: true, orderIndex: true, subject: true, conditionKind: true, conditionParam: true, actionType: true, skillId: true },
  });

  const byChar = new Map<string, TacticSlotRow[]>();
  for (const id of ids) byChar.set(id, []);
  for (const s of slots) {
    const list = byChar.get(s.characterId)!;
    list.push({
      orderIndex: s.orderIndex,
      subject: s.subject,
      conditionKind: s.conditionKind,
      conditionParam: s.conditionParam as Record<string, unknown> | null,
      actionType: s.actionType,
      skillId: s.skillId,
    });
  }

  const tactics = ids.map((characterId) => ({
    characterId,
    slots: byChar.get(characterId) ?? [],
  }));
  return { tactics };
}

/** 1 キャラ分の作戦スロットを一括置換（1～10）。所有キャラのみ */
export async function upsertTacticsForCharacter(characterId: string, slots: TacticSlotRow[]) {
  const session = await getSession();
  if (!session.userId) return { success: false as const, error: "UNAUTHORIZED" as const };

  const char = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: { id: true },
  });
  if (!char) return { success: false as const, error: "NOT_FOUND" as const };

  const valid = slots.filter((s) => s.orderIndex >= 1 && s.orderIndex <= 10);
  const orderSet = new Set(valid.map((s) => s.orderIndex));
  if (orderSet.size !== valid.length) return { success: false as const, error: "VALIDATION" as const };

  await prisma.$transaction(async (tx) => {
    await tx.tacticSlot.deleteMany({ where: { characterId } });
    if (valid.length === 0) return;
    await tx.tacticSlot.createMany({
      data: valid.map((s) => ({
        characterId,
        orderIndex: s.orderIndex,
        subject: s.subject,
        conditionKind: s.conditionKind,
        conditionParam: (s.conditionParam ?? undefined) as Prisma.InputJsonValue | undefined,
        actionType: s.actionType,
        skillId: s.skillId || null,
      })),
    });
  });
  revalidatePath("/dashboard/tactics");
  return { success: true as const };
}

/** 作戦室用：プリセット編成＋3人分の作戦を一括保存 */
export async function savePresetWithTactics(
  presetId: string,
  presetData: {
    name?: string | null;
    slot2CharacterId?: string | null;
    slot3CharacterId?: string | null;
    slot1BattleCol?: number;
    slot2BattleCol?: number | null;
    slot3BattleCol?: number | null;
  },
  tacticsByCharacter: { characterId: string; slots: TacticSlotRow[] }[]
) {
  const session = await getSession();
  if (!session.userId) return { success: false as const, error: "UNAUTHORIZED" as const };

  const preset = await prisma.partyPreset.findFirst({
    where: { id: presetId, userId: session.userId },
    select: { id: true, slot1CharacterId: true, slot2CharacterId: true, slot3CharacterId: true },
  });
  if (!preset) return { success: false as const, error: "NOT_FOUND" as const };

  await updatePartyPreset(presetId, presetData);
  for (const { characterId, slots } of tacticsByCharacter) {
    const res = await upsertTacticsForCharacter(characterId, slots);
    if (!res.success) return res;
  }
  return { success: true as const };
}

// --- 戦闘スキル一覧（行動プルダウン用） ---

export type BattleSkillOption = { id: string; name: string; battleSkillType: string | null };

/** 作戦室用：仲間・メカの一覧（slot2/slot3 の選択肢） */
export async function getCharactersForPartySlots() {
  const session = await getSession();
  if (!session.userId) return { companions: [], mechs: [] };

  const characters = await prisma.character.findMany({
    where: { userId: session.userId },
    select: { id: true, displayName: true, category: true },
    orderBy: { createdAt: "asc" },
  });
  const companions = characters.filter((c) => c.category === "companion").map((c) => ({ id: c.id, displayName: c.displayName }));
  const mechs = characters.filter((c) => c.category === "mech").map((c) => ({ id: c.id, displayName: c.displayName }));
  return { companions, mechs };
}

/** 指定キャラが習得している戦闘スキルのみ取得（作戦の行動プルダウン用） */
export async function getBattleSkillsForCharacters(characterIds: string[]) {
  const session = await getSession();
  if (!session.userId || characterIds.length === 0) return {} as Record<string, BattleSkillOption[]>;

  const allowed = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId: session.userId },
    select: { id: true },
  });
  const allowedSet = new Set(allowed.map((c) => c.id));

  const learned = await prisma.characterSkill.findMany({
    where: {
      characterId: { in: characterIds },
      skill: { category: "battle_active" },
    },
    select: {
      characterId: true,
      skill: { select: { id: true, name: true, battleSkillType: true } },
    },
  });

  const byChar: Record<string, BattleSkillOption[]> = {};
  for (const id of characterIds) {
    if (!allowedSet.has(id)) continue;
    byChar[id] = learned
      .filter((l) => l.characterId === id)
      .map((l) => ({
        id: l.skill.id,
        name: l.skill.name,
        battleSkillType: l.skill.battleSkillType,
      }))
      .sort((a, b) => (a.battleSkillType ?? "").localeCompare(b.battleSkillType ?? "") || a.name.localeCompare(b.name));
  }
  return byChar;
}
