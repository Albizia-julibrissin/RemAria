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

/** ダッシュボード・探索開始フォーム用：id と name だけの軽量一覧（編成の中身は取らない） */
export type PartyPresetListItem = { id: string; name: string | null };

export async function getPartyPresetListForExploration(): Promise<
  { presets: PartyPresetListItem[] } | { error: "UNAUTHORIZED" }
> {
  const session = await getSession();
  if (!session.userId) return { error: "UNAUTHORIZED" as const };

  const presets = await prisma.partyPreset.findMany({
    where: { userId: session.userId },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    presets: presets.map((p) => ({ id: p.id, name: p.name ?? null })),
  };
}

/** 作戦室のプリセット一覧用：id・name・3スロットの表示名だけ（編集時は使わない） */
export type PartyPresetListForTacticsItem = {
  id: string;
  name: string | null;
  slot1DisplayName: string | null;
  slot2DisplayName: string | null;
  slot3DisplayName: string | null;
};

export async function getPartyPresetListForTacticsPage(): Promise<
  { presets: PartyPresetListForTacticsItem[]; presetLimit: number } | { error: "UNAUTHORIZED" }
> {
  const session = await getSession();
  if (!session.userId) return { error: "UNAUTHORIZED" as const };

  const [user, presets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { partyPresetLimit: true },
    }),
    prisma.partyPreset.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        name: true,
        user: { select: { name: true } },
        slot1Character: { select: { displayName: true, category: true } },
        slot2Character: { select: { displayName: true } },
        slot3Character: { select: { displayName: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const presetLimit = user?.partyPresetLimit ?? 5;

  return {
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name ?? null,
      slot1DisplayName: p.slot1Character
        ? p.slot1Character.category === "protagonist"
          ? p.user.name
          : p.slot1Character.displayName
        : null,
      slot2DisplayName: p.slot2Character?.displayName ?? null,
      slot3DisplayName: p.slot3Character?.displayName ?? null,
    })),
    presetLimit,
  };
}

