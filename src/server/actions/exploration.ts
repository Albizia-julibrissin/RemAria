"use server";

// spec/049_exploration.md - 探索メニュー取得（テーマ・エリア一覧）

import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { RunBattleSuccess } from "@/server/actions/battle";
import { runBattle } from "@/server/actions/battle";
import { userRepository } from "@/server/repositories/user-repository";
import {
  resolveEnemiesForExplorationBattle,
  type ExplorationBattleType,
} from "@/server/lib/resolve-exploration-enemies";
import { computeDerivedStats } from "@/lib/battle/derived-stats";

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

  // 消耗品の検証：一種類まで・所持数・持ち込み上限（アイテムごと）
  if (consumables.length > 0) {
    const itemIds = [...new Set(consumables.map((c) => c.itemId))];
    if (itemIds.length > 1) {
      return {
        success: false,
        error: "CONSUMABLE_ONE_TYPE",
        message: "持ち込める消耗品は一種類までです。",
      };
    }
    const [userInv, items] = await Promise.all([
      prisma.userInventory.findMany({
        where: { userId: session.userId, itemId: { in: itemIds } },
        select: { itemId: true, quantity: true },
      }),
      prisma.item.findMany({
        where: { id: { in: itemIds }, category: "consumable" },
        select: { id: true, maxCarryPerExpedition: true },
      }),
    ]);
    const invByItem = new Map(userInv.map((r) => [r.itemId, r.quantity]));
    const itemMeta = new Map(items.map((i) => [i.id, i.maxCarryPerExpedition ?? 0]));
    const totalByItem = new Map<string, number>();
    for (const c of consumables) {
      if (c.quantity <= 0) continue;
      totalByItem.set(c.itemId, (totalByItem.get(c.itemId) ?? 0) + c.quantity);
    }
    for (const [itemId, used] of totalByItem.entries()) {
      const owned = invByItem.get(itemId) ?? 0;
      const carryLimit = itemMeta.get(itemId) ?? 0;
      if (owned < used) {
        return {
          success: false,
          error: "CONSUMABLE_QUANTITY",
          message: "指定した消耗品の所持数が不足しています。",
        };
      }
      if (carryLimit < used) {
        return {
          success: false,
          error: "CONSUMABLE_CARRY_LIMIT",
          message: "一部の消耗品が持ち込み上限を超えています。",
        };
      }
    }

    // 開始時に倉庫から持ち込み分を減算する（未使用分も消費扱い）
    for (const [itemId, used] of totalByItem.entries()) {
      const inv = await prisma.userInventory.findUnique({
        where: {
          userId_itemId: {
            userId: session.userId,
            itemId,
          },
        },
        select: { quantity: true },
      });
      if (!inv) continue;
      const nextQuantity = Math.max(0, inv.quantity - used);
      await prisma.userInventory.update({
        where: {
          userId_itemId: {
            userId: session.userId,
            itemId,
          },
        },
        data: { quantity: nextQuantity },
      });
    }
  }

  // 探索用の初期状態を作成
  const expedition = await prisma.expedition.create({
    data: {
      userId: session.userId,
      areaId: area.id,
      partyPresetId: preset.id,
      state: "in_progress",
      remainingNormalBattles: area.normalBattleCount,
      strongEnemyCleared: false,
      areaLordCleared: false,
      battleWinCount: 0,
      skillSuccessCount: 0,
      currentHpMp: Prisma.JsonNull,
      explorationState:
        consumables.length > 0
          ? ({
              consumables: consumables.map((c) => ({
                itemId: c.itemId,
                quantity: c.quantity,
              })),
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
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

// --- 復帰用: 進行中探索のサマリ（ログなし・次へ用）---

export type GetExplorationResumeSummaryResult =
  | {
      success: true;
      themeName: string;
      areaName: string;
      partyDisplayNames: string[];
      partyHp: number[];
      partyMp: number[];
      partyMaxHp: number[];
      partyMaxMp: number[];
      remainingNormalBattles: number;
      consumables: CarriedConsumableChoice[];
      partyMembers: ExplorationPartyMemberChoice[];
    }
  | { success: false; error: string; message: string };

/**
 * 進行中探索に復帰するときの表示用データを返す。
 * 直前ログは出さず、パーティHP/MP・残り戦闘数・消耗品と「次へ」用の情報だけ返す。
 */
export async function getExplorationResumeSummary(): Promise<GetExplorationResumeSummaryResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const expedition = await prisma.expedition.findFirst({
    where: { userId: session.userId, state: "in_progress" },
    include: {
      area: { select: { name: true, theme: { select: { name: true } } } },
      partyPreset: {
        select: {
          slot1CharacterId: true,
          slot2CharacterId: true,
          slot3CharacterId: true,
        },
      },
    },
  });

  if (!expedition?.partyPreset?.slot1CharacterId) {
    return {
      success: false,
      error: "NO_EXPEDITION",
      message: "進行中の探索がありません。",
    };
  }

  const currentHpMp = (expedition.currentHpMp ?? {}) as Record<string, { hp: number; mp: number }>;
  const preset = expedition.partyPreset;
  const order = [
    preset.slot1CharacterId,
    preset.slot2CharacterId,
    preset.slot3CharacterId,
  ].filter(Boolean) as string[];

  const characters = await prisma.character.findMany({
    where: { id: { in: order }, userId: session.userId },
    select: {
      id: true,
      category: true,
      displayName: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
      CAP: true,
    },
  });

  const user = await userRepository.findById(session.userId);
  const partyDisplayNames: string[] = [];
  const partyHp: number[] = [];
  const partyMp: number[] = [];
  const partyMaxHp: number[] = [];
  const partyMaxMp: number[] = [];

  for (let i = 0; i < order.length; i += 1) {
    const charId = order[i]!;
    const c = characters.find((x) => x.id === charId);
    if (!c) continue;
    const displayName =
      c.category === "protagonist" && user?.name ? user.name : (c.displayName ?? "不明");
    partyDisplayNames.push(displayName);
    const derived = computeDerivedStats({
      STR: c.STR,
      INT: c.INT,
      VIT: c.VIT,
      WIS: c.WIS,
      DEX: c.DEX,
      AGI: c.AGI,
      LUK: c.LUK,
      CAP: c.CAP,
    });
    const override = currentHpMp[charId];
    partyHp.push(override != null ? Math.min(derived.HP, override.hp) : derived.HP);
    partyMp.push(override != null ? Math.min(derived.MP, override.mp) : derived.MP);
    partyMaxHp.push(derived.HP);
    partyMaxMp.push(derived.MP);
  }

  const roundData = await getExplorationRoundConsumablesAndParty();
  const consumables = roundData.success ? roundData.consumables : [];
  const partyMembers = roundData.success ? roundData.partyMembers : [];

  const area = expedition.area as { name: string; theme: { name: string } };
  return {
    success: true,
    themeName: area.theme.name,
    areaName: area.name,
    partyDisplayNames,
    partyHp,
    partyMp,
    partyMaxHp,
    partyMaxMp,
    remainingNormalBattles: expedition.remainingNormalBattles,
    consumables,
    partyMembers,
  };
}

// --- 次ステップの抽選（戦闘 or 技能イベント）---

export type NextExplorationStep =
  | { kind: "battle" }
  | { kind: "strong_enemy_challenge"; themeName: string; areaName: string }
  | { kind: "area_lord_challenge"; themeName: string; areaName: string }
  | {
      kind: "skill_check";
      themeName: string;
      areaName: string;
      eventMessage: string;
      partyDisplayNames: string[];
      partyIconFilenames: (string | null)[];
      partyPositions: { row: number; col: number }[];
      partyHp: number[];
      partyMp: number[];
      partyMaxHp: number[];
      partyMaxMp: number[];
    };

export type GetNextExplorationStepResult =
  | { success: true; step: NextExplorationStep }
  | { success: false; error: string; message: string };

/**
 * 進行中探索の「次の1ステップ」を抽選する。
 * 各イベント終了ごとに抽選する方式（§5）。DB は更新しない。
 */
export async function getNextExplorationStep(): Promise<GetNextExplorationStepResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const expedition = await prisma.expedition.findFirst({
    where: { userId: session.userId, state: "in_progress" },
    select: {
      currentHpMp: true,
      remainingNormalBattles: true,
      strongEnemyCleared: true,
      areaLordCleared: true,
      explorationState: true,
      area: {
        select: {
          name: true,
          baseSkillEventRate: true,
          theme: { select: { name: true } },
        },
      },
      partyPreset: {
        select: {
          slot1CharacterId: true,
          slot2CharacterId: true,
          slot3CharacterId: true,
          slot1BattleCol: true,
          slot2BattleCol: true,
          slot3BattleCol: true,
        },
      },
    },
  });

  if (!expedition?.partyPreset?.slot1CharacterId) {
    return {
      success: false,
      error: "NO_EXPEDITION",
      message: "進行中の探索がありません。",
    };
  }

  const area = expedition.area as { name: string; baseSkillEventRate: number; theme: { name: string } };
  const themeName = area.theme.name;
  const areaName = area.name;

  // 規定の通常戦闘が残り0 → 強敵へ挑む（戦闘抽選は行わない）
  if (expedition.remainingNormalBattles === 0 && !expedition.strongEnemyCleared) {
    return { success: true, step: { kind: "strong_enemy_challenge", themeName, areaName } };
  }
  // 強敵クリア済みで領域主が出現済み → 領域主へ挑む
  const explorationState = (expedition.explorationState ?? {}) as { areaLordAvailable?: boolean };
  if (
    expedition.remainingNormalBattles === 0 &&
    expedition.strongEnemyCleared &&
    explorationState.areaLordAvailable &&
    !expedition.areaLordCleared
  ) {
    return { success: true, step: { kind: "area_lord_challenge", themeName, areaName } };
  }

  // 通常戦闘が残っているときのみ「戦闘 vs 技能」を抽選
  const currentHpMp = (expedition.currentHpMp ?? {}) as Record<string, { hp: number; mp: number }>;
  const preset = expedition.partyPreset;

  const roll = Math.random() * 100;
  const isSkillEvent = roll < area.baseSkillEventRate;

  if (!isSkillEvent) {
    return { success: true, step: { kind: "battle" } };
  }

  const order = [
    preset.slot1CharacterId,
    preset.slot2CharacterId,
    preset.slot3CharacterId,
  ].filter(Boolean) as string[];

  const characters = await prisma.character.findMany({
    where: { id: { in: order }, userId: session.userId },
    select: {
      id: true,
      category: true,
      displayName: true,
      iconFilename: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
      CAP: true,
    },
  });

  const user = await userRepository.findById(session.userId);
  const colForSlot = [
    Math.max(1, Math.min(3, preset.slot1BattleCol ?? 1)),
    Math.max(1, Math.min(3, preset.slot2BattleCol ?? 1)),
    Math.max(1, Math.min(3, preset.slot3BattleCol ?? 1)),
  ] as const;

  const partyDisplayNames: string[] = [];
  const partyIconFilenames: (string | null)[] = [];
  const partyPositions: { row: number; col: number }[] = [];
  const partyHp: number[] = [];
  const partyMp: number[] = [];
  const partyMaxHp: number[] = [];
  const partyMaxMp: number[] = [];

  for (let i = 0; i < order.length; i += 1) {
    const charId = order[i]!;
    const c = characters.find((x) => x.id === charId);
    if (!c) continue;

    const displayName =
      c.category === "protagonist" && user?.name ? user.name : (c.displayName ?? "不明");
    partyDisplayNames.push(displayName);
    partyIconFilenames.push(c.iconFilename);

    partyPositions.push({
      row: (i + 1) as 1 | 2 | 3,
      col: colForSlot[i] ?? 1,
    });

    const derived = computeDerivedStats({
      STR: c.STR,
      INT: c.INT,
      VIT: c.VIT,
      WIS: c.WIS,
      DEX: c.DEX,
      AGI: c.AGI,
      LUK: c.LUK,
      CAP: c.CAP,
    });

    const override = currentHpMp[charId];
    partyHp.push(
      override != null ? Math.min(derived.HP, override.hp) : derived.HP
    );
    partyMp.push(
      override != null ? Math.min(derived.MP, override.mp) : derived.MP
    );
    partyMaxHp.push(derived.HP);
    partyMaxMp.push(derived.MP);
  }

  return {
    success: true,
    step: {
      kind: "skill_check",
      themeName: area.theme.name,
      areaName: area.name,
      eventMessage: "何かが起きた…。どう対処する？",
      partyDisplayNames,
      partyIconFilenames,
      partyPositions,
      partyHp,
      partyMp,
      partyMaxHp,
      partyMaxMp,
    },
  };
}

// --- 技能イベント判定・反映 ---

export type ResolveExplorationSkillEventResult =
  | { success: true; skillSuccess: boolean; logLine: string }
  | { success: false; error: string; message: string };

const SKILL_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;

/**
 * 技能イベントで選択したステータスで判定し、Expedition を更新する。
 * パーティ内でそのステが最高のキャラの基礎ステを使い、必要値以上なら確定成功、未満なら成功率＝stat/requiredValue でランダム判定。
 */
export async function resolveExplorationSkillEvent(
  stat: string
): Promise<ResolveExplorationSkillEventResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  if (!SKILL_STAT_KEYS.includes(stat as (typeof SKILL_STAT_KEYS)[number])) {
    return { success: false, error: "INVALID_STAT", message: "無効なステータスです。" };
  }

  const expedition = await prisma.expedition.findFirst({
    where: { userId: session.userId, state: "in_progress" },
    include: {
      area: {
        select: {
          name: true,
          skillCheckRequiredValue: true,
        },
      },
      partyPreset: {
        select: {
          slot1CharacterId: true,
          slot2CharacterId: true,
          slot3CharacterId: true,
        },
      },
    },
  });

  if (!expedition?.partyPreset?.slot1CharacterId) {
    return {
      success: false,
      error: "NO_EXPEDITION",
      message: "進行中の探索がありません。",
    };
  }

  const order = [
    expedition.partyPreset.slot1CharacterId,
    expedition.partyPreset.slot2CharacterId,
    expedition.partyPreset.slot3CharacterId,
  ].filter(Boolean) as string[];

  const characters = await prisma.character.findMany({
    where: { id: { in: order }, userId: session.userId },
    select: {
      id: true,
      STR: true,
      INT: true,
      VIT: true,
      WIS: true,
      DEX: true,
      AGI: true,
      LUK: true,
    },
  });

  const statKey = stat as (typeof SKILL_STAT_KEYS)[number];
  let bestValue = 0;
  for (const c of characters) {
    const v = c[statKey] ?? 0;
    if (v > bestValue) bestValue = v;
  }

  const required = expedition.area.skillCheckRequiredValue ?? 80;
  const isSuccess =
    bestValue >= required
      ? true
      : Math.random() < bestValue / required;

  const rounds = expedition.battleWinCount + expedition.skillSuccessCount;
  const roundIndex = rounds + 1;
  const logLine = isSuccess
    ? `R${roundIndex}: 技能判定（${stat}）成功。`
    : `R${roundIndex}: 技能判定（${stat}）失敗。`;

  const rawState = (expedition.explorationState ?? {}) as unknown as { logs?: unknown };
  const logs: string[] = Array.isArray(rawState.logs) && rawState.logs.every((x) => typeof x === "string")
    ? (rawState.logs as string[])
    : [];
  logs.push(logLine);

  await prisma.expedition.update({
    where: { id: expedition.id },
    data: {
      skillSuccessCount: expedition.skillSuccessCount + (isSuccess ? 1 : 0),
      explorationState: { ...rawState, logs },
    },
  });

  return { success: true, skillSuccess: isSuccess, logLine };
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
      result: RunBattleSuccess;
      battleType: ExplorationBattleType;
      /** 強敵勝利時に領域主が出現した場合 true（UI で「領域主へ挑む」表示に利用） */
      areaLordAppeared?: boolean;
      /** 戦闘後の Expedition.state（報酬確定 vs 領域主へ挑む の表示判定に利用） */
      stateAfter: "in_progress" | "ready_to_finish";
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
      areaId: true,
      remainingNormalBattles: true,
      strongEnemyCleared: true,
      battleWinCount: true,
      skillSuccessCount: true,
      currentHpMp: true,
      explorationState: true,
      area: {
        select: {
          name: true,
          areaLordAppearanceRate: true,
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

  const initialHpMpByCharacterId = (expedition.currentHpMp as Record<string, { hp: number; mp: number }> | null) ?? undefined;

  const battleType: ExplorationBattleType =
    expedition.remainingNormalBattles > 0
      ? "normal"
      : !expedition.strongEnemyCleared
        ? "strong_enemy"
        : "area_lord";
  const enemyInputs = await resolveEnemiesForExplorationBattle(expedition.areaId, battleType);
  const baseResult = await runBattle(
    expedition.partyPresetId,
    initialHpMpByCharacterId,
    enemyInputs.length > 0 ? enemyInputs : undefined
  );

  if (!baseResult.success) {
    return baseResult;
  }

  const result = baseResult as RunBattleSuccess;

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

  const rawState = (expedition.explorationState ?? {}) as unknown as {
    logs?: unknown;
    lastBattle?: unknown;
    areaLordAvailable?: boolean;
  };

  /** 戦闘ログは永続化しない（027 #18）。lastBattle はコピーしない */
  const { lastBattle: _dropped, ...stateWithoutLastBattle } = rawState;
  const baseState = stateWithoutLastBattle as { logs?: unknown; areaLordAvailable?: boolean };

  let shouldReadyToFinish: boolean;
  let nextExplorationState: typeof baseState & { areaLordAvailable?: boolean };
  let areaLordAppeared: boolean | undefined;

  if (!isPlayerWin) {
    shouldReadyToFinish = true;
    nextExplorationState = { ...baseState };
  } else if (battleType === "area_lord") {
    shouldReadyToFinish = true;
    nextExplorationState = { ...baseState };
  } else if (battleType === "strong_enemy") {
    const rate = Math.max(0, Math.min(100, expedition.area.areaLordAppearanceRate ?? 50)) / 100;
    areaLordAppeared = Math.random() < rate;
    if (areaLordAppeared) {
      shouldReadyToFinish = false;
      nextExplorationState = { ...baseState, areaLordAvailable: true };
    } else {
      shouldReadyToFinish = true;
      nextExplorationState = { ...baseState };
    }
  } else {
    // 通常戦闘：残り0でも強敵待ちのため in_progress のまま
    shouldReadyToFinish = false;
    nextExplorationState = baseState;
  }

  const nextState = shouldReadyToFinish ? ("ready_to_finish" as const) : ("in_progress" as const);
  const explorationState = nextExplorationState;

  const updateData: {
    currentHpMp: Record<string, { hp: number; mp: number }>;
    remainingNormalBattles: number;
    battleWinCount: number;
    state: string;
    explorationState: Prisma.InputJsonValue;
    strongEnemyCleared?: boolean;
    areaLordCleared?: boolean;
  } = {
    currentHpMp: hpMpByCharId,
    remainingNormalBattles: nextRemaining,
    battleWinCount: expedition.battleWinCount + (isPlayerWin ? 1 : 0),
    state: nextState,
    explorationState: explorationState as Prisma.InputJsonValue,
  };
  if (battleType === "strong_enemy" && isPlayerWin) updateData.strongEnemyCleared = true;
  if (battleType === "area_lord" && isPlayerWin) updateData.areaLordCleared = true;

  await prisma.expedition.update({
    where: { id: expedition.id },
    data: updateData,
  });

  if (isPlayerWin && result.defeatedEnemyIds && result.defeatedEnemyIds.length > 0) {
    const { addQuestProgressEnemyDefeat } = await import("@/server/actions/quest");
    await addQuestProgressEnemyDefeat(session.userId!, result.defeatedEnemyIds);
  }

  return {
    success: true,
    themeName: expedition.area.theme.name,
    areaName: expedition.area.name,
    remainingNormalBattlesBefore: expedition.remainingNormalBattles,
    result,
    battleType,
    areaLordAppeared,
    stateAfter: nextState,
  };
}

// --- ラウンド後の消耗品使用用：持ち込み消耗品一覧とパーティメンバー ---

export type CarriedConsumableChoice = {
  itemId: string;
  quantity: number;
  itemName: string;
  effectType: "hp_percent" | "mp_percent";
  effectValue: number;
};

export type ExplorationPartyMemberChoice = {
  characterId: string;
  displayName: string;
};

export type GetExplorationRoundConsumablesAndPartyResult =
  | {
      success: true;
      consumables: CarriedConsumableChoice[];
      partyMembers: ExplorationPartyMemberChoice[];
    }
  | { success: false; error: string; message: string };

/**
 * 進行中探索の「持ち込み消耗品」（残数>0）とパーティメンバー（対象選択用）を返す。
 * ラウンド後に「消耗品を使う」UI で利用する。
 */
export async function getExplorationRoundConsumablesAndParty(): Promise<GetExplorationRoundConsumablesAndPartyResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const expedition = await prisma.expedition.findFirst({
    where: { userId: session.userId, state: "in_progress" },
    include: {
      partyPreset: {
        select: {
          slot1CharacterId: true,
          slot2CharacterId: true,
          slot3CharacterId: true,
        },
      },
    },
  });

  if (!expedition?.partyPreset?.slot1CharacterId) {
    return {
      success: false,
      error: "NO_EXPEDITION",
      message: "進行中の探索がありません。",
    };
  }

  const rawState = (expedition.explorationState ?? {}) as unknown as {
    consumables?: Array<{ itemId: string; quantity: number }>;
  };
  const carried = (rawState.consumables ?? []).filter((c) => c.quantity > 0);
  if (carried.length === 0) {
    return {
      success: true,
      consumables: [],
      partyMembers: await getPartyMembersForExpedition(session.userId, expedition.partyPreset),
    };
  }

  const itemIds = [...new Set(carried.map((c) => c.itemId))];
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds }, category: "consumable" },
    select: { id: true, name: true, consumableEffect: true },
  });

  const effect = (row: { consumableEffect: unknown }) => {
    const o = row.consumableEffect as { type?: string; value?: number } | null;
    if (!o || typeof o.type !== "string" || typeof o.value !== "number") return null;
    if (o.type === "hp_percent" || o.type === "mp_percent") {
      return { effectType: o.type as "hp_percent" | "mp_percent", effectValue: o.value };
    }
    return null;
  };

  const consumables: CarriedConsumableChoice[] = [];
  for (const c of carried) {
    const item = items.find((i) => i.id === c.itemId);
    const e = item ? effect(item) : null;
    if (item && e) {
      consumables.push({
        itemId: c.itemId,
        quantity: c.quantity,
        itemName: item.name,
        effectType: e.effectType,
        effectValue: e.effectValue,
      });
    }
  }

  const partyMembers = await getPartyMembersForExpedition(session.userId, expedition.partyPreset);

  return { success: true, consumables, partyMembers };
}

