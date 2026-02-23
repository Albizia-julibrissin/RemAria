"use server";

// spec/015_protagonist_creation.md - 主人公作成・取得

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { characterRepository } from "@/server/repositories/character-repository";
import { DISPLAY_NAME_MAX_LEN } from "@/lib/constants/protagonist";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";

export type CreateProtagonistResult =
  | { success: true; characterId: string }
  | { success: false; error: string; message: string };

function validateDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return "表示名を入力してください";
  const trimmed = value.trim();
  if (!trimmed) return "表示名を入力してください";
  if (trimmed.length > DISPLAY_NAME_MAX_LEN) return `表示名は${DISPLAY_NAME_MAX_LEN}文字以内で入力してください`;
  return null;
}

function validateIconFilename(value: unknown, allowed: string[]): string | null {
  if (typeof value !== "string" || !value.trim()) return "アイコンを選択してください";
  if (!allowed.includes(value.trim())) return "選択できるアイコンから選んでください";
  return null;
}

/** 主人公を1体作成（既にいる場合は ALREADY_CREATED） */
export async function createProtagonist(formData: FormData): Promise<CreateProtagonistResult> {
  const session = await getSession();
  if (!session.userId || !session.isLoggedIn) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  const existing = await characterRepository.getProtagonistByUserId(session.userId);
  if (existing) {
    return { success: false, error: "ALREADY_CREATED", message: "既に主人公が作成されています" };
  }

  const displayName = formData.get("displayName");
  const iconFilename = formData.get("iconFilename");

  const displayNameErr = validateDisplayName(displayName);
  if (displayNameErr) return { success: false, error: "VALIDATION_ERROR", message: displayNameErr };

  const allowedIcons = getProtagonistIconFilenames();
  const iconErr = validateIconFilename(iconFilename, allowedIcons);
  if (iconErr) return { success: false, error: "VALIDATION_ERROR", message: iconErr };

  const character = await characterRepository.createProtagonist({
    userId: session.userId,
    displayName: String(displayName).trim(),
    iconFilename: String(iconFilename).trim(),
  });

  return { success: true, characterId: character.id };
}

/** 作成成功後にダッシュボードへリダイレクトする用 */
export async function createProtagonistAndRedirect(formData: FormData) {
  const result = await createProtagonist(formData);
  if (result.success) redirect("/dashboard");
  return result;
}

/** ログインユーザーの主人公を取得（いなければ null） */
export async function getProtagonist() {
  const session = await getSession();
  if (!session.userId) return null;
  return characterRepository.getProtagonistByUserId(session.userId);
}