/** ログインユーザーのパーティプリセット一覧を取得（編成3人分の情報付き。作戦室の編集時などで使用） */
export async function getPartyPresets() {
  const session = await getSession();
  if (!session.userId) return { presets: [] as PartyPresetWithCharacters[], error: "UNAUTHORIZED" as const };

  const presets = await prisma.partyPreset.findMany({
    where: { userId: session.userId },
    include: {
      user: { select: { name: true } },
      slot1Character: { select: { id: true, displayName: true, category: true } },
      slot2Character: { select: { id: true, displayName: true, category: true } },
      slot3Character: { select: { id: true, displayName: true, category: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const result: PartyPresetWithCharacters[] = presets.map((p) => ({
    id: p.id,
    name: p.name ?? null,
    slot1: p.slot1Character ? { characterId: p.slot1Character.id, displayName: p.slot1Character.category === "protagonist" ? p.user.name : p.slot1Character.displayName, category: p.slot1Character.category, battleCol: clampBattleCol(p.slot1BattleCol) } : null,
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
      user: { select: { name: true } },
      slot1Character: { select: { id: true, displayName: true, category: true } },
      slot2Character: { select: { id: true, displayName: true, category: true } },
      slot3Character: { select: { id: true, displayName: true, category: true } },
    },
  });
  if (!preset) return null;

  return {
    id: preset.id,
    name: preset.name ?? null,
    slot1: preset.slot1Character ? { characterId: preset.slot1Character.id, displayName: preset.slot1Character.category === "protagonist" ? preset.user.name : preset.slot1Character.displayName, category: preset.slot1Character.category, battleCol: clampBattleCol(preset.slot1BattleCol) } : null,
    slot2: preset.slot2Character ? { characterId: preset.slot2Character.id, displayName: preset.slot2Character.displayName, category: preset.slot2Character.category, battleCol: clampBattleCol(preset.slot2BattleCol) } : null,
    slot3: preset.slot3Character ? { characterId: preset.slot3Character.id, displayName: preset.slot3Character.displayName, category: preset.slot3Character.category, battleCol: clampBattleCol(preset.slot3BattleCol) } : null,
  };
}

export type CreatePartyPresetResult =
  | { success: true; presetId: string }
  | { success: false; error: string; message: string };

/** 新規プリセット作成。slot1=主人公で作成。上限（User.partyPresetLimit）を超えると作成不可。失敗時は message を返す。 */
export async function createPartyPreset(): Promise<CreatePartyPresetResult> {
  const session = await getSession();
  if (!session.userId) return { success: false as const, error: "UNAUTHORIZED", message: "ログインし直してください" };

  const protagonist = await characterRepository.getProtagonistByUserId(session.userId);
  if (!protagonist) return { success: false as const, error: "NO_PROTAGONIST", message: "主人公が存在しません" };

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { partyPresetLimit: true },
  });
  const limit = user?.partyPresetLimit ?? 5;
  const count = await prisma.partyPreset.count({ where: { userId: session.userId } });
  if (count >= limit) {
    return { success: false as const, error: "PRESET_LIMIT_REACHED", message: `プリセットは${limit}件までです。` };
  }

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

/** spec/063: プリセットに紐づく作戦スロットを取得。characterIds 省略時はプリセットの編成 3 人分。 */
export async function getTacticsForPreset(
  presetId: string,
  characterIds?: string[]
): Promise<
  | { tactics: { characterId: string; slots: TacticSlotRow[] }[] }
  | { tactics: []; error: "UNAUTHORIZED" | "NOT_FOUND" }
> {
  const session = await getSession();
  if (!session.userId) return { tactics: [], error: "UNAUTHORIZED" as const };

  const preset = await prisma.partyPreset.findFirst({
    where: { id: presetId, userId: session.userId },
    select: { id: true, slot1CharacterId: true, slot2CharacterId: true, slot3CharacterId: true },
  });
  if (!preset) return { tactics: [], error: "NOT_FOUND" as const };

  const ids =
    characterIds ??
    [preset.slot1CharacterId, preset.slot2CharacterId, preset.slot3CharacterId].filter(Boolean) as string[];

  if (ids.length === 0) return { tactics: [] };

  const owned = await prisma.character.findMany({
    where: { id: { in: ids }, userId: session.userId },
    select: { id: true },
  });
  const allowedIds = new Set(owned.map((c) => c.id));
  const filteredIds = ids.filter((id) => allowedIds.has(id));

  const slots = await prisma.presetTacticSlot.findMany({
    where: { partyPresetId: presetId, characterId: { in: filteredIds } },
    orderBy: [{ characterId: "asc" }, { orderIndex: "asc" }],
    select: { characterId: true, orderIndex: true, subject: true, conditionKind: true, conditionParam: true, actionType: true, skillId: true },
  });

  const byChar = new Map<string, TacticSlotRow[]>();
  for (const id of filteredIds) byChar.set(id, []);
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

  const tactics = filteredIds.map((characterId) => ({
    characterId,
    slots: byChar.get(characterId) ?? [],
  }));
  return { tactics };
}

/** 指定した 3 キャラ分の作戦スロットを取得（TacticSlot）。063 採用後は作戦室では getTacticsForPreset を使用。 */
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

  // 編成更新後の 3 キャラだけを対象に PresetTacticSlot を一括置換する（spec/063）。
  await prisma.$transaction(async (tx) => {
    await updatePartyPreset(presetId, presetData);

    // 現在の編成 3 人（slot2/slot3 は更新後の値を優先）
    const slot1Id = preset.slot1CharacterId;
    const slot2Id = presetData.slot2CharacterId ?? preset.slot2CharacterId;
    const slot3Id = presetData.slot3CharacterId ?? preset.slot3CharacterId;
    const characterIds = [slot1Id, slot2Id, slot3Id].filter(Boolean) as string[];

    // tacticsByCharacter から、このプリセットに属するキャラ分だけを抽出し、orderIndex 1〜10 の範囲・重複を検証
    const byChar: { characterId: string; slots: TacticSlotRow[] }[] = [];
    for (const { characterId, slots } of tacticsByCharacter) {
      if (!characterIds.includes(characterId)) continue;
      const valid = slots.filter((s) => s.orderIndex >= 1 && s.orderIndex <= 10);
      const orderSet = new Set(valid.map((s) => s.orderIndex));
      if (orderSet.size !== valid.length) {
        throw new Error("VALIDATION");
      }
      byChar.push({ characterId, slots: valid });
    }

    // 既存の PresetTacticSlot をこのプリセット分まとめて削除し、再作成
    await tx.presetTacticSlot.deleteMany({ where: { partyPresetId: presetId } });
    const createData = byChar.flatMap(({ characterId, slots }) =>
      slots.map((s) => ({
        partyPresetId: presetId,
        characterId,
        orderIndex: s.orderIndex,
        subject: s.subject,
        conditionKind: s.conditionKind,
        conditionParam: (s.conditionParam ?? undefined) as Prisma.InputJsonValue | undefined,
        actionType: s.actionType,
        skillId: s.skillId || null,
      })),
    );
    if (createData.length > 0) {
      await tx.presetTacticSlot.createMany({ data: createData });
    }
  });

  return { success: true as const };
}

// --- 戦闘スキル一覧（行動プルダウン用） ---

export type BattleSkillOption = { id: string; name: string; battleSkillType: string | null };

export type TacticsSkillCatalogItem = {
  id: string;
  name: string;
  battleSkillType: string | null;
  chargeCycles: number;
  cooldownCycles: number;
  targetScope: string | null;
  attribute: string | null;
  description: string | null;
  displayTags: string[];
  learnedBy: {
    characterId: string;
    displayName: string;
    iconFilename: string | null;
  }[];
};

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

/** 指定キャラが習得している戦闘スキルのみ取得（作戦の行動プルダウン用）。メカは装備パーツのスキルを返す（spec/044）。 */
export async function getBattleSkillsForCharacters(characterIds: string[]) {
  const session = await getSession();
  if (!session.userId || characterIds.length === 0) return {} as Record<string, BattleSkillOption[]>;

  const allowed = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId: session.userId },
    select: { id: true, category: true },
  });
  const allowedSet = new Set(allowed.map((c) => c.id));
  const mechIds = new Set(allowed.filter((c) => c.category === "mech").map((c) => c.id));
  const nonMechIds = characterIds.filter((id) => allowedSet.has(id) && !mechIds.has(id));

  const byChar: Record<string, BattleSkillOption[]> = {};

  // 主人公・仲間: CharacterSkill（battle_active）
  if (nonMechIds.length > 0) {
    const learned = await prisma.characterSkill.findMany({
      where: {
        characterId: { in: nonMechIds },
        skill: { category: "battle_active" },
      },
      select: {
        characterId: true,
        skill: { select: { id: true, name: true, battleSkillType: true } },
      },
    });
    for (const id of nonMechIds) {
      byChar[id] = learned
        .filter((l) => l.characterId === id)
        .map((l) => ({
          id: l.skill.id,
          name: l.skill.name,
          battleSkillType: l.skill.battleSkillType,
        }))
        .sort((a, b) => (a.battleSkillType ?? "").localeCompare(b.battleSkillType ?? "") || a.name.localeCompare(b.name));
    }
  }

  // メカ: 装備パーツ経由のスキル（MechaEquipment → 個体 or 種別 → MechaPartTypeSkill → Skill）
  if (mechIds.size > 0) {
    const mechPartSkills = await prisma.mechaEquipment.findMany({
      where: { characterId: { in: [...mechIds] } },
      select: {
        characterId: true,
        mechaPartInstance: {
          select: {
            mechaPartType: {
              select: {
                mechaPartTypeSkills: {
                  select: { skill: { select: { id: true, name: true, battleSkillType: true } } },
                },
              },
            },
          },
        },
        mechaPartType: {
          select: {
            mechaPartTypeSkills: {
              select: { skill: { select: { id: true, name: true, battleSkillType: true } } },
            },
          },
        },
      },
    });
    for (const id of mechIds) {
      const skillSet = new Map<string, BattleSkillOption>();
      for (const eq of mechPartSkills) {
        if (eq.characterId !== id) continue;
        const partType = eq.mechaPartInstance?.mechaPartType ?? eq.mechaPartType;
        if (!partType) continue;
        for (const pts of partType.mechaPartTypeSkills) {
          const skill = pts.skill;
          if (skill && !skillSet.has(skill.id)) {
            skillSet.set(skill.id, {
              id: skill.id,
              name: skill.name,
              battleSkillType: skill.battleSkillType,
            });
          }
        }
      }
      byChar[id] = Array.from(skillSet.values()).sort(
        (a, b) => (a.battleSkillType ?? "").localeCompare(b.battleSkillType ?? "") || a.name.localeCompare(b.name)
      );
    }
  }

  return byChar;
}