async function getPartyMembersForExpedition(
  userId: string,
  preset: { slot1CharacterId: string | null; slot2CharacterId: string | null; slot3CharacterId: string | null }
): Promise<ExplorationPartyMemberChoice[]> {
  const order = [preset.slot1CharacterId, preset.slot2CharacterId, preset.slot3CharacterId].filter(
    Boolean
  ) as string[];
  if (order.length === 0) return [];

  const user = await userRepository.findById(userId);
  const characters = await prisma.character.findMany({
    where: { id: { in: order }, userId },
    select: { id: true, category: true, displayName: true },
  });

  return order.map((charId) => {
    const c = characters.find((x) => x.id === charId);
    const displayName =
      c?.category === "protagonist" && user?.name ? user.name : (c?.displayName ?? "不明");
    return { characterId: charId, displayName: displayName ?? "不明" };
  });
}

// --- 探索中に消耗品を使用する ---

export type ApplyExplorationConsumableResult =
  | { success: true; effectType: "hp_percent" | "mp_percent"; recoveredAmount: number }
  | { success: false; error: string; message: string };

/**
 * 進行中探索で持ち込み消耗品を1つ使用し、指定キャラに効果を適用する。
 * 効果は Item.consumableEffect に従う（hp_percent / mp_percent）。currentHpMp を更新し、持ち込み数を1減らす。
 */
