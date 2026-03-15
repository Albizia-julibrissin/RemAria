"use server";

// spec/090: 郵便（運営→プレイヤー）。一覧・詳細・既読・受取・管理送信。

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { isAdminUser } from "@/server/lib/admin";
import { grantStackableItem } from "@/server/lib/inventory";
import { createNotification } from "@/server/actions/notification";
import { CURRENCY_REASON_MAIL_REWARD } from "@/lib/constants/currency-transaction-reasons";

const MAIL_ARRIVED_TYPE = "mail_arrived";
const MAIL_LINK_URL = "/dashboard/mail";

type RewardItemSpec = { itemId: string; amount: number };

function parseRewardItems(raw: unknown): RewardItemSpec[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(
    (e): e is RewardItemSpec =>
      e != null &&
      typeof (e as { itemId?: unknown }).itemId === "string" &&
      typeof (e as { amount?: unknown }).amount === "number"
  );
}

function parseRewardTitleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter((e): e is string => typeof e === "string");
}

export type MailListItem = {
  id: string;
  mailId: string;
  title: string;
  createdAt: Date;
  readAt: Date | null;
  receivedAt: Date | null;
  hasReward: boolean;
  expiresAt: Date | null;
};

/**
 * 自分の郵便一覧。有効期限切れは非表示。未読優先・届いた日時降順。
 */
export async function getMailList(): Promise<
  { success: true; items: MailListItem[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }
  const now = new Date();
  const rows = await prisma.userMail.findMany({
    where: {
      userId: session.userId,
      mail: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      mailId: true,
      readAt: true,
      receivedAt: true,
      createdAt: true,
      mail: {
        select: {
          title: true,
          rewardGraFree: true,
          rewardGraPaid: true,
          rewardResearchPoint: true,
          rewardItems: true,
          rewardTitleIds: true,
          expiresAt: true,
        },
      },
    },
  });
  const items: MailListItem[] = rows
    .map((r) => {
    const itemsJson = r.mail.rewardItems;
    const titlesJson = r.mail.rewardTitleIds;
    const hasItems = parseRewardItems(itemsJson).some((x) => x.amount > 0);
    const hasTitles = parseRewardTitleIds(titlesJson).length > 0;
    const hasReward =
      (r.mail.rewardGraFree ?? 0) > 0 ||
      (r.mail.rewardGraPaid ?? 0) > 0 ||
      (r.mail.rewardResearchPoint ?? 0) > 0 ||
      hasItems ||
      hasTitles;
    return {
      id: r.id,
      mailId: r.mailId,
      title: r.mail.title,
      createdAt: r.createdAt,
      readAt: r.readAt,
      receivedAt: r.receivedAt,
      hasReward,
      expiresAt: r.mail.expiresAt,
    };
  })
    .sort((a, b) => {
      const aUnread = a.readAt ? 0 : 1;
      const bUnread = b.readAt ? 0 : 1;
      if (aUnread !== bUnread) return bUnread - aUnread; // 未読を先に
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  return { success: true, items };
}

/**
 * 未読または未受取の郵便件数（ヘッダーバッジ用）。有効期限切れは含めない。
 */
export async function getUnreadMailCount(): Promise<
  { success: true; count: number } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: true, count: 0 };
  }
  const now = new Date();
  const count = await prisma.userMail.count({
    where: {
      userId: session.userId,
      receivedAt: null,
      mail: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    },
  });
  return { success: true, count };
}

export type MailDetailReward = {
  graFree: number;
  graPaid: number;
  researchPoint: number;
  items: { itemId: string; name: string; amount: number }[];
  titles: { id: string; name: string }[];
};

export type MailDetail = {
  id: string;
  mailId: string;
  title: string;
  body: string | null;
  createdAt: Date;
  readAt: Date | null;
  receivedAt: Date | null;
  expiresAt: Date | null;
  isExpired: boolean;
  canReceive: boolean;
  reward: MailDetailReward;
};

/**
 * 1通の詳細。自分の UserMail のみ。
 */
