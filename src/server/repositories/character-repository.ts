// docs/08, 12: Character テーブル統一 - 主人公の取得・作成 / spec/030: 仲間雇用・解雇

import { prisma } from "@/lib/db/prisma";
import { INITIAL_PROTAGONIST_STATS } from "@/lib/constants/protagonist";
import { COMPANION_MAX_COUNT } from "@/lib/constants/companion";

/** ユーザーの主人公（Character category=protagonist）を取得。いなければ null。表示名は User.name（docs/08） */
export async function getProtagonistByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      protagonistCharacter: true,
    },
  });
  if (!user?.protagonistCharacter) return null;
  return {
    id: user.protagonistCharacter.id,
    displayName: user.name, // 主人公の表示名は User.name のみ（二重管理しない）
    iconFilename: user.protagonistCharacter.iconFilename,
    STR: user.protagonistCharacter.STR,
    INT: user.protagonistCharacter.INT,
    VIT: user.protagonistCharacter.VIT,
    WIS: user.protagonistCharacter.WIS,
    DEX: user.protagonistCharacter.DEX,
    AGI: user.protagonistCharacter.AGI,
    LUK: user.protagonistCharacter.LUK,
    CAP: user.protagonistCharacter.CAP,
    createdAt: user.protagonistCharacter.createdAt,
  };
}

/** ユーザーが所有する全キャラ（主人公・仲間・メカ）を一覧取得。spec/025 */
export async function getCharactersByUserId(userId: string) {
  return prisma.character.findMany({
    where: { userId },
    select: { id: true, category: true, displayName: true, iconFilename: true },
    orderBy: { createdAt: "asc" },
  });
}

/** 指定 id のキャラを取得。userId が一致する場合のみ返す（他ユーザーは null）。spec/025 */
export async function getCharacterByIdForUser(characterId: string, userId: string) {
  const c = await prisma.character.findFirst({
    where: { id: characterId, userId },
    select: {
      id: true,
      category: true,
      displayName: true,
      iconFilename: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
      CAP: true,
    },
  });
  return c;
}

/** 主人公を1体作成（Character category=protagonist を作成し User.protagonistCharacterId を設定）。表示名は User.name を使用（spec/015） */
export async function createProtagonist(data: { userId: string; iconFilename: string }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: data.userId },
      select: { name: true },
    });
    if (!user) throw new Error("User not found");

    // 主人公本体
    const protagonist = await tx.character.create({
      data: {
        userId: data.userId,
        category: "protagonist",
        displayName: user.name, // 主人公は User.name をコピー（表示時は常に User を参照）
        iconFilename: data.iconFilename,
        ...INITIAL_PROTAGONIST_STATS,
      },
      select: { id: true },
    });

    // ベースメカ（装備なし・基礎ステのみ）
    await tx.character.create({
      data: {
        userId: data.userId,
        category: "mech",
        displayName: "メカ",
        iconFilename: null,
        ...INITIAL_PROTAGONIST_STATS,
      },
      select: { id: true },
    });

    await tx.user.update({
      where: { id: data.userId },
      data: { protagonistCharacterId: protagonist.id },
    });
    return protagonist;
  });
}

/** 仲間（category=companion）の所持数を返す。spec/030 */
export async function countCompanionsByUserId(userId: string): Promise<number> {
  return prisma.character.count({
    where: { userId, category: "companion" },
  });
}

/** 工業スキル（category=industrial）を1つランダムで取得。spec/030 */
async function getRandomIndustrialSkillId(tx: { skill: { findMany: (args: { where: { category: string }; select: { id: true } }) => Promise<{ id: string }[]> } }) {
  const skills = await tx.skill.findMany({
    where: { category: "industrial" },
    select: { id: true },
  });
  if (skills.length === 0) return null;
  return skills[Math.floor(Math.random() * skills.length)]!.id;
}

/** 仲間を1体作成（雇用可能回数 -1、工業スキルをランダム1つ付与）。spec/030 */
export async function createCompanion(data: {
  userId: string;
  displayName: string;
  iconFilename: string;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: data.userId },
      select: { companionHireCount: true },
    });
    if (!user || user.companionHireCount < 1) return { success: false as const, error: "NO_HIRE_COUNT" as const };
    const companionCount = await tx.character.count({ where: { userId: data.userId, category: "companion" } });
    if (companionCount >= COMPANION_MAX_COUNT) return { success: false as const, error: "COMPANION_LIMIT" as const };

    const skillId = await getRandomIndustrialSkillId(tx);
    const character = await tx.character.create({
      data: {
        userId: data.userId,
        category: "companion",
        displayName: data.displayName.trim(),
        iconFilename: data.iconFilename,
        ...INITIAL_PROTAGONIST_STATS,
      },
      select: { id: true },
    });
    if (skillId) {
      await tx.characterSkill.create({
        data: { characterId: character.id, skillId },
      });
    }
    await tx.user.update({
      where: { id: data.userId },
      data: { companionHireCount: { decrement: 1 } },
    });
    return { success: true as const, characterId: character.id };
  });
}

/** 仲間を解雇（表示名一致時のみ削除）。spec/030。戻りは success と redirect 用。 */
export async function dismissCompanion(characterId: string, userId: string, confirmDisplayName: string) {
  const c = await prisma.character.findFirst({
    where: { id: characterId, userId, category: "companion" },
    select: { id: true, displayName: true },
  });
  if (!c) return { success: false as const, error: "NOT_FOUND" as const };
  if (c.displayName.trim() !== confirmDisplayName.trim()) return { success: false as const, error: "CONFIRM_NAME_MISMATCH" as const };
  await prisma.character.delete({ where: { id: characterId } });
  return { success: true as const };
}

/** 指定キャラの詳細＋習得スキル（工業スキル表示用）。userId 一致時のみ。spec/030 */
export async function getCharacterWithSkillsForUser(characterId: string, userId: string) {
  const c = await prisma.character.findFirst({
    where: { id: characterId, userId },
    select: {
      id: true,
      category: true,
      displayName: true,
      iconFilename: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
      CAP: true,
      characterSkills: {
        select: { skill: { select: { id: true, name: true, description: true, effectType: true, effectValue: true } } },
      },
    },
  });
  return c;
}

export const characterRepository = {
  getProtagonistByUserId,
  getCharactersByUserId,
  getCharacterByIdForUser,
  getCharacterWithSkillsForUser,
  createProtagonist,
  countCompanionsByUserId,
  createCompanion,
  dismissCompanion,
};
