"use server";

// spec/020_test_battle.md - 仮戦闘実行 API

import { getSession } from "@/lib/auth/session";
import { characterRepository } from "@/server/repositories/character-repository";
import type { BaseStats } from "@/lib/battle/derived-stats";
import { runTestBattleLoop } from "@/lib/battle/run-test-battle";
import { TEST_ENEMY_BASE_STATS, TEST_ENEMY_POSITIONS_1V3 } from "@/lib/battle/test-enemy";
import type { BattlePosition } from "@/lib/battle/battle-position";
import { DEFAULT_PROTAGONIST_POSITION } from "@/lib/battle/battle-position";

export type RunTestBattleSuccess = {
  success: true;
  result: "player" | "enemy" | "draw";
  protagonistPosition: BattlePosition;
  /** 主人公のアイコン（Character.iconFilename）。未設定時は null */
  protagonistIconFilename: string | null;
  /** 敵3体の位置（敵グリッド） */
  enemyPositions: BattlePosition[];
  log: Array<{
    cycle: number;
    turn: number;
    attacker: "player" | "enemy";
    attackerEnemyIndex?: number;
    target: "player" | "enemy";
    targetEnemyIndex?: number;
    hit: boolean;
    direct: boolean;
    fatal: boolean;
    damage: number;
    targetHpAfter: number;
    mpRecovery: number;
    playerHpAfter: number;
    playerMpAfter: number;
    enemyHpAfter: number[];
    enemyMpAfter: number[];
  }>;
  summary: {
    totalCycles: number;
    winner: "player" | "enemy" | "draw";
    playerHpFinal: number;
    enemyHpFinals: number[];
    playerMaxHp: number;
    playerMaxMp: number;
    enemyMaxHp: number;
    enemyMaxMp: number;
  };
};

export type RunTestBattleError = {
  success: false;
  error: string;
  message: string;
};

export type RunTestBattleResult = RunTestBattleSuccess | RunTestBattleError;

export async function runTestBattle(): Promise<RunTestBattleResult> {
  const session = await getSession();
  if (!session.userId || !session.isLoggedIn) {
    return { success: false, error: "UNAUTHORIZED", message: "ログインしてください" };
  }

  const protagonist = await characterRepository.getProtagonistByUserId(session.userId);
  if (!protagonist) {
    return { success: false, error: "NO_PROTAGONIST", message: "主人公が作成されていません" };
  }

  const playerBase: BaseStats = {
    STR: protagonist.STR,
    INT: protagonist.INT,
    DEX: protagonist.DEX,
    VIT: protagonist.VIT,
    SPD: protagonist.SPD,
    LUK: protagonist.LUK,
    CAP: protagonist.CAP,
  };

  const battle = runTestBattleLoop(playerBase, TEST_ENEMY_BASE_STATS, TEST_ENEMY_POSITIONS_1V3);

  return {
    success: true,
    result: battle.result,
    protagonistPosition: DEFAULT_PROTAGONIST_POSITION,
    protagonistIconFilename: protagonist.iconFilename ?? null,
    enemyPositions: battle.enemyPositions,
    log: battle.log,
    summary: battle.summary,
  };
}
