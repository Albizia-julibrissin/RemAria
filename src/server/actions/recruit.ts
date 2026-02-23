"use server";

// spec/030_companion_employment.md - 仲間雇用・解雇

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { characterRepository } from "@/server/repositories/character-repository";
import {
  COMPANION_HIRE_PRICE_GAME,
  COMPANION_HIRE_PRICE_PREMIUM,
  COMPANION_MAX_COUNT,
} from "@/lib/constants/companion";
import { DISPLAY_NAME_MAX_LEN } from "@/lib/constants/protagonist";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";

export type CompanionHireState = {
  companionHireCount: number;
  companionCount: number;
  companionMaxCount: number;
  gameCurrencyBalance: number;
  premiumFreeBalance: number;
  premiumPaidBalance: number;
  priceGame: number;
  pricePremium: number;
};

export type PurchaseCompanionHireResult =
  | { success: true; companionHireCount: number }
  | { success: false; error: "INSUFFICIENT_GAME" | "INSUFFICIENT_PREMIUM"; message: string; shortfall: number };

export type CreateCompanionResult =
  | { success: true; characterId: string }
  | { success: false; error: string; message: string };

export type DismissCompanionResult =
  | { success: true }
  | { success: false; error: string; message: string };

/** 雇用斡旋所表示用の状態を取得。spec/030 */
export async function getCompanionHireState(): Promise<CompanionHireState | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      companionHireCount: true,
      gameCurrencyBalance: true,
      premiumCurrencyFreeBalance: true,
      premiumCurrencyPaidBalance: true,
    },
  });
  if (!user) return null;
  const companionCount = await characterRepository.countCompanionsByUserId(session.userId);
  return {
    companionHireCount: user.companionHireCount,
    companionCount,
    companionMaxCount: COMPANION_MAX_COUNT,
    gameCurrencyBalance: user.gameCurrencyBalance,
    premiumFreeBalance: user.premiumCurrencyFreeBalance,
    premiumPaidBalance: user.premiumCurrencyPaidBalance,
    priceGame: COMPANION_HIRE_PRICE_GAME,
    pricePremium: COMPANION_HIRE_PRICE_PREMIUM,
  };
}

/** 雇用可能回数を 1 購入（ゲーム通貨 or 課金通貨）。課金は無償→有償の順で消費。spec/030 */
export async function purchaseCompanionHire(
  paymentType: "game" | "premium"
): Promise<PurchaseCompanionHireResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "INSUFFICIENT_GAME", message: "ログインしてください", shortfall: COMPANION_HIRE_PRICE_GAME };
  }
  if (paymentType === "game") {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { gameCurrencyBalance: true, companionHireCount: true },
    });
    if (!user || user.gameCurrencyBalance < COMPANION_HIRE_PRICE_GAME) {
      const shortfall = user ? Math.max(0, COMPANION_HIRE_PRICE_GAME - user.gameCurrencyBalance) : COMPANION_HIRE_PRICE_GAME;
      return { success: false, error: "INSUFFICIENT_GAME", message: `ゲーム通貨が足りません（あと ${shortfall} 必要）`, shortfall };
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.userId },
        data: {
          gameCurrencyBalance: { decrement: COMPANION_HIRE_PRICE_GAME },
          companionHireCount: { increment: 1 },
        },
      });
      await tx.currencyTransaction.create({
        data: {
          userId: session.userId!,
          currencyType: "game",
          amount: -COMPANION_HIRE_PRICE_GAME,
          reason: "companion_hire_purchase",
          referenceType: "user",
          referenceId: session.userId,
        },
      });
    });
    const updated = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { companionHireCount: true },
    });
    return { success: true, companionHireCount: updated?.companionHireCount ?? 1 };
  }
  // premium: 無償→有償の順で消費
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      premiumCurrencyFreeBalance: true,
      premiumCurrencyPaidBalance: true,
      companionHireCount: true,
    },
  });
  const totalPremium = user
    ? user.premiumCurrencyFreeBalance + user.premiumCurrencyPaidBalance
    : 0;
  if (!user || totalPremium < COMPANION_HIRE_PRICE_PREMIUM) {
    const shortfall = Math.max(0, COMPANION_HIRE_PRICE_PREMIUM - totalPremium);
    return { success: false, error: "INSUFFICIENT_PREMIUM", message: `課金通貨が足りません（あと ${shortfall} 必要）`, shortfall };
  }
  const fromFree = Math.min(COMPANION_HIRE_PRICE_PREMIUM, user.premiumCurrencyFreeBalance);
  const fromPaid = COMPANION_HIRE_PRICE_PREMIUM - fromFree;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.userId },
      data: {
        premiumCurrencyFreeBalance: { decrement: fromFree },
        premiumCurrencyPaidBalance: { decrement: fromPaid },
        companionHireCount: { increment: 1 },
      },
    });
    if (fromFree > 0) {
      await tx.currencyTransaction.create({
        data: {
          userId: session.userId!,
          currencyType: "premium_free",
          amount: -fromFree,
          reason: "companion_hire_purchase",
          referenceType: "user",
          referenceId: session.userId,
        },
      });
    }
    if (fromPaid > 0) {
      await tx.currencyTransaction.create({
        data: {
          userId: session.userId!,
          currencyType: "premium_paid",
          amount: -fromPaid,
          reason: "companion_hire_purchase",
          referenceType: "user",
          referenceId: session.userId,
        },
      });
    }
  });
  const updated = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { companionHireCount: true },
  });
  return { success: true, companionHireCount: updated?.companionHireCount ?? 1 };
}

/** 仲間を 1 体作成（雇用可能回数 -1、工業スキルランダム1つ）。成功時はキャラ詳細へリダイレクト。spec/030 */
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
  if (trimmedName.length > DISPLAY_NAME_MAX_LEN) {
    return { success: false, error: "VALIDATION_ERROR", message: `表示名は${DISPLAY_NAME_MAX_LEN}文字以内で入力してください` };
  }
  const allowedIcons = getProtagonistIconFilenames();
  if (typeof iconFilename !== "string" || !iconFilename.trim() || !allowedIcons.includes(iconFilename.trim())) {
    return { success: false, error: "VALIDATION_ERROR", message: "アイコンを選択してください" };
  }
  const result = await characterRepository.createCompanion({
    userId: session.userId,
    displayName: trimmedName,
    iconFilename: iconFilename.trim(),
  });
  if (!result.success) {
    if (result.error === "NO_HIRE_COUNT") return { success: false, error: "NO_HIRE_COUNT", message: "雇用可能回数がありません" };
    if (result.error === "COMPANION_LIMIT") return { success: false, error: "COMPANION_LIMIT", message: `仲間は最大${COMPANION_MAX_COUNT}体までです` };
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
