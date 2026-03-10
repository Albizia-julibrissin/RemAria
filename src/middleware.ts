// spec/010_auth - 保護画面でのリダイレクト
// 未ログイン時に /dashboard へアクセスした場合 /login へリダイレクト
// メンテナンス時（MAINTENANCE=1）は保護パスを /maintenance へリダイレクト（探索・DB 変更時のユーザー操作防止）

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

const PROTECTED_PATHS = ["/dashboard", "/character", "/battle"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

function isMaintenanceMode(): boolean {
  const v = process.env.MAINTENANCE;
  return v === "1" || v === "true";
}

export async function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (isMaintenanceMode()) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.userId || !session.isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/character/:path*", "/battle/:path*"],
};
