"use server";

// docs/054_quest_and_research_design.md - クエスト一覧・進捗・達成判定・報酬
// docs/066 - 初回誘導は登録時「あなたに依頼がきています。」条件完了時は「報告可能な任務があります。」

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/server/actions/notification";
import { grantStackableItem } from "@/server/lib/inventory";

export type QuestListItem = {
  questId: string;
  code: string;
  questType: string;
  name: string;
  description: string | null;
  clearReportMessage: string | null;
  state: "in_progress" | "completed";
  progress: number;
  targetCount: number;
  completedAt: Date | null;
  /** クリア報告を画面で確認済みなら日時。未報告なら null で「報告する」を表示 */
  reportAcknowledgedAt: Date | null;
};

export type GetQuestListResult =
  | { success: true; quests: QuestListItem[]; filter: "all" | "story" | "research" | "special" | "general" }
  | { success: false; error: string };

/** 報告受け取り時にモーダル表示する報酬内容 */
export type QuestRewardResult = {
  gra: number;
  researchPoint: number;
  items: { itemId: string; name: string; amount: number }[];
};

/**
 * クエスト一覧を返す。D1: 前提クエストを満たしているが UserQuest が無いクエストは自動作成（出現＝受注）する。
 * 最初のストーリークエストは前提なしなので、初回取得時に 1 件 UserQuest が作られる。
 */
export async function getQuestList(
  filter: "all" | "story" | "research" | "special" | "general" = "all"
): Promise<GetQuestListResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }
  const userId = session.userId;

  const quests = await prisma.quest.findMany({
    orderBy: [{ questType: "asc" }, { id: "asc" }],
    include: {
      prerequisites: { select: { prerequisiteQuestId: true } },
    },
  });

  const userQuests = await prisma.userQuest.findMany({
    where: { userId },
    select: { questId: true, state: true, progress: true, completedAt: true, reportAcknowledgedAt: true },
  });
  const uqMap = new Map(userQuests.map((uq) => [uq.questId, uq]));

  const completedQuestIds = new Set(
    userQuests.filter((uq) => uq.state === "completed").map((uq) => uq.questId)
  );

  // D1: 出現＝受注。前提をすべて満たしているのに UserQuest が無いクエストを自動作成
  for (const q of quests) {
    if (uqMap.has(q.id)) continue;
    const prereqIds = q.prerequisites.map((p) => p.prerequisiteQuestId);
    const prereqDone =
      prereqIds.length === 0 || prereqIds.every((id) => completedQuestIds.has(id));
    if (!prereqDone) continue;
    const created = await prisma.userQuest.create({
      data: {
        userId,
        questId: q.id,
        state: "in_progress",
        progress: 0,
      },
      select: { questId: true, state: true, progress: true, completedAt: true, reportAcknowledgedAt: true },
    });
    uqMap.set(q.id, created);
    // 受注時の通知は廃止。初回誘導はアカウント作成時に「あなたに依頼がきています。」で1回だけ出す（auth.ts）
  }

  const targetCount = (q: { achievementParam: unknown }) => {
    const p = q.achievementParam as { count?: number } | null;
    return p?.count ?? 0;
  };

  const list: QuestListItem[] = quests
    .filter((q) => filter === "all" || q.questType === filter)
    .map((q) => {
      const uq = uqMap.get(q.id);
      return {
        questId: q.id,
        code: q.code,
        questType: q.questType,
        name: q.name,
        description: q.description,
        clearReportMessage: q.clearReportMessage,
        state: (uq?.state ?? "in_progress") as "in_progress" | "completed",
        progress: uq?.progress ?? 0,
        targetCount: targetCount(q),
        completedAt: uq?.completedAt ?? null,
        reportAcknowledgedAt: uq?.reportAcknowledgedAt ?? null,
      };
    });

  return { success: true, quests: list, filter };
}

/**
 * 内部用: エリアクリア 1 回をクエスト進捗に加算する。
 * 目標達成時も state は変更せず、報告押下時に完了・次クエスト出現・報酬付与を行う（B 案）。
 * finishExploration から呼ぶ。
 */
export async function addQuestProgressAreaClear(
  userId: string,
  areaId: string
): Promise<{ completedQuestIds: string[] }> {
  const quests = await prisma.quest.findMany({
    where: {
      achievementType: "area_clear",
      userQuests: {
        some: { userId, state: "in_progress" },
      },
    },
    select: { id: true, achievementParam: true },
  });

  const param = (q: { achievementParam: unknown }) =>
    q.achievementParam as { areaId?: string; count?: number } | null;
  const matching = quests.filter((q) => param(q)?.areaId === areaId);

  let reportableCount = 0;
  for (const q of matching) {
    const uq = await prisma.userQuest.findUnique({
      where: { userId_questId: { userId, questId: q.id } },
      select: { id: true, progress: true, state: true },
    });
    if (!uq || uq.state === "completed") continue;
    const count = param(q)?.count ?? 1;
    const newProgress = uq.progress + 1;
    if (uq.progress < count && newProgress >= count) reportableCount += 1;
    await prisma.userQuest.update({
      where: { id: uq.id },
      data: { progress: newProgress },
    });
  }

  if (reportableCount > 0) {
    try {
      await createNotification({
        userId,
        type: "quest_report_ready",
        title: "報告可能な任務があります。",
        linkUrl: "/dashboard/quests",
      });
    } catch {
      // 通知失敗は進捗更新の成功を優先
    }
  }

  return { completedQuestIds: [] };
}