/** 作戦室用: 編成3人が習得／装備している戦闘スキルを重複排除して一覧取得。メカは装備パーツのスキルを含む（spec/044）。 */
export async function getTacticsSkillCatalogForCharacters(characterIds: string[]) {
  const session = await getSession();
  if (!session.userId || characterIds.length === 0) {
    return { skills: [] as TacticsSkillCatalogItem[], error: "UNAUTHORIZED" as const };
  }

  // 所有キャラのみ対象（category も取得してメカ判定）
  const owned = await prisma.character.findMany({
    where: { id: { in: characterIds }, userId: session.userId },
    select: { id: true, displayName: true, iconFilename: true, category: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));
  const ids = characterIds.filter((id) => ownedIds.has(id));
  if (ids.length === 0) {
    return { skills: [] as TacticsSkillCatalogItem[] };
  }

  const ownedById = new Map(owned.map((c) => [c.id, c]));
  const mechIds = ids.filter((id) => ownedById.get(id)?.category === "mech");
  const nonMechIds = ids.filter((id) => ownedById.get(id)?.category !== "mech");

  const bySkillId = new Map<string, TacticsSkillCatalogItem>();

  const pushSkill = (skill: {
    id: string;
    name: string;
    battleSkillType: string | null;
    chargeCycles: number | null;
    cooldownCycles: number | null;
    targetScope: string | null;
    attribute: string | null;
    description: string | null;
    displayTags: unknown;
  }, characterId: string) => {
    const character = ownedById.get(characterId);
    const learnedByEntry = character
      ? { characterId: character.id, displayName: character.displayName, iconFilename: character.iconFilename }
      : null;
    const existing = bySkillId.get(skill.id);
    if (!existing) {
      const rawTags = (skill.displayTags ?? []) as unknown;
      const tags: string[] = Array.isArray(rawTags) ? rawTags.filter((t): t is string => typeof t === "string") : [];
      bySkillId.set(skill.id, {
        id: skill.id,
        name: skill.name,
        battleSkillType: skill.battleSkillType,
        chargeCycles: skill.chargeCycles ?? 0,
        cooldownCycles: skill.cooldownCycles ?? 0,
        targetScope: skill.targetScope ?? null,
        attribute: skill.attribute ?? null,
        description: skill.description ?? null,
        displayTags: tags,
        learnedBy: learnedByEntry ? [learnedByEntry] : [],
      });
    } else if (learnedByEntry && !existing.learnedBy.some((c) => c.characterId === learnedByEntry.characterId)) {
      existing.learnedBy.push(learnedByEntry);
    }
  };

  // 主人公・仲間: CharacterSkill（battle_active）
  if (nonMechIds.length > 0) {
    const learned = await prisma.characterSkill.findMany({
      where: {
        characterId: { in: nonMechIds },
        skill: { category: "battle_active" },
      },
      select: {
        characterId: true,
        skill: {
          select: {
            id: true,
            name: true,
            battleSkillType: true,
            chargeCycles: true,
            cooldownCycles: true,
            targetScope: true,
            attribute: true,
            description: true,
            displayTags: true,
          },
        },
      },
    });
    for (const row of learned) {
      if (row.skill) pushSkill(row.skill, row.characterId);
    }
  }

  // メカ: 装備パーツ経由のスキル（個体 or 種別 → MechaPartTypeSkill）
  if (mechIds.length > 0) {
    const mechEquips = await prisma.mechaEquipment.findMany({
      where: { characterId: { in: mechIds } },
      select: {
        characterId: true,
        mechaPartInstance: {
          select: {
            mechaPartType: {
              select: {
                mechaPartTypeSkills: {
                  select: {
                    skill: {
                      select: {
                        id: true,
                        name: true,
                        battleSkillType: true,
                        chargeCycles: true,
                        cooldownCycles: true,
                        targetScope: true,
                        attribute: true,
                        description: true,
                        displayTags: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        mechaPartType: {
          select: {
            mechaPartTypeSkills: {
              select: {
                skill: {
                  select: {
                    id: true,
                    name: true,
                    battleSkillType: true,
                    chargeCycles: true,
                    cooldownCycles: true,
                    targetScope: true,
                    attribute: true,
                    description: true,
                    displayTags: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    for (const eq of mechEquips) {
      const partType = eq.mechaPartInstance?.mechaPartType ?? eq.mechaPartType;
      if (!partType) continue;
      for (const pts of partType.mechaPartTypeSkills) {
        if (pts.skill) pushSkill(pts.skill, eq.characterId);
      }
    }
  }

  const skills = Array.from(bySkillId.values()).sort((a, b) => {
    const typeA = a.battleSkillType ?? "";
    const typeB = b.battleSkillType ?? "";
    if (typeA !== typeB) return typeA.localeCompare(typeB);
    return a.name.localeCompare(b.name);
  });

  return { skills };
}
