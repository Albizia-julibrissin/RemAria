"use server";

// docs/054_quest_and_research_design.md - クエスト一覧・進捗・達成判定・報酬

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

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
  | { success: true; quests: QuestListItem[]; filter: "all" | "story" | "research" }
  | { success: false; error: string };

/**
 * クエスト一覧を返す。D1: 前提クエストを満たしているが UserQuest が無いクエストは自動作成（出現＝受注）する。
 * 最初のストーリークエストは前提なしなので、初回取得時に 1 件 UserQuest が作られる。
 */
export async function getQuestList(
  filter: "all" | "story" | "research" = "all"
): Promise<GetQuestListResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }
  const userId = session.userId;

  const quests = await prisma.quest.findMany({
    orderBy: [{ questType: "asc" }, { id: "asc" }],
    include: {
      prerequisiteQuest: { select: { id: true } },
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

  // D1: 出現＝受注。前提を満たしているのに UserQuest が無いクエストを自動作成
  for (const q of quests) {
    if (uqMap.has(q.id)) continue;
    const prereqDone = !q.prerequisiteQuestId || completedQuestIds.has(q.prerequisiteQuestId);
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
 * 内部用: エリアクリア 1 回をクエスト進捗に加算し、達成なら完了・報酬（次のクエスト出現）を行う。
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
    select: { id: true, achievementParam: true, prerequisiteQuestId: true },
  });

  const param = (q: { achievementParam: unknown }) =>
    q.achievementParam as { areaId?: string; count?: number } | null;
  const matching = quests.filter((q) => param(q)?.areaId === areaId);
  const completedQuestIds: string[] = [];

  for (const q of matching) {
    const uq = await prisma.userQuest.findUnique({
      where: { userId_questId: { userId, questId: q.id } },
      select: { id: true, progress: true, state: true },
    });
    if (!uq || uq.state === "completed") continue;
    const count = param(q)?.count ?? 1;
    const newProgress = uq.progress + 1;
    const now = new Date();
    if (newProgress >= count) {
      await prisma.userQuest.update({
        where: { id: uq.id },
        data: { state: "completed", progress: newProgress, completedAt: now },
      });
      completedQuestIds.push(q.id);
    } else {
      await prisma.userQuest.update({
        where: { id: uq.id },
        data: { progress: newProgress },
      });
    }
  }

  for (const questId of completedQuestIds) {
    await unlockNextQuests(userId, questId);
  }

  return { completedQuestIds };
}

/**
 * 内部用: 撃破した敵 ID のリストをクエスト進捗に加算。enemy_defeat の該当クエストのみ。
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
  const completedQuestIds: string[] = [];

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
    const now = new Date();
    if (newProgress >= count) {
      await prisma.userQuest.update({
        where: { id: uq.id },
        data: { state: "completed", progress: newProgress, completedAt: now },
      });
      completedQuestIds.push(q.id);
    } else {
      await prisma.userQuest.update({
        where: { id: uq.id },
        data: { progress: newProgress },
      });
    }
  }

  for (const questId of completedQuestIds) {
    await unlockNextQuests(userId, questId);
  }

  return { completedQuestIds };
}

/** 指定クエストを前提とするクエストの UserQuest を自動作成（出現）。報酬の「次のクエスト解放」 */
async function unlockNextQuests(userId: string, completedQuestId: string): Promise<void> {
  const nextQuests = await prisma.quest.findMany({
    where: { prerequisiteQuestId: completedQuestId },
    select: { id: true },
  });
  for (const q of nextQuests) {
    await prisma.userQuest.upsert({
      where: { userId_questId: { userId, questId: q.id } },
      create: { userId, questId: q.id, state: "in_progress", progress: 0 },
      update: {},
    });
  }
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

/** クエスト画面で「クリア報告」を確認したとき呼ぶ。reportAcknowledgedAt を記録する。 */
export async function acknowledgeQuestReport(
  questId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session.userId) return { success: false, error: "UNAUTHORIZED" };

  const uq = await prisma.userQuest.findUnique({
    where: { userId_questId: { userId: session.userId, questId } },
    select: { id: true, state: true, reportAcknowledgedAt: true },
  });
  if (!uq || uq.state !== "completed") return { success: false, error: "NOT_COMPLETED" };
  if (uq.reportAcknowledgedAt) return { success: true };

  await prisma.userQuest.update({
    where: { id: uq.id },
    data: { reportAcknowledgedAt: new Date() },
  });
  return { success: true };
}