export async function getMailDetail(
  userMailId: string
): Promise<{ success: true; mail: MailDetail } | { success: false; error: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }
  const um = await prisma.userMail.findFirst({
    where: { id: userMailId, userId: session.userId },
    include: {
      mail: true,
    },
  });
  if (!um) {
    return { success: false, error: "NOT_FOUND" };
  }
  const now = new Date();
  const isExpired = um.mail.expiresAt != null && um.mail.expiresAt <= now;
  const canReceive =
    !isExpired && um.receivedAt == null && hasAnyReward(um.mail);

  const rewardItems = parseRewardItems(um.mail.rewardItems).filter((r) => r.amount > 0);
  const rewardTitleIds = parseRewardTitleIds(um.mail.rewardTitleIds);
  const itemIds = [...new Set(rewardItems.map((r) => r.itemId))];
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true },
  });
  const itemNames = new Map(items.map((i) => [i.id, i.name]));
  const titles =
    rewardTitleIds.length > 0
      ? await prisma.title.findMany({
          where: { id: { in: rewardTitleIds } },
          select: { id: true, name: true },
        })
      : [];

  const reward: MailDetailReward = {
    graFree: um.mail.rewardGraFree ?? 0,
    graPaid: um.mail.rewardGraPaid ?? 0,
    researchPoint: um.mail.rewardResearchPoint ?? 0,
    items: rewardItems.map((r) => ({
      itemId: r.itemId,
      name: itemNames.get(r.itemId) ?? "不明なアイテム",
      amount: r.amount,
    })),
    titles: titles.map((t) => ({ id: t.id, name: t.name })),
  };

  return {
    success: true,
    mail: {
      id: um.id,
      mailId: um.mailId,
      title: um.mail.title,
      body: um.mail.body,
      createdAt: um.createdAt,
      readAt: um.readAt,
      receivedAt: um.receivedAt,
      expiresAt: um.mail.expiresAt,
      isExpired,
      canReceive,
      reward,
    },
  };
}

function hasAnyReward(mail: {
  rewardGraFree: number | null;
  rewardGraPaid: number | null;
  rewardResearchPoint: number | null;
  rewardItems: unknown;
  rewardTitleIds: unknown;
}): boolean {
  if ((mail.rewardGraFree ?? 0) > 0) return true;
  if ((mail.rewardGraPaid ?? 0) > 0) return true;
  if ((mail.rewardResearchPoint ?? 0) > 0) return true;
  if (parseRewardItems(mail.rewardItems).some((r) => r.amount > 0)) return true;
  if (parseRewardTitleIds(mail.rewardTitleIds).length > 0) return true;
  return false;
}

/**
 * 開封＝既読。
 */
export async function markMailRead(
  userMailId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }
  await prisma.userMail.updateMany({
    where: { id: userMailId, userId: session.userId },
    data: { readAt: new Date() },
  });
  return { success: true };
}

/**
 * 受取。未受取かつ有効期限内の場合のみ付与し receivedAt を設定。
 */
export async function receiveMail(
  userMailId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }
  const userId = session.userId;

  const um = await prisma.userMail.findFirst({
    where: { id: userMailId, userId },
    include: { mail: true },
  });
  if (!um) {
    return { success: false, error: "NOT_FOUND" };
  }
  if (um.receivedAt != null) {
    return { success: false, error: "ALREADY_RECEIVED" };
  }
  const now = new Date();
  if (um.mail.expiresAt != null && um.mail.expiresAt <= now) {
    return { success: false, error: "EXPIRED" };
  }

  const graFree = um.mail.rewardGraFree ?? 0;
  const graPaid = um.mail.rewardGraPaid ?? 0;
  const researchPoint = um.mail.rewardResearchPoint ?? 0;
  const rewardItemSpecs = parseRewardItems(um.mail.rewardItems).filter((r) => r.amount > 0);
  const rewardTitleIds = parseRewardTitleIds(um.mail.rewardTitleIds);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      premiumCurrencyFreeBalance: true,
      premiumCurrencyPaidBalance: true,
    },
  });
  const beforeFree = user?.premiumCurrencyFreeBalance ?? 0;
  const beforePaid = user?.premiumCurrencyPaidBalance ?? 0;
  const afterFree = beforeFree + graFree;
  const afterPaid = beforePaid + graPaid;

  await prisma.$transaction(async (tx) => {
    if (graFree > 0 || graPaid > 0 || researchPoint > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(graFree > 0 && { premiumCurrencyFreeBalance: { increment: graFree } }),
          ...(graPaid > 0 && { premiumCurrencyPaidBalance: { increment: graPaid } }),
          ...(researchPoint > 0 && { researchPoint: { increment: researchPoint } }),
        },
      });
    }
    if (graFree > 0) {
      await tx.currencyTransaction.create({
        data: {
          userId,
          currencyType: "premium_free",
          amount: graFree,
          beforeBalance: beforeFree,
          afterBalance: afterFree,
          reason: CURRENCY_REASON_MAIL_REWARD,
          referenceType: "user_mail",
          referenceId: userMailId,
        },
      });
    }
    if (graPaid > 0) {
      await tx.currencyTransaction.create({
        data: {
          userId,
          currencyType: "premium_paid",
          amount: graPaid,
          beforeBalance: beforePaid,
          afterBalance: afterPaid,
          reason: CURRENCY_REASON_MAIL_REWARD,
          referenceType: "user_mail",
          referenceId: userMailId,
        },
      });
    }
    for (const { itemId, amount } of rewardItemSpecs) {
      await grantStackableItem(tx, {
        userId,
        itemId,
        delta: amount,
        ignoreLimit: true,
      });
    }
    for (const titleId of rewardTitleIds) {
      if (!titleId) continue;
      await tx.userTitleUnlock.upsert({
        where: { userId_titleId: { userId, titleId } },
        create: { userId, titleId },
        update: {},
      });
    }
    await tx.userMail.update({
      where: { id: userMailId },
      data: {
        receivedAt: now,
        readAt: um.readAt ?? now,
      },
    });
  });

  return { success: true };
}

