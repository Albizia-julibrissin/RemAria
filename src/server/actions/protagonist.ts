"use server";

// spec/015_protagonist_creation.md - 主人公作成・取得（表示名は User.name を使用）

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { characterRepository } from "@/server/repositories/character-repository";
import { userRepository } from "@/server/repositories/user-repository";
import { getProtagonistIconFilenames } from "@/server/lib/protagonist-icons";
import { createPartyPreset } from "@/server/actions/tactics";

export type CreateProtagonistResult =
  | { success: true; characterId: string }
  | { success: false; error: string; message: string };

function validateIconFilename(value: unknown, allowed: string[]): string | null {
  if (typeof value !== "string" || !value.trim()) return "アイコンを選択してください";
  if (!allowed.includes(value.trim())) return "選択できるアイコンから選んでください";
  return null;
}

/** 主人公を1体作成（既にいる場合は ALREADY_CREATED）。表示名は登録時の User.name を使用 */
export async function createProtagonist(formData: FormData): Promise<CreateProtagonistResult> {
  const session = await getSession();
  if (!session.userId || !session.isLoggedIn) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  const user = await userRepository.findById(session.userId);
  if (!user) {
    return { success: false, error: "UNAUTHORIZED", message: "ユーザーが見つかりません。再ログインしてください。" };
  }

  const existing = await characterRepository.getProtagonistByUserId(session.userId);
  if (existing) {
    return { success: false, error: "ALREADY_CREATED", message: "既に主人公が作成されています" };
  }

  const iconFilename = formData.get("iconFilename");
  const allowedIcons = getProtagonistIconFilenames();
  const iconErr = validateIconFilename(iconFilename, allowedIcons);
  if (iconErr) return { success: false, error: "VALIDATION_ERROR", message: iconErr };

  const character = await characterRepository.createProtagonist({
    userId: session.userId,
    iconFilename: String(iconFilename).trim(),
  });

  // 初回用のパーティプリセットを1件作成（作戦室で「プリセットがない」状態にしない）
  try {
    await createPartyPreset();
  } catch {
    // プリセット作成に失敗しても主人公作成は成功とする
  }

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
