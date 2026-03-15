"use server";

// spec/030_companion_employment.md - 仲間雇用・解雇（推薦紹介状で仲間追加、人材局廃止）

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { characterRepository } from "@/server/repositories/character-repository";
import { COMPANION_MAX_COUNT, LETTER_OF_RECOMMENDATION_ITEM_CODE } from "@/lib/constants/companion";
import { DISPLAY_NAME_MAX_BYTES, DISPLAY_NAME_MAX_CHARS } from "@/lib/constants/protagonist";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";

export type CompanionRecruitState = {
  companionCount: number;
  companionMaxCount: number;
  letterOfRecommendationCount: number;
};

export type CreateCompanionResult =
  | { success: true; characterId: string }
  | { success: false; error: string; message: string };

export type DismissCompanionResult =
  | { success: true }
  | { success: false; error: string; message: string };

/** spec/030 旧「雇用可能回数の購入」。人材局廃止のため未実装。RecruitPurchaseButtons 用スタブ。 */
export type PurchaseCompanionHireResult =
  | { success: true; companionHireCount?: number }
  | { success: false; error: string; message: string };

/** 雇用可能回数の購入（GRA）。人材局廃止のため未実装。推薦紹介状で仲間追加。docs/027 参照。 */
export async function purchaseCompanionHire(): Promise<PurchaseCompanionHireResult> {
  return { success: false, error: "NOT_IMPLEMENTED", message: "現在は推薦紹介状で仲間を追加してください。" };
}

function approxUtf8ByteLength(str: string): number {
  return Array.from(str).reduce((sum, ch) => {
    const code = ch.charCodeAt(0);
    return sum + (code <= 0x7f ? 1 : 2);
  }, 0);
}

/** 居住区用：仲間数・上限・推薦紹介状の所持数。spec/030, docs/081, docs/082（上限はユーザー別） */
export async function getCompanionRecruitState(): Promise<CompanionRecruitState | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const [companionCount, user, item] = await Promise.all([
    characterRepository.countCompanionsByUserId(session.userId),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { companionLimit: true },
    }),
    prisma.item.findUnique({
      where: { code: LETTER_OF_RECOMMENDATION_ITEM_CODE },
      select: { id: true },
    }),
  ]);
  let letterOfRecommendationCount = 0;
  if (item) {
    const inv = await prisma.userInventory.findUnique({
      where: { userId_itemId: { userId: session.userId, itemId: item.id } },
      select: { quantity: true },
    });
    letterOfRecommendationCount = inv?.quantity ?? 0;
  }
  return {
    companionCount,
    companionMaxCount: user?.companionLimit ?? COMPANION_MAX_COUNT,
    letterOfRecommendationCount,
  };
}

/** 推薦紹介状を1消費して仲間を1体作成。成功時はキャラ詳細へリダイレクト。spec/030, docs/081 */
export async function createCompanion(formData: FormData): Promise<CreateCompanionResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }
  const displayName = formData.get("displayName");
  const iconFilename = formData.get("iconFilename");
  if (typeof displayName !== "string" || !displayName.trim()) {
    return { success: false, error: "VALIDATION_ERROR", message: "表示名を入力してください" };
  }
  const trimmedName = displayName.trim();
  const byteLen = approxUtf8ByteLength(trimmedName);
  if (trimmedName.length > DISPLAY_NAME_MAX_CHARS || byteLen > DISPLAY_NAME_MAX_BYTES) {
    return {
      success: false,
      error: "VALIDATION_ERROR",
      message: `表示名はおおよそ全角${DISPLAY_NAME_MAX_CHARS}文字・半角${DISPLAY_NAME_MAX_BYTES}文字（UTF-8 約 ${DISPLAY_NAME_MAX_BYTES} バイト）以内で入力してください`,
    };
  }
  const allowedIcons = getProtagonistIconFilenames();
  if (typeof iconFilename !== "string" || !iconFilename.trim() || !allowedIcons.includes(iconFilename.trim())) {
    return { success: false, error: "VALIDATION_ERROR", message: "アイコンを選択してください" };
  }
  const result = await characterRepository.createCompanionWithLetter({
    userId: session.userId,
    displayName: trimmedName,
    iconFilename: iconFilename.trim(),
  });
  if (!result.success) {
    if (result.error === "NO_LETTER" || result.error === "NO_ITEM")
      return { success: false, error: "NO_LETTER", message: "推薦紹介状がありません" };
    if (result.error === "COMPANION_LIMIT") {
      const u = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { companionLimit: true },
      });
      const max = u?.companionLimit ?? COMPANION_MAX_COUNT;
      return { success: false, error: "COMPANION_LIMIT", message: `仲間は最大${max}体までです` };
    }
    return { success: false, error: "VALIDATION_ERROR", message: "作成できませんでした" };
  }
  redirect(`/dashboard/characters/${result.characterId}`);
}

/** 仲間を解雇（表示名一致で確認）。成功時はキャラ一覧へリダイレクト。spec/030 */
export async function dismissCompanionAction(
  characterId: string,
  confirmDisplayName: string
): Promise<DismissCompanionResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }
  const result = await characterRepository.dismissCompanion(
    characterId,
    session.userId,
    confirmDisplayName
  );
  if (!result.success) {
    if (result.error === "NOT_FOUND") return { success: false, error: "NOT_FOUND", message: "対象の仲間が見つかりません" };
    if (result.error === "CONFIRM_NAME_MISMATCH") return { success: false, error: "CONFIRM_NAME_MISMATCH", message: "表示名が一致しません。削除できませんでした。" };
    return { success: false, error: "UNKNOWN", message: "解雇できませんでした" };
  }
  redirect("/dashboard/characters");
}
