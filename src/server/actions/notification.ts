"use server";

// docs/066: 通知機能。未読件数・一覧・既読・作成。

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const LIST_LIMIT = 30;

/**
 * 未読通知件数。ログイン必須。ヘッダーバッジ用。
 */
export async function getUnreadNotificationCount(): Promise<
  { success: true; count: number } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: true, count: 0 };
  }
  const count = await prisma.notification.count({
    where: { userId: session.userId, readAt: null },
  });
  return { success: true, count };
}

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * 通知一覧（最新 N 件）。ログイン必須。既読含む。
 */
export async function getNotificationList(): Promise<
  { success: true; items: NotificationRow[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: true, items: [] };
  }
  const rows = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      linkUrl: true,
      readAt: true,
      createdAt: true,
    },
  });
  return { success: true, items: rows };
}

/**
 * 指定通知を既読にする。クリック時に呼ぶ。ログイン必須・自分の通知のみ。
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.userId },
    data: { readAt: new Date() },
  });
  return { success: true };
}

export type CreateNotificationParams = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
};

/**
 * 通知を 1 件作成。任務受注時などサーバー側から呼ぶ。認証不要（内部用）。
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const n = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      linkUrl: params.linkUrl ?? null,
    },
    select: { id: true },
  });
  return { success: true, id: n.id };
}