/**
 * 内部用: 撃破した敵 ID のリストをクエスト進捗に加算。enemy_defeat の該当クエストのみ。
 * 目標達成時も state は変更せず、報告押下時に完了・次クエスト出現・報酬付与を行う（B 案）。
 * runExplorationBattle から呼ぶ（戦闘勝利時）。
 */
export async function addQuestProgressEnemyDefeat(
  userId: string,
  defeatedEnemyIds: string[]
): Promise<{ completedQuestIds: string[] }> {
  if (defeatedEnemyIds.length === 0) return { completedQuestIds: [] };

  const byId = new Map<string, number>();
  for (const id of defeatedEnemyIds) {
    byId.set(id, (byId.get(id) ?? 0) + 1);
  }

  const quests = await prisma.quest.findMany({
    where: {
      achievementType: "enemy_defeat",
      userQuests: {
        some: { userId, state: "in_progress" },
      },
    },
    select: { id: true, achievementParam: true },
  });

  const param = (q: { achievementParam: unknown }) =>
    q.achievementParam as { enemyId?: string; count?: number } | null;

  let reportableCount = 0;
  for (const q of quests) {
    const enemyId = param(q)?.enemyId;
    const add = enemyId ? byId.get(enemyId) ?? 0 : 0;
    if (add <= 0) continue;

    const uq = await prisma.userQuest.findUnique({
      where: { userId_questId: { userId, questId: q.id } },
      select: { id: true, progress: true },
    });
    if (!uq) continue;

    const count = param(q)?.count ?? 0;
    const newProgress = uq.progress + add;
    if (uq.progress < count && newProgress >= count) reportableCount += 1;
    await prisma.userQuest.update({
      where: { id: uq.id },
      data: { progress: newProgress },
    });
  }

  if (reportableCount > 0) {
    try {
      await createNotification({
        userId,
        type: "quest_report_ready",
        title: "報告可能な任務があります。",
        linkUrl: "/dashboard/quests",
      });
    } catch {
      // 通知失敗は進捗更新の成功を優先
    }
  }

  return { completedQuestIds: [] };
}

/** 指定クエストを前提に含む任務のうち、前提をすべて満たしたものの UserQuest を自動作成（出現）。報告押下時にのみ呼ぶ。 */
async function unlockNextQuests(userId: string, completedQuestId: string): Promise<void> {
  const completedIds = await prisma.userQuest
    .findMany({
      where: { userId, state: "completed" },
      select: { questId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.questId)));

  const links = await prisma.questPrerequisite.findMany({
    where: { prerequisiteQuestId: completedQuestId },
    select: { questId: true },
  });
  const candidateQuestIds = [...new Set(links.map((l) => l.questId))];

  for (const questId of candidateQuestIds) {
    const existing = await prisma.userQuest.findUnique({
      where: { userId_questId: { userId, questId } },
      select: { id: true },
    });
    if (existing) continue;

    const prereqs = await prisma.questPrerequisite.findMany({
      where: { questId },
      select: { prerequisiteQuestId: true },
    });
    const allDone = prereqs.every((p) => completedIds.has(p.prerequisiteQuestId));
    if (!allDone) continue;

    await prisma.userQuest.create({
      data: { userId, questId, state: "in_progress", progress: 0 },
    });
  }
}

/**
 * クエスト報酬を付与し、表示用の報酬内容を返す。報告押下時（完了処理内）から呼ぶ。
 * GRA → premiumCurrencyFreeBalance、研究記録書 → researchPoint、アイテム → UserInventory。
 */
