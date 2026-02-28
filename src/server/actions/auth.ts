"use server";

// spec/010_auth.md 準拠
// 認証 Server Actions: register, login, logout

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { userRepository } from "@/server/repositories/user-repository";
import { getSession } from "@/lib/auth/session";
import { ensureInitialFacilities } from "@/server/actions/initial-area";

// --- バリデーション（spec 5.4） ---
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LEN = 255;
const PASSWORD_MIN_LEN = 8;
const PASSWORD_MAX_LEN = 72;
const NAME_MAX_LEN = 50;

export type AuthResult =
  | { success: true; userId: string }
  | { success: false; error: string; message: string };

function validateEmail(email: unknown): string | null {
  if (typeof email !== "string" || !email.trim()) return "メールアドレスを入力してください";
  if (!EMAIL_REGEX.test(email)) return "メールアドレスの形式が正しくありません";
  if (email.length > EMAIL_MAX_LEN) return "メールアドレスが長すぎます";
  return null;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "パスワードを入力してください";
  if (password.length < PASSWORD_MIN_LEN) return "パスワードは8文字以上で入力してください";
  if (password.length > PASSWORD_MAX_LEN) return "パスワードが長すぎます";
  return null;
}

function validateName(name: unknown): string | null {
  if (name === undefined || name === null) return null;
  if (typeof name !== "string") return "表示名の形式が正しくありません";
  if (name.length > NAME_MAX_LEN) return "表示名は50文字以内で入力してください";
  return null;
}

/** spec: register - 新規登録（成功時は自動ログイン） */
export async function register(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email");
  const password = formData.get("password");
  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" && nameRaw.trim() === "" ? null : nameRaw ?? null;

  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: "VALIDATION_ERROR", message: emailErr };

  const passwordErr = validatePassword(password);
  if (passwordErr) return { success: false, error: "VALIDATION_ERROR", message: passwordErr };

  const nameErr = validateName(name === null ? undefined : nameRaw);
  if (nameErr) return { success: false, error: "VALIDATION_ERROR", message: nameErr };

  const existing = await userRepository.findByEmail(String(email).trim());
  if (existing) {
    return { success: false, error: "EMAIL_ALREADY_EXISTS", message: "このメールアドレスは既に登録されています" };
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const displayName = typeof name === "string" ? name.trim() || null : null;

  const user = await userRepository.create({
    email: String(email).trim().toLowerCase(),
    passwordHash,
    name: displayName,
  });

  // spec/035: 新規アカウントにも初期エリアの強制配置 5 設備を用意する（冪等）
  try {
    await ensureInitialFacilities(user.id);
  } catch {
    // 工業設備の初期作成に失敗しても登録は成功させる
  }

  const session = await getSession();
  session.userId = user.id;
  session.isLoggedIn = true;
  await session.save();

  redirect("/dashboard");
}

/** spec: login - ログイン */
export async function login(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: "VALIDATION_ERROR", message: emailErr };

  const passwordErr = validatePassword(password);
  if (passwordErr) return { success: false, error: "VALIDATION_ERROR", message: passwordErr };

  const user = await userRepository.findByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return { success: false, error: "INVALID_CREDENTIALS", message: "メールアドレスまたはパスワードが正しくありません" };
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    return { success: false, error: "INVALID_CREDENTIALS", message: "メールアドレスまたはパスワードが正しくありません" };
  }

  const session = await getSession();
  session.userId = user.id;
  session.isLoggedIn = true;
  await session.save();

  redirect("/dashboard");
}

/** spec: logout - ログアウト */
export async function logout(): Promise<{ success: true }> {
  const session = await getSession();
  session.destroy();
  return { success: true };
}

/** ログアウト後に /login へリダイレクト（画面実装時に使用） */
export async function logoutAndRedirect() {
  await logout();
  redirect("/login");
}
