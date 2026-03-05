"use server";

// spec/049_exploration.md - 探索メニュー取得（テーマ・エリア一覧）

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { RunTestBattleResult, RunTestBattleSuccess } from "@/server/actions/test-battle";
import { runTestBattle } from "@/server/actions/test-battle";

export type ExplorationAreaSummary = {
  areaId: string;
  name: string;
  description: string | null;
  difficultyRank: number;
  recommendedLevel: number;
  status: "locked" | "available" | "cleared";
};

export type ExplorationThemeSummary = {
  themeId: string;
  name: string;
  description: string | null;
  isUnlocked: boolean;
  areas: ExplorationAreaSummary[];
};

export type GetExplorationMenuResult =
  | { success: true; themes: ExplorationThemeSummary[] }
  | { success: false; error: string };

/**
 * 探索トップ画面用：テーマ・エリア一覧を取得する。
 * MVP では「全テーマ/エリア解放済み & クリア状況は未考慮」とし、status はすべて "available" を返す。
 */
export async function getExplorationMenu(): Promise<GetExplorationMenuResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const themes = await prisma.explorationTheme.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      areas: {
        orderBy: { difficultyRank: "asc" },
      },
    },
  });

  const result: ExplorationThemeSummary[] = themes.map((t) => ({
    themeId: t.id,
    name: t.name,
    description: t.description ?? null,
    // MVP では解放条件・進行状況をまだ持たないため、常に解放済み扱いとする。
    isUnlocked: true,
    areas: t.areas.map((a) => ({
      areaId: a.id,
      name: a.name,
      description: a.description ?? null,
      difficultyRank: a.difficultyRank,
      recommendedLevel: a.recommendedLevel,
      // MVP ではクリア状況をまだ管理しないため、常に available とする。
      status: "available" as const,
    })),
  }));

  return { success: true, themes: result };
}

// --- 探索開始（Expedition 作成） ---

export type StartExplorationConsumable = {
  itemId: string;
  quantity: number;
};

export type StartExplorationParams = {
  areaId: string;
  partyPresetId: string;
  consumables: StartExplorationConsumable[];
};

export type StartExplorationResult =
  | { success: true; expeditionId: string }
  | { success: false; error: string; message: string };

/**
 * 探索開始：エリア・パーティプリセット・持ち込み消耗品から Expedition を作成する。
 * 現時点では消耗品はまだ実装途中のため、パラメータは受け取るが explorationState への保存のみ行い、
 * 実際の消費・効果適用は後続の実装で行う。
 */
export async function startExploration(
  params: StartExplorationParams
): Promise<StartExplorationResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const { areaId, partyPresetId, consumables } = params;

  // エリアの存在チェック
  const area = await prisma.explorationArea.findUnique({
    where: { id: areaId },
    select: {
      id: true,
      normalBattleCount: true,
    },
  });
  if (!area) {
    return { success: false, error: "AREA_NOT_FOUND", message: "指定されたエリアが見つかりません。" };
  }

  // パーティプリセットがユーザーのものであるか検証
  const preset = await prisma.partyPreset.findFirst({
    where: { id: partyPresetId, userId: session.userId },
    select: {
      id: true,
      slot1CharacterId: true,
    },
  });
  if (!preset || !preset.slot1CharacterId) {
    return {
      success: false,
      error: "PRESET_NOT_FOUND",
      message: "指定されたパーティプリセットが見つからないか、主人公が設定されていません。",
    };
  }

  // 既存の進行中探索があれば拒否する（MVP: 1ユーザー1件まで）
  const existingExpedition = await prisma.expedition.findFirst({
    where: {
      userId: session.userId,
      state: { in: ["in_progress", "ready_to_finish"] },
    },
    select: { id: true },
  });
  if (existingExpedition) {
    return {
      success: false,
      error: "EXPEDITION_ALREADY_IN_PROGRESS",
      message: "進行中の探索があります。結果を確認してから新しい探索を開始してください。",
    };
  }

  // 探索用の初期状態を作成
  const expedition = await prisma.expedition.create({
    data: {
      userId: session.userId,
      areaId: area.id,
      partyPresetId: preset.id,
      state: "in_progress",
      remainingNormalBattles: area.normalBattleCount,
      midBossCleared: false,
      lastBossCleared: false,
      battleWinCount: 0,
      skillSuccessCount: 0,
      currentHpMp: null,
      explorationState:
        consumables.length > 0
          ? {
              consumables: consumables.map((c) => ({
                itemId: c.itemId,
                quantity: c.quantity,
              })),
            }
          : null,
      totalExpGained: 0,
    },
    select: { id: true },
  });

  return { success: true, expeditionId: expedition.id };
}