async function grantQuestRewards(
  userId: string,
  questId: string
): Promise<QuestRewardResult> {
  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    select: {
      rewardGra: true,
      rewardResearchPoint: true,
      rewardItems: true,
    },
  });
  const gra = quest?.rewardGra ?? 0;
  const researchPoint = quest?.rewardResearchPoint ?? 0;
  const rawItems = quest?.rewardItems;
  const rewardItemSpecs: { itemId: string; amount: number }[] = Array.isArray(rawItems)
    ? (rawItems as unknown[]).filter(
        (e): e is { itemId: string; amount: number } =>
          e != null &&
          typeof (e as { itemId?: unknown }).itemId === "string" &&
          typeof (e as { amount?: unknown }).amount === "number"
      )
    : [];

  const itemNames = new Map<string, string>();
  if (rewardItemSpecs.length > 0) {
    const ids = [...new Set(rewardItemSpecs.map((r) => r.itemId))];
    const items = await prisma.item.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    items.forEach((i) => itemNames.set(i.id, i.name));
  }

  await prisma.$transaction(async (tx) => {
    if (gra > 0 || researchPoint > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(gra > 0 && { premiumCurrencyFreeBalance: { increment: gra } }),
          ...(researchPoint > 0 && { researchPoint: { increment: researchPoint } }),
        },
      });
      if (gra > 0) {
        await tx.currencyTransaction.create({
          data: {
            userId,
            currencyType: "premium_free",
            amount: gra,
            reason: "quest_reward",
            referenceType: "quest",
            referenceId: questId,
          },
        });
      }
    }
    for (const { itemId, amount } of rewardItemSpecs) {
      if (amount <= 0) continue;
      await grantStackableItem(tx, { userId, itemId, delta: amount });
    }
  });

  return {
    gra,
    researchPoint,
    items: rewardItemSpecs.map((r) => ({
      itemId: r.itemId,
      name: itemNames.get(r.itemId) ?? "不明なアイテム",
      amount: r.amount,
    })),
  };
}

/**
 * spec/068: 任務クリア報告で解放する探索テーマ・研究グループをユーザに付与する。
 * 当該任務に紐づく QuestUnlockExplorationTheme / QuestUnlockResearchGroup を参照し、
 * UserExplorationThemeUnlock / UserResearchGroupUnlock に upsert する。
 */
async function grantQuestUnlocks(userId: string, questId: string): Promise<void> {
  const [themeUnlocks, groupUnlocks] = await Promise.all([
    prisma.questUnlockExplorationTheme.findMany({
      where: { questId },
      select: { themeId: true },
    }),
    prisma.questUnlockResearchGroup.findMany({
      where: { questId },
      select: { researchGroupId: true },
    }),
  ]);

  await prisma.$transaction(async (tx) => {
    for (const { themeId } of themeUnlocks) {
      await tx.userExplorationThemeUnlock.upsert({
        where: { userId_themeId: { userId, themeId } },
        create: { userId, themeId },
        update: {},
      });
    }
    for (const { researchGroupId } of groupUnlocks) {
      await tx.userResearchGroupUnlock.upsert({
        where: { userId_researchGroupId: { userId, researchGroupId } },
        create: { userId, researchGroupId },
        update: {},
      });
    }
  });
}

/** クリア報告用: 指定クエストの clearReportMessage を返す。表示用。 */
export async function getQuestClearReportMessage(
  questId: string
): Promise<{ message: string | null } | null> {
  const q = await prisma.quest.findUnique({
    where: { id: questId },
    select: { clearReportMessage: true },
  });
  return q ? { message: q.clearReportMessage } : null;
}

/**
 * クエスト画面で「クリア報告」を押したとき呼ぶ。
 * - 進行中で progress >= 目標: 完了・reportAcknowledgedAt・報酬付与・次クエスト解放。返却で報酬内容を返す。
 * - 既に完了で未報告: reportAcknowledgedAt のみ記録（報酬は返さない）。
 */
export async function acknowledgeQuestReport(
  questId: string
): Promise<
  | { success: true; rewards?: QuestRewardResult }
  | { success: false; error: string }
> {
  const session = await getSession();
  if (!session.userId) return { success: false, error: "UNAUTHORIZED" };

  const uq = await prisma.userQuest.findUnique({
    where: { userId_questId: { userId: session.userId, questId } },
    select: { id: true, state: true, progress: true, reportAcknowledgedAt: true },
  });
  if (!uq) return { success: false, error: "NOT_FOUND" };
  if (uq.reportAcknowledgedAt) return { success: true };

  if (uq.state === "completed") {
    await prisma.userQuest.update({
      where: { id: uq.id },
      data: { reportAcknowledgedAt: new Date() },
    });
    return { success: true };
  }

  if (uq.state === "in_progress") {
    const quest = await prisma.quest.findUnique({
      where: { id: questId },
      select: { achievementParam: true },
    });
    if (!quest) return { success: false, error: "NOT_FOUND" };
    const param = quest.achievementParam as { count?: number } | null;
    const targetCount = param?.count ?? 0;
    if (uq.progress < targetCount) return { success: false, error: "NOT_READY" };

    const now = new Date();
    await prisma.userQuest.update({
      where: { id: uq.id },
      data: {
        state: "completed",
        completedAt: now,
        reportAcknowledgedAt: now,
      },
    });
    await unlockNextQuests(session.userId, questId);
    const rewards = await grantQuestRewards(session.userId, questId);
    await grantQuestUnlocks(session.userId, questId);
    return { success: true, rewards };
  }

  return { success: false, error: "INVALID_STATE" };
}
