import { getIronSession, SessionOptions } from "iron-session";

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

export function getSession() {
  return getIronSession<SessionData>(sessionOptions);
}
