// docs/08, 12: Character テーブル統一 - 主人公の取得・作成

import { prisma } from "@/lib/db/prisma";
import { INITIAL_PROTAGONIST_STATS } from "@/lib/constants/protagonist";

/** ユーザーの主人公（Character category=protagonist）を取得。いなければ null */
export async function getProtagonistByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { protagonistCharacter: true },
  });
  if (!user?.protagonistCharacter) return null;
  return {
    id: user.protagonistCharacter.id,
    displayName: user.protagonistCharacter.displayName,
    iconFilename: user.protagonistCharacter.iconFilename,
    STR: user.protagonistCharacter.STR,
    INT: user.protagonistCharacter.INT,
    DEX: user.protagonistCharacter.DEX,
    VIT: user.protagonistCharacter.VIT,
    SPD: user.protagonistCharacter.SPD,
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
      DEX: true,
      VIT: true,
      SPD: true,
      LUK: true,
      CAP: true,
    },
  });
  return c;
}

/** 主人公を1体作成（Character category=protagonist を作成し User.protagonistCharacterId を設定） */
export async function createProtagonist(data: {
  userId: string;
  displayName: string;
  iconFilename: string;
}) {
  return prisma.$transaction(async (tx) => {
    const character = await tx.character.create({
      data: {
        userId: data.userId,
        category: "protagonist",
        displayName: data.displayName.trim(),
        iconFilename: data.iconFilename,
        ...INITIAL_PROTAGONIST_STATS,
      },
      select: { id: true },
    });
    await tx.user.update({
      where: { id: data.userId },
      data: { protagonistCharacterId: character.id },
    });
    return character;
  });
}

export const characterRepository = {
  getProtagonistByUserId,
  getCharactersByUserId,
  getCharacterByIdForUser,
  createProtagonist,
};