// --- 進行中 Expedition の簡易サマリ ---

export type CurrentExpeditionSummary = {
  expeditionId: string;
  themeName: string;
  areaName: string;
  state: string;
  rounds: number;
  logs: string[];
  remainingNormalBattles: number;
};

/** ログインユーザーの進行中探索（あれば1件）を取得する。なければ null。 */
export async function getCurrentExpeditionSummary(): Promise<CurrentExpeditionSummary | null> {
  const session = await getSession();
  if (!session.userId) return null;

  const expedition = await prisma.expedition.findFirst({
    where: {
      userId: session.userId,
      state: { in: ["in_progress", "ready_to_finish"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      area: {
        select: {
          name: true,
          theme: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!expedition) return null;

  const rounds = expedition.battleWinCount + expedition.skillSuccessCount;
  const rawState = (expedition.explorationState ?? {}) as unknown as {
    logs?: unknown;
  };
  const logs =
    Array.isArray(rawState.logs) && rawState.logs.every((x) => typeof x === "string")
      ? (rawState.logs as string[])
      : [];

  return {
    expeditionId: expedition.id,
    themeName: expedition.area.theme.name,
    areaName: expedition.area.name,
    state: expedition.state,
    rounds,
    logs,
    remainingNormalBattles: expedition.remainingNormalBattles,
  };
}

// --- 探索を1ステップ進める（ログのみ仮実装） ---

export type ContinueExplorationResult =
  | { success: true; expeditionId: string; logs: string[]; rounds: number }
  | { success: false; error: string; message: string };

/**
 * 進行中の探索を 1 ステップ進める。
 * 現時点では「戦闘イベント（仮）」「技能イベント（仮）」のログとラウンド数のみ更新し、
 * 実際の戦闘ロジック接続は後続実装とする。
 */
export async function continueExploration(): Promise<ContinueExplorationResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const expedition = await prisma.expedition.findFirst({
    where: {
      userId: session.userId,
      state: "in_progress",
    },
    include: {
      area: {
        select: {
          name: true,
          baseSkillEventRate: true,
        },
      },
    },
  });

  if (!expedition) {
    return {
      success: false,
      error: "NO_EXPEDITION",
      message: "進行中の探索がありません。",
    };
  }

  // explorationState から既存ログを取得
  const rawState = (expedition.explorationState ?? {}) as unknown as { logs?: unknown };
  const logs: string[] =
    Array.isArray(rawState.logs) && rawState.logs.every((x) => typeof x === "string")
      ? (rawState.logs as string[])
      : [];

  const roundsBefore = expedition.battleWinCount + expedition.skillSuccessCount;

  // エリアの基礎発生率に基づき、技能イベント or 戦闘イベントを仮決定
  const roll = Math.random() * 100;
  const isSkillEvent = roll < expedition.area.baseSkillEventRate;
  const roundIndex = roundsBefore + 1;

  const label = isSkillEvent ? "技能イベント（仮）" : "戦闘イベント（仮）";
  const logLine = `R${roundIndex}: ${expedition.area.name}で${label}が発生した。`;
  logs.push(logLine);

  const updateData: Parameters<typeof prisma.expedition.update>[0]["data"] = {
    explorationState: { ...rawState, logs },
  };

  if (isSkillEvent) {
    updateData.skillSuccessCount = expedition.skillSuccessCount + 1;
  } else {
    updateData.battleWinCount = expedition.battleWinCount + 1;
  }

  const updated = await prisma.expedition.update({
    where: { id: expedition.id },
    data: updateData,
    select: {
      id: true,
      battleWinCount: true,
      skillSuccessCount: true,
      explorationState: true,
    },
  });

  const updatedState = (updated.explorationState ?? {}) as unknown as { logs?: unknown };
  const updatedLogs: string[] =
    Array.isArray(updatedState.logs) && updatedState.logs.every((x) => typeof x === "string")
      ? (updatedState.logs as string[])
      : logs;
  const rounds = updated.battleWinCount + updated.skillSuccessCount;

  return {
    success: true,
    expeditionId: updated.id,
    logs: updatedLogs,
    rounds,
  };
}

// --- 探索戦闘 1 回分（進行中 Expedition に紐づくパーティで実行し、Expedition を更新） ---

export type RunExplorationBattleResult =
  | {
      success: true;
      themeName: string;
      areaName: string;
      remainingNormalBattlesBefore: number;
      result: RunTestBattleSuccess;
    }
  | { success: false; error: string; message: string };

/**
 * 進行中の Expedition に紐づくパーティプリセットで 1 回だけ戦闘を実行し、
 * Expedition.currentHpMp・remainingNormalBattles・battleWinCount・state を更新する。
 */
export async function runExplorationBattle(): Promise<RunExplorationBattleResult> {
  const session = await getSession();
  if (!session.userId) {
    return {
      success: false,
      error: "UNAUTHORIZED",
      message: "ログインしてください",
    };
  }

  const expedition = await prisma.expedition.findFirst({
    where: {
      userId: session.userId,
      state: "in_progress",
    },
    select: {
      id: true,
      partyPresetId: true,
      remainingNormalBattles: true,
      battleWinCount: true,
      currentHpMp: true,
      explorationState: true,
      area: {
        select: {
          name: true,
          theme: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!expedition) {
    return {
      success: false,
      error: "NO_EXPEDITION",
      message: "進行中の探索がありません。",
    };
  }

  const initialHpMpByCharacterId =
    (expedition.currentHpMp as Record<string, { hp: number; mp: number }> | null) ?? undefined;
  const baseResult = await runTestBattle(expedition.partyPresetId, initialHpMpByCharacterId);

  if (!baseResult.success) {
    return baseResult;
  }

  const result = baseResult as RunTestBattleSuccess;

  const hpMpByCharId: Record<
    string,
    {
      hp: number;
      mp: number;
    }
  > = {};

  const charIds = result.partyCharacterIds ?? [];

  for (let i = 0; i < charIds.length; i += 1) {
    const characterId = charIds[i];
    const finalHp = result.summary.partyHpFinals?.[i] ?? result.summary.playerHpFinal;
    const finalMp = result.summary.partyMpFinals?.[i] ?? result.summary.playerMpFinal;
    hpMpByCharId[characterId] = {
      hp: finalHp,
      mp: finalMp,
    };
  }

  // 残り戦闘回数を 1 減らし、勝利数と状態を更新
  const nextRemaining =
    expedition.remainingNormalBattles > 0 ? expedition.remainingNormalBattles - 1 : 0;
  const isPlayerWin = result.result === "player";
  // 勝利していても「残り戦闘 0」になったら、または敗北した時点で探索は終了候補（報酬確定待ち）にする
  const shouldReadyToFinish = !isPlayerWin || nextRemaining <= 0;
  const nextState = shouldReadyToFinish ? ("ready_to_finish" as const) : ("in_progress" as const);

  const rawState = (expedition.explorationState ?? {}) as unknown as {
    logs?: unknown;
    lastBattle?: unknown;
  };
  const explorationState = shouldReadyToFinish
    ? {
        ...rawState,
        lastBattle: result,
      }
    : rawState;

  await prisma.expedition.update({
    where: { id: expedition.id },
    data: {
      currentHpMp: hpMpByCharId,
      remainingNormalBattles: nextRemaining,
      battleWinCount: expedition.battleWinCount + (isPlayerWin ? 1 : 0),
      state: nextState,
      explorationState,
    },
  });

  return {
    success: true,
    themeName: expedition.area.theme.name,
    areaName: expedition.area.name,
    remainingNormalBattlesBefore: expedition.remainingNormalBattles,
    result,
  };
}

// --- 直近の探索戦闘結果（最後の 1 戦）の取得 ---

export async function getLastExplorationBattle(): Promise<RunTestBattleSuccess | null> {
  const session = await getSession();
  if (!session.userId) return null;

  const expedition = await prisma.expedition.findFirst({
    where: {
      userId: session.userId,
      state: { in: ["in_progress", "ready_to_finish"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      explorationState: true,
    },
  });

  if (!expedition) return null;

  const rawState = (expedition.explorationState ?? {}) as unknown as {
    lastBattle?: unknown;
  };

  if (!rawState.lastBattle) return null;

  const lastBattle = rawState.lastBattle as RunTestBattleSuccess;
  if (!lastBattle.success) return null;

  return lastBattle;
}

// --- 探索終了（報酬確定） ---

export type FinishExplorationDropSlotOrigin =
  | "base"
  | "battle"
  | "skill"
  | "mid_boss"
  | "last_boss_special";

export type FinishExplorationDropSlot = {
  origin: FinishExplorationDropSlotOrigin;
  label: string;
};

export type FinishExplorationSummary = {
  themeName: string;
  areaName: string;
  result: "cleared" | "wiped";
  battleWins: number;
  skillSuccessCount: number;
  totalExpGained: number;
  dropSlots: FinishExplorationDropSlot[];
};

export type FinishExplorationResult =
  | { success: true; summary: FinishExplorationSummary }
  | { success: false; error: string; message: string };

/**
 * 探索を終了し、Expedition を finished にする。
 * MVP では experience 付与や実際のアイテム付与はまだ行わず、
 * 「どの由来のドロップ枠がいくつあるか」が分かるサマリだけ返す。
 */
export async function finishExploration(): Promise<FinishExplorationResult> {
  const session = await getSession();
  if (!session.userId) {
    return {
      success: false,
      error: "UNAUTHORIZED",
      message: "ログインしてください",
    };
  }

  const expedition = await prisma.expedition.findFirst({
    where: {
      userId: session.userId,
      state: "ready_to_finish",
    },
    include: {
      area: {
        select: {
          name: true,
          baseDropMin: true,
          baseDropMax: true,
          theme: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!expedition) {
    return {
      success: false,
      error: "NO_EXPEDITION_TO_FINISH",
      message: "終了処理可能な探索がありません。",
    };
  }

  const isCleared = expedition.remainingNormalBattles <= 0;

  // docs/020, spec/049 に基づく仮実装:
  // - Exp は雑魚勝利×1 / 中ボス+2 / 大ボス+5 の合計
  const expFromBattles = expedition.battleWinCount;
  const expFromMidBoss = expedition.midBossCleared ? 2 : 0;
  const expFromLastBoss = expedition.lastBossCleared ? 5 : 0;
  const totalExpGained = expFromBattles + expFromMidBoss + expFromLastBoss;

  // ドロップ枠の内訳（値のロールはまだ行わず、「枠の由来」を示すだけ）
  const baseSlots = expedition.area.baseDropMin;
  const battleSlots = expedition.battleWinCount;
  const skillSlots = expedition.skillSuccessCount;
  const midBossSlots = expedition.midBossCleared ? 2 : 0;
  const lastBossSlots = expedition.lastBossCleared ? 1 : 0;

  const dropSlots: FinishExplorationDropSlot[] = [];

  for (let i = 0; i < baseSlots; i += 1) {
    dropSlots.push({
      origin: "base",
      label: `基本ドロップ枠 ${i + 1}`,
    });
  }
  for (let i = 0; i < battleSlots; i += 1) {
    dropSlots.push({
      origin: "battle",
      label: `戦闘ボーナス枠 ${i + 1}`,
    });
  }
  for (let i = 0; i < skillSlots; i += 1) {
    dropSlots.push({
      origin: "skill",
      label: `技能イベント枠 ${i + 1}`,
    });
  }
  for (let i = 0; i < midBossSlots; i += 1) {
    dropSlots.push({
      origin: "mid_boss",
      label: `中ボスボーナス枠 ${i + 1}`,
    });
  }
  for (let i = 0; i < lastBossSlots; i += 1) {
    dropSlots.push({
      origin: "last_boss_special",
      label: `大ボス専用枠 ${i + 1}`,
    });
  }

  await prisma.expedition.update({
    where: { id: expedition.id },
    data: {
      state: "finished",
      totalExpGained,
    },
  });

  return {
    success: true,
    summary: {
      themeName: expedition.area.theme.name,
      areaName: expedition.area.name,
      result: isCleared ? "cleared" : "wiped",
      battleWins: expedition.battleWinCount,
      skillSuccessCount: expedition.skillSuccessCount,
      totalExpGained,
      dropSlots,
    },
  };
}

// --- テスト用: 進行中の探索を強制破棄 ---

export async function abortCurrentExpedition(): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  const expedition = await prisma.expedition.findFirst({
    where: {
      userId: session.userId,
      state: { in: ["in_progress", "ready_to_finish"] },
    },
    select: { id: true },
  });

  if (!expedition) {
    return { success: false, error: "NO_EXPEDITION" };
  }

  await prisma.expedition.update({
    where: { id: expedition.id },
    data: { state: "aborted" },
  });

  return { success: true };
}


