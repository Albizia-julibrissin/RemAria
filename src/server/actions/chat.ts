"use server";

// spec/037, 094 - 全体チャット・システムメッセージ（任務達成通知等）

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const BODY_MAX_LEN = 500;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type ChatMessageItem = {
  id: string;
  userId: string | null;
  senderName: string;
  body: string;
  createdAt: string; // ISO
  /** spec/094: "user" | "system" */
  kind: "user" | "system";
  systemKind: string | null;
  payload: { userId?: string; questId?: string; questName?: string } | null;
  /** 表示対象ユーザー（送信者または quest_clear の主体）の主人公アイコン。null は非表示。 */
  protagonistIconFilename: string | null;
  /** kind=system のとき、リンク表示用の主体の表示名（例: quest_clear のプレイヤー名）。 */
  subjectName: string | null;
  /** 開拓者証リンク用。プロフィールは /dashboard/profile/[accountId] なので、表示対象ユーザーの accountId。 */
  accountId: string | null;
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
    data: { userId: session.userId, body, kind: "user" },
    include: {
      user: {
        select: {
          name: true,
          accountId: true,
          protagonistCharacter: { select: { iconFilename: true } },
        },
      },
    },
  });

  const senderName = row.user?.name?.trim() || "冒険者";
  const protagonistIconFilename =
    row.user?.protagonistCharacter?.iconFilename ?? null;
  const accountId = row.user?.accountId ?? null;

  return {
    success: true,
    message: {
      id: row.id,
      userId: row.userId,
      senderName,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      kind: "user",
      systemKind: null,
      payload: null,
      protagonistIconFilename,
      subjectName: null,
      accountId,
    },
  };
}

/** spec/037, 094: 直近N件のメッセージを取得（createdAt 降順）。kind, systemKind, payload, protagonistIconFilename を含む。 */
export async function getRecentChatMessages(
  limit?: number
): Promise<GetRecentChatMessagesResult> {
  const cap = limit == null ? DEFAULT_LIMIT : Math.min(Math.max(1, limit), MAX_LIMIT);

  const rows = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: cap,
    include: {
      user: {
        select: {
          name: true,
          accountId: true,
          protagonistCharacter: { select: { iconFilename: true } },
        },
      },
    },
  });

  // spec/094: システムメッセージの payload.userId から主人公アイコン・表示名・accountId を取得
  const subjectUserIds = new Set<string>();
  for (const r of rows) {
    if (r.kind === "system" && r.payload && typeof r.payload === "object" && "userId" in r.payload && typeof (r.payload as { userId?: unknown }).userId === "string") {
      subjectUserIds.add((r.payload as { userId: string }).userId);
    }
  }
  const subjectIconMap = new Map<string, string | null>();
  const subjectNameMap = new Map<string, string>();
  const subjectAccountIdMap = new Map<string, string>();
  if (subjectUserIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...subjectUserIds] } },
      select: {
        id: true,
        name: true,
        accountId: true,
        protagonistCharacter: { select: { iconFilename: true } },
      },
    });
    for (const u of users) {
      subjectIconMap.set(u.id, u.protagonistCharacter?.iconFilename ?? null);
      subjectNameMap.set(u.id, u.name?.trim() || "冒険者");
      subjectAccountIdMap.set(u.id, u.accountId);
    }
  }

  const messages: ChatMessageItem[] = rows.map((r) => {
    const payload =
      r.payload && typeof r.payload === "object"
        ? (r.payload as { userId?: string; questId?: string; questName?: string })
        : null;
    const protagonistIconFilename =
      r.kind === "user" && r.user
        ? r.user.protagonistCharacter?.iconFilename ?? null
        : r.kind === "system" && payload?.userId
          ? subjectIconMap.get(payload.userId) ?? null
          : null;

    const subjectName =
      r.kind === "system" && payload?.userId
        ? subjectNameMap.get(payload.userId) ?? null
        : null;

    const accountId =
      r.kind === "user" && r.user
        ? r.user.accountId
        : r.kind === "system" && payload?.userId
          ? subjectAccountIdMap.get(payload.userId) ?? null
          : null;

    return {
      id: r.id,
      userId: r.userId,
      senderName: r.kind === "user" && r.user ? (r.user.name?.trim() || "冒険者") : "",
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      kind: r.kind as "user" | "system",
      systemKind: r.systemKind,
      payload,
      protagonistIconFilename,
      subjectName,
      accountId,
    };
  });

  return { success: true, messages };
}

/** spec/094: 任務クリア報告時にチャットに quest_clear システムメッセージを 1 件投稿。acknowledgeQuestReport から呼ぶ。任務の notifyChatOnClear が true のときのみ投稿。 */
export async function createQuestClearChatMessage(
  userId: string,
  questId: string
): Promise<void> {
  const [user, quest] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
    prisma.quest.findUnique({
      where: { id: questId },
      select: { name: true, notifyChatOnClear: true },
    }),
  ]);
  if (!user || !quest || !quest.notifyChatOnClear) return;

  const senderName = user.name?.trim() || "冒険者";
  const body = `${senderName}が任務「${quest.name}」を達成しました。`;
  const payload = {
    userId,
    questId,
    questName: quest.name,
  };

  await prisma.chatMessage.create({
    data: {
      userId: null,
      kind: "system",
      systemKind: "quest_clear",
      body,
      payload,
    },
  });
}
