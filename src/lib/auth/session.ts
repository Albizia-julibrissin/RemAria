import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  isLoggedIn: boolean;
}

// プロダクションでは必ず SESSION_SECRET を使う（32文字以上必須）。
// 開発環境のみ、未設定なら弱いデフォルトを使う。
const rawPassword = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === "production") {
  if (!rawPassword || rawPassword.length < 32) {
    throw new Error("SESSION_SECRET is required in production and must be at least 32 characters long.");
  }
}

const sessionPassword = rawPassword ?? "dev-only-weak-secret-for-local";

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: "remaria-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7日
    sameSite: "lax",
    httpOnly: true,
  },
};

/** spec/010_auth: セッション取得・検証（Server Components / Server Actions 用） */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
