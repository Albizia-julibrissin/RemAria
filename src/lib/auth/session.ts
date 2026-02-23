import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  isLoggedIn: boolean;
}

const defaultPassword = "at-least-32-characters-long-secret-key-here";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? defaultPassword,
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