export async function applyExplorationConsumable(
  itemId: string,
  targetCharacterId: string
): Promise<ApplyExplorationConsumableResult> {
  const session = await getSession();
  if (!session.userId) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください。" };
  }

  const expedition = await prisma.expedition.findFirst({
    where: { userId: session.userId, state: "in_progress" },
    include: {
      partyPreset: {
        select: {
          slot1CharacterId: true,
          slot2CharacterId: true,
          slot3CharacterId: true,
        },
      },
    },
  });

  if (!expedition?.partyPreset?.slot1CharacterId) {
    return { success: false, error: "NO_EXPEDITION", message: "進行中の探索がありません。" };
  }

  const order = [
    expedition.partyPreset.slot1CharacterId,
    expedition.partyPreset.slot2CharacterId,
    expedition.partyPreset.slot3CharacterId,
  ].filter(Boolean) as string[];
  if (!order.includes(targetCharacterId)) {
    return { success: false, error: "INVALID_TARGET", message: "対象キャラがパーティに含まれていません。" };
  }

  const rawState = (expedition.explorationState ?? {}) as unknown as {
    consumables?: Array<{ itemId: string; quantity: number }>;
    logs?: unknown;
  };
  const consumables = (rawState.consumables ?? []).slice();
  const idx = consumables.findIndex((c) => c.itemId === itemId && c.quantity > 0);
  if (idx < 0) {
    return { success: false, error: "NO_CONSUMABLE", message: "その消耗品は持っていません。" };
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId, category: "consumable" },
    select: { consumableEffect: true },
  });
  if (!item?.consumableEffect) {
    return { success: false, error: "INVALID_ITEM", message: "無効な消耗品です。" };
  }

  const eff = item.consumableEffect as { type?: string; value?: number };
  const effectType = eff.type === "hp_percent" || eff.type === "mp_percent" ? eff.type : null;
  const effectValue = typeof eff.value === "number" ? eff.value : 0;
  if (!effectType) {
    return { success: false, error: "INVALID_ITEM", message: "この消耗品の効果は未対応です。" };
  }

  const characters = await prisma.character.findMany({
    where: { id: { in: order }, userId: session.userId },
    select: { id: true, STR: true, INT: true, VIT: true, WIS: true, DEX: true, AGI: true, LUK: true, CAP: true },
  });
  const targetChar = characters.find((c) => c.id === targetCharacterId);
  if (!targetChar) {
    return { success: false, error: "INVALID_TARGET", message: "対象キャラが見つかりません。" };
  }

  const derived = computeDerivedStats({
    STR: targetChar.STR,
    INT: targetChar.INT,
    VIT: targetChar.VIT,
    WIS: targetChar.WIS,
    DEX: targetChar.DEX,
    AGI: targetChar.AGI,
    LUK: targetChar.LUK,
    CAP: targetChar.CAP,
  });

  const currentHpMp = (expedition.currentHpMp ?? {}) as Record<string, { hp: number; mp: number }>;
  const cur = currentHpMp[targetCharacterId] ?? { hp: derived.HP, mp: derived.MP };
  // HP0 以下は戦闘不能扱いとし、回復アイテムは使用不可（蘇生系は将来別扱い）
  if (cur.hp <= 0) {
    return {
      success: false,
      error: "TARGET_DEAD",
      message: "戦闘不能のキャラクターには使用できません。",
    };
  }
  let newHp = cur.hp;
  let newMp = cur.mp;
  if (effectType === "hp_percent") {
    const add = Math.floor((derived.HP * effectValue) / 100);
    newHp = Math.min(derived.HP, cur.hp + add);
  } else {
    const add = Math.floor((derived.MP * effectValue) / 100);
    newMp = Math.min(derived.MP, cur.mp + add);
  }

  const nextHpMp = { ...currentHpMp, [targetCharacterId]: { hp: newHp, mp: newMp } };

  consumables[idx]!.quantity -= 1;
  const nextConsumables = consumables.filter((c) => c.quantity > 0);

  // Expedition 側の持ち込み残数を更新（倉庫在庫は探索開始時に減算済み）
  await prisma.expedition.update({
    where: { id: expedition.id },
    data: {
      currentHpMp: nextHpMp,
      explorationState: {
        ...rawState,
        consumables: nextConsumables.length > 0 ? nextConsumables : [],
      } as Prisma.InputJsonValue,
    },
  });

  const recoveredAmount =
    effectType === "hp_percent" ? Math.max(0, newHp - cur.hp) : Math.max(0, newMp - cur.mp);

  return { success: true, effectType, recoveredAmount };
}

