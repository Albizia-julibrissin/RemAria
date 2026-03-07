"use server";

// キャラ詳細でのアイコン変更

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";

export type UpdateCharacterIconResult =
  | { success: true }
  | { success: false; error: string; message: string };

/**
 * 指定キャラのアイコンを変更する。本人のキャラであること・iconFilename が許可リストに含まれることを検証する。
 */
export async function updateCharacterIcon(
  characterId: string,
  iconFilename: string
): Promise<UpdateCharacterIconResult> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const allowed = getProtagonistIconFilenames();
  const trimmed = iconFilename.trim();
  if (!trimmed || !allowed.includes(trimmed)) {
    return { success: false, error: "INVALID_ICON", message: "選択できないアイコンです。" };
  }

  const character = await prisma.character.findFirst({
    where: { id: characterId, userId: session.userId },
    select: { id: true },
  });
  if (!character) {
    return { success: false, error: "NOT_FOUND", message: "キャラが見つかりません。" };
  }

  await prisma.character.update({
    where: { id: characterId },
    data: { iconFilename: trimmed },
  });

  revalidatePath("/dashboard/characters");
  revalidatePath(`/dashboard/characters/${characterId}`);
  return { success: true };
}
