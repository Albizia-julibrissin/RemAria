// spec/010_auth §11.6 - アクティブユーザー数・lastActiveAt

import { prisma } from "@/lib/db/prisma";

const THROTTLE_MINUTES = 1;
const ACTIVE_WINDOW_MINUTES = 5;

/**
 * 認証済みユーザーの最終アクティブ日時を更新する。
 * 同一ユーザーは THROTTLE_MINUTES に 1 回まで更新（スロットリング）。
 */
export async function touchUserActivity(userId: string): Promise<void> {
  const throttleSince = new Date(Date.now() - THROTTLE_MINUTES * 60 * 1000);
  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: throttleSince } }],
    },
    data: { lastActiveAt: new Date() },
  });
}

/**
 * 直近 ACTIVE_WINDOW_MINUTES 分以内に操作があったユーザー数を返す。
 * ヘッダーの「いま〇人がプレイ中」表示に使用。
 */
export async function getActiveUserCountLast5Min(): Promise<number> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000);
  return prisma.user.count({
    where: { lastActiveAt: { gte: since } },
  });
}