// --- Admin ---

export type AdminMailListItem = {
  id: string;
  title: string;
  createdAt: Date;
  expiresAt: Date | null;
  recipientCount: number;
  receivedCount: number;
};

/**
 * 管理: 送信済み郵便一覧。
 */
export async function getAdminMailList(): Promise<
  { success: true; items: AdminMailListItem[] } | { success: false; error: string }
> {
  const ok = await isAdminUser();
  if (!ok) {
    return { success: false, error: "FORBIDDEN" };
  }
  const rows = await prisma.mail.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      expiresAt: true,
      _count: { select: { userMails: true } },
      userMails: {
        where: { receivedAt: { not: null } },
        select: { id: true },
      },
    },
  });
  const items: AdminMailListItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    recipientCount: r._count.userMails,
    receivedCount: r.userMails.length,
  }));
  return { success: true, items };
}

export type SendMailInput = {
  title: string;
  body: string | null;
  rewardGraFree: number;
  rewardGraPaid: number;
  rewardResearchPoint: number;
  rewardItems: RewardItemSpec[];
  rewardTitleIds: string[];
  expiresAt: Date | null;
  targetType: "all" | "users";
  userIds?: string[];
};

/**
 * 管理: 郵便送信。Mail 作成 + 対象ユーザー分 UserMail 作成 + 各ユーザーに「郵便が届きました。」通知（リンク付き）。
 */
export async function sendMail(
  input: SendMailInput
): Promise<{ success: true; mailId: string; recipientCount: number } | { success: false; error: string }> {
  const ok = await isAdminUser();
  if (!ok) {
    return { success: false, error: "FORBIDDEN" };
  }

  const title = input.title.trim();
  if (!title) {
    return { success: false, error: "TITLE_REQUIRED" };
  }
  const rewardItems = input.rewardItems.filter((r) => r.itemId.trim() && r.amount > 0);
  const rewardTitleIds = (input.rewardTitleIds ?? []).filter((id) => id.trim());

  let userIds: string[];
  if (input.targetType === "all") {
    const users = await prisma.user.findMany({
      where: { accountStatus: "active" },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
  } else {
    userIds = [...(input.userIds ?? [])].filter((id) => id.trim());
    if (userIds.length === 0) {
      return { success: false, error: "NO_RECIPIENTS" };
    }
  }

  const rewardItemsJson = rewardItems.map((r) => ({ itemId: r.itemId.trim(), amount: r.amount }));
  const rewardTitleIdsJson = rewardTitleIds;

  const mail = await prisma.mail.create({
    data: {
      title,
      body: input.body?.trim() || null,
      rewardGraFree: Math.max(0, Math.floor(input.rewardGraFree)),
      rewardGraPaid: Math.max(0, Math.floor(input.rewardGraPaid)),
      rewardResearchPoint: Math.max(0, Math.floor(input.rewardResearchPoint)),
      rewardItems: rewardItemsJson.length > 0 ? rewardItemsJson : undefined,
      rewardTitleIds: rewardTitleIdsJson.length > 0 ? rewardTitleIdsJson : undefined,
      expiresAt: input.expiresAt ?? undefined,
    },
    select: { id: true },
  });

  for (const uid of userIds) {
    await prisma.userMail.create({
      data: {
        userId: uid,
        mailId: mail.id,
      },
    });
    await createNotification({
      userId: uid,
      type: MAIL_ARRIVED_TYPE,
      title: "郵便が届きました。",
      body: title,
      linkUrl: MAIL_LINK_URL,
    });
  }

  return {
    success: true,
    mailId: mail.id,
    recipientCount: userIds.length,
  };
}
