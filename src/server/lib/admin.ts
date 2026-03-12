"use server";

import { getSession } from "@/lib/auth/session";
import { DEFAULT_ADMIN_EMAIL } from "@/lib/constants/admin";
import { prisma } from "@/lib/db/prisma";

/**
 * 管理画面に入室可能なアカウントのメールアドレス。
 * 本番では環境変数 ADMIN_EMAIL を設定すること。
 */
export async function getAdminEmail(): Promise<string> {
  return process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
}

/**
 * 現在のセッションが管理用アカウント（ADMIN_EMAIL で指定されたユーザー）かどうかを返す。
 * 管理画面の表示・API の実行可否に利用する。
 */
export async function isAdminUser(): Promise<boolean> {
  const session = await getSession();
  if (!session?.userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  return user?.email === (await getAdminEmail());
}

/**
 * @deprecated isAdminUser を使用してください。互換のため残す。
 */
export async function isTestUser1(): Promise<boolean> {
  return isAdminUser();
}
