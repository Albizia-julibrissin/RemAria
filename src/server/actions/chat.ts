"use server";

// spec/037, docs/022 - 全体チャット

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const BODY_MAX_LEN = 500;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type ChatMessageItem = {
  id: string;
  userId: string;
  senderName: string;
  body: string;
  createdAt: string; // ISO
};

export type SendChatMessageResult =
  | { success: true; message: ChatMessageItem }
  | { success: false; error: string; message: string };

export type GetRecentChatMessagesResult =
  | { success: true; messages: ChatMessageItem[] }
  | { success: false; error: string; message: string };

function trimBody(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const t = body.trim();
  return t.length > 0 ? t : null;
}

/** spec/037: 全体チャットに1件送信 */
export async function sendChatMessage(formData: FormData): Promise<SendChatMessageResult> {
  const session = await getSession();
  if (!session?.isLoggedIn || !session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const rawBody = formData.get("body");
  const body = trimBody(rawBody);
  if (body === null) {
    return { success: false, error: "VALIDATION_ERROR", message: "メッセージを入力してください。" };
  }
  if (body.length > BODY_MAX_LEN) {
    return {
      success: false,
      error: "VALIDATION_ERROR",
      message: `メッセージは${BODY_MAX_LEN}文字以内で入力してください。`,
    };
  }

  const row = await prisma.chatMessage.create({
    data: { userId: session.userId, body },
    include: { user: { select: { name: true } } },
  });

  const senderName = row.user.name?.trim() || "冒険者";

  return {
    success: true,
    message: {
      id: row.id,
      userId: row.userId,
      senderName,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

/** spec/037: 直近N件のメッセージを取得（createdAt 降順） */
export async function getRecentChatMessages(
  limit?: number
): Promise<GetRecentChatMessagesResult> {
  const cap = limit == null ? DEFAULT_LIMIT : Math.min(Math.max(1, limit), MAX_LIMIT);

  const rows = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: cap,
    include: { user: { select: { name: true } } },
  });

  const messages: ChatMessageItem[] = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    senderName: r.user.name?.trim() || "冒険者",
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));

  return { success: true, messages };
}