// --- 探索終了（報酬確定） ---

export type FinishExplorationDropSlotOrigin =
  | "base"
  | "battle"
  | "skill"
  | "strong_enemy"
  | "area_lord_special";

export type FinishExplorationDroppedItem = {
  itemName: string;
  quantity: number;
};

export type FinishExplorationDropSlot = {
  origin: FinishExplorationDropSlotOrigin;
  label: string;
  items: FinishExplorationDroppedItem[];
};

/** 重み付きドロップテーブルから1回ロールし、当選したアイテムと数量を返す。エントリが無い場合は null */
function rollOneFromDropTable(entries: Array<{
  itemId: string;
  minQuantity: number;
  maxQuantity: number;
  weight: number;
  item: { name: string };
}>): { itemId: string; itemName: string; quantity: number } | null {
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  if (totalWeight <= 0) return null;
  let r = Math.random() * totalWeight;
  for (const e of entries) {
    r -= e.weight;
    if (r < 0) {
      const q = e.minQuantity >= e.maxQuantity
        ? e.minQuantity
        : e.minQuantity + Math.floor(Math.random() * (e.maxQuantity - e.minQuantity + 1));
      return { itemId: e.itemId, itemName: e.item.name, quantity: q };
    }
  }
  const last = entries[entries.length - 1];
  const q = last.minQuantity >= last.maxQuantity
    ? last.minQuantity
    : last.minQuantity + Math.floor(Math.random() * (last.maxQuantity - last.minQuantity + 1));
  return { itemId: last.itemId, itemName: last.item.name, quantity: q };
}

