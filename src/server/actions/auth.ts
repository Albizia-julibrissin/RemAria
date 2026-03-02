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
const ACCOUNT_ID_REGEX = /^[a-zA-Z0-9_]+$/;
const ACCOUNT_ID_MIN_LEN = 3;
const ACCOUNT_ID_MAX_LEN = 32;
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

function validateAccountId(accountId: unknown): string | null {
  if (typeof accountId !== "string" || !accountId.trim()) return "IDを入力してください";
  const trimmed = accountId.trim();
  if (trimmed.length < ACCOUNT_ID_MIN_LEN) return `IDは${ACCOUNT_ID_MIN_LEN}文字以上で入力してください`;
  if (trimmed.length > ACCOUNT_ID_MAX_LEN) return `IDは${ACCOUNT_ID_MAX_LEN}文字以内で入力してください`;
  if (!ACCOUNT_ID_REGEX.test(trimmed)) return "IDは英数字とアンダースコアのみ使用できます";
  return null;
}

function validateName(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) return "名前を入力してください";
  if (name.trim().length > NAME_MAX_LEN) return "名前は50文字以内で入力してください";
  return null;
}

/** spec: register - 新規登録（成功時は自動ログイン） */
export async function register(formData: FormData): Promise<AuthResult> {
  const email = formData.get("email");
  const accountIdRaw = formData.get("accountId");
  const password = formData.get("password");
  const nameRaw = formData.get("name");

  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: "VALIDATION_ERROR", message: emailErr };

  const accountIdErr = validateAccountId(accountIdRaw);
  if (accountIdErr) return { success: false, error: "VALIDATION_ERROR", message: accountIdErr };

  const passwordErr = validatePassword(password);
  if (passwordErr) return { success: false, error: "VALIDATION_ERROR", message: passwordErr };

  const nameErr = validateName(nameRaw);
  if (nameErr) return { success: false, error: "VALIDATION_ERROR", message: nameErr };

  const existingEmail = await userRepository.findByEmail(String(email).trim().toLowerCase());
  if (existingEmail) {
    return { success: false, error: "EMAIL_ALREADY_EXISTS", message: "このメールアドレスは既に登録されています" };
  }

  const accountId = String(accountIdRaw).trim();
  const existingAccountId = await userRepository.findByAccountId(accountId);
  if (existingAccountId) {
    return { success: false, error: "ACCOUNT_ID_ALREADY_EXISTS", message: "このIDは既に使用されています" };
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const name = String(nameRaw).trim();

  const user = await userRepository.create({
    email: String(email).trim().toLowerCase(),
    accountId,
    passwordHash,
    name,
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
