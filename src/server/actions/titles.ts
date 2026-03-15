"use server";

// spec/055 - 称号マスタ・ユーザ解放

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export type TitleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isUnlocked: boolean;
};

export type GetTitleListResult =
  | { success: true; titles: TitleRow[]; equippedTitleId: string | null }
  | { success: false; error: string };

/**
 * 称号一覧を取得。ログイン中なら自分の解放済み・装備中をマージして返す。
 */
export async function getTitleList(): Promise<GetTitleListResult> {
  const session = await getSession();
  const titles = await prisma.title.findMany({
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true, description: true, displayOrder: true },
  });

  if (!session?.userId) {
    return {
      success: true,
      titles: titles.map((t) => ({
        ...t,
        isUnlocked: false,
      })),
      equippedTitleId: null,
    };
  }

  const [unlocks, user] = await Promise.all([
    prisma.userTitleUnlock.findMany({
      where: { userId: session.userId },
      select: { titleId: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { selectedTitleId: true },
    }),
  ]);
  const unlockedSet = new Set(unlocks.map((u) => u.titleId));

  return {
    success: true,
    titles: titles.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      displayOrder: t.displayOrder,
      isUnlocked: unlockedSet.has(t.id),
    })),
    equippedTitleId: user?.selectedTitleId ?? null,
  };
}

/**
 * 装備中の称号を変更する（開拓者証で本人のみ実行可能）。解放済みの称号のみ装備可能。null で装備解除。
 */
export async function setEquippedTitle(
  titleId: string | null
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.userId) return { success: false, error: "ログインしてください。" };

  if (titleId !== null) {
    const unlocked = await prisma.userTitleUnlock.findUnique({
      where: { userId_titleId: { userId: session.userId, titleId } },
      select: { titleId: true },
    });
    if (!unlocked) return { success: false, error: "その称号はまだ解放されていません。" };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { selectedTitleId: titleId },
  });
  return { success: true };
}

/**
 * ログイン中のユーザが解放済みの titleId 一覧。他モジュールから参照用。
 */
export async function getMyUnlockedTitleIds(): Promise<string[]> {
  const session = await getSession();
  if (!session?.userId) return [];
  const rows = await prisma.userTitleUnlock.findMany({
    where: { userId: session.userId },
    select: { titleId: true },
  });
  return rows.map((r) => r.titleId);
}

/**
 * 内部用。指定ユーザに称号を解放付与する（クエスト報酬等から呼ぶ）。
 * 既に解放済みの場合は何もしない。
 */
export async function unlockTitleForUser(
  userId: string,
  titleId: string
): Promise<{ success: boolean; error?: string }> {
  const title = await prisma.title.findUnique({
    where: { id: titleId },
    select: { id: true },
  });
  if (!title) return { success: false, error: "称号が見つかりません。" };

  await prisma.userTitleUnlock.upsert({
    where: {
      userId_titleId: { userId, titleId },
    },
    create: { userId, titleId },
    update: {},
  });
  return { success: true };
}