export type FinishExplorationSummary = {
  themeName: string;
  areaName: string;
  result: "cleared" | "wiped";
  battleWins: number;
  skillSuccessCount: number;
  totalExpGained: number;
  dropSlots: FinishExplorationDropSlot[];
  /** docs/054: この探索終了で達成したクエスト ID（クリア報告メッセージ表示用） */
  completedQuestIds: string[];
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
      partyPreset: {
        select: { slot1CharacterId: true, slot2CharacterId: true, slot3CharacterId: true },
      },
      area: {
        select: {
          id: true,
          name: true,
          baseDropMin: true,
          baseDropMax: true,
          theme: { select: { name: true } },
          baseDropTableId: true,
          battleDropTableId: true,
          skillDropTableId: true,
          strongEnemyDropTableId: true,
          areaLordDropTableId: true,
          baseDropTable: {
            select: {
              entries: {
                include: { item: { select: { id: true, name: true } } },
              },
            },
          },
          battleDropTable: {
            select: {
              entries: {
                include: { item: { select: { id: true, name: true } } },
              },
            },
          },
          skillDropTable: {
            select: {
              entries: {
                include: { item: { select: { id: true, name: true } } },
              },
            },
          },
          strongEnemyDropTable: {
            select: {
              entries: {
                include: { item: { select: { id: true, name: true } } },
              },
            },
          },
          areaLordDropTable: {
            select: {
              entries: {
                include: { item: { select: { id: true, name: true } } },
              },
            },
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
  // - Exp は雑魚勝利×1 / 強敵+2 / 領域主+5 の合計
  const expFromBattles = expedition.battleWinCount;
  const expFromStrongEnemy = expedition.strongEnemyCleared ? 2 : 0;
  const expFromAreaLord = expedition.areaLordCleared ? 5 : 0;
  const totalExpGained = expFromBattles + expFromStrongEnemy + expFromAreaLord;

  // ドロップ枠の内訳：枠ごとにドロップテーブルをロールし、在庫に加算する
  const baseSlots = expedition.area.baseDropMin;
  const battleSlots = expedition.battleWinCount;
  const skillSlots = expedition.skillSuccessCount;
  const strongEnemySlots = expedition.strongEnemyCleared ? 2 : 0;
  const areaLordSlots = expedition.areaLordCleared ? 1 : 0;

  const area = expedition.area as {
    baseDropTable: { entries: Array<{ itemId: string; minQuantity: number; maxQuantity: number; weight: number; item: { name: string } }> } | null;
    battleDropTable: { entries: Array<{ itemId: string; minQuantity: number; maxQuantity: number; weight: number; item: { name: string } }> } | null;
    skillDropTable: { entries: Array<{ itemId: string; minQuantity: number; maxQuantity: number; weight: number; item: { name: string } }> } | null;
    strongEnemyDropTable: { entries: Array<{ itemId: string; minQuantity: number; maxQuantity: number; weight: number; item: { name: string } }> } | null;
    areaLordDropTable: { entries: Array<{ itemId: string; minQuantity: number; maxQuantity: number; weight: number; item: { name: string } }> } | null;
  };

  const getEntries = (origin: FinishExplorationDropSlotOrigin) => {
    switch (origin) {
      case "base": return area.baseDropTable?.entries ?? [];
      case "battle": return area.battleDropTable?.entries ?? [];
      case "skill": return area.skillDropTable?.entries ?? [];
      case "strong_enemy": return area.strongEnemyDropTable?.entries ?? [];
      case "area_lord_special": return area.areaLordDropTable?.entries ?? [];
    }
  };

  const dropSlots: FinishExplorationDropSlot[] = [];
  const inventoryDelta = new Map<string, number>();

  const slotConfigs: { origin: FinishExplorationDropSlotOrigin; label: string }[] = [];
  for (let i = 0; i < baseSlots; i += 1) slotConfigs.push({ origin: "base", label: `基本ドロップ枠 ${i + 1}` });
  for (let i = 0; i < battleSlots; i += 1) slotConfigs.push({ origin: "battle", label: `戦闘ボーナス枠 ${i + 1}` });
  for (let i = 0; i < skillSlots; i += 1) slotConfigs.push({ origin: "skill", label: `技能イベント枠 ${i + 1}` });
  for (let i = 0; i < strongEnemySlots; i += 1) slotConfigs.push({ origin: "strong_enemy", label: `強敵ボーナス枠 ${i + 1}` });
  for (let i = 0; i < areaLordSlots; i += 1) slotConfigs.push({ origin: "area_lord_special", label: `領域主専用枠 ${i + 1}` });

  for (const { origin, label } of slotConfigs) {
    const entries = getEntries(origin);
    const rolled = rollOneFromDropTable(entries);
    const items: FinishExplorationDroppedItem[] = [];
    if (rolled) {
      items.push({ itemName: rolled.itemName, quantity: rolled.quantity });
      inventoryDelta.set(rolled.itemId, (inventoryDelta.get(rolled.itemId) ?? 0) + rolled.quantity);
    }
    dropSlots.push({ origin, label, items });
  }

  const participantIds = [
    expedition.partyPreset?.slot1CharacterId,
    expedition.partyPreset?.slot2CharacterId,
    expedition.partyPreset?.slot3CharacterId,
  ].filter(Boolean) as string[];

  const { grantCharacterExp } = await import("@/server/actions/character-exp");

  await prisma.$transaction(async (tx) => {
    for (const [itemId, amount] of inventoryDelta) {
      await tx.userInventory.upsert({
        where: { userId_itemId: { userId: session.userId!, itemId } },
        create: { userId: session.userId!, itemId, quantity: amount },
        update: { quantity: { increment: amount } },
      });
    }
    await tx.expedition.update({
      where: { id: expedition.id },
      data: { state: "finished", totalExpGained },
    });
    if (participantIds.length > 0 && totalExpGained > 0) {
      await grantCharacterExp(session.userId!, participantIds, totalExpGained, tx);
    }
  });

  const { addQuestProgressAreaClear } = await import("@/server/actions/quest");
  const { completedQuestIds: areaClearCompleted } = await addQuestProgressAreaClear(
    session.userId!,
    expedition.area.id
  );

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
      completedQuestIds: areaClearCompleted,
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


