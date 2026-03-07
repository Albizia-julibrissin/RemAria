"use server";

import { getSession } from "@/lib/auth/session";
import { TEST_USER_1_EMAIL } from "@/lib/constants/admin";
import { prisma } from "@/lib/db/prisma";

/**
 * 現在のセッションがテストユーザー1（test1@example.com）かどうかを返す。
 * 実装済み一覧など、管理者向けコンテンツの表示可否に利用する。
 */
export async function isTestUser1(): Promise<boolean> {
  const session = await getSession();
  if (!session?.userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });
  return user?.email === TEST_USER_1_EMAIL;
}
