/**
 * spec/020_test_battle.md - 1v3 仮戦闘ループ
 * 通常攻撃のみ。行動順・ターゲット抽選（列ウェイト）・命中・直撃/致命・ダメージ・疲労・MP回復
 */

import type { BaseStats } from "./derived-stats";
import { computeDerivedStats, luckPoint } from "./derived-stats";
import type { BattlePosition } from "./battle-position";
import { getColumnWeight } from "./battle-position";
import {
  BATTLE_ALPHA,
  BATTLE_BETA,
  BATTLE_D,
  BATTLE_MAX_CYCLES,
  BATTLE_FATIGUE_CYCLES_SAFE,
  BATTLE_FATIGUE_RATE,
  BATTLE_MP_RECOVERY_MIN,
  BATTLE_MP_RECOVERY_MAX,
  BATTLE_MP_RECOVERY_PCT,
  BATTLE_DAMAGE_RAND_DEF_MIN,
  BATTLE_DAMAGE_RAND_DEF_MAX,
  BATTLE_DIRECT_MULT,
  BATTLE_FATAL_MULT,
  BATTLE_MITIGATION_DENOM,
} from "./battle-constants";

export type BattleSide = "player" | "enemy";

/** 攻撃者または対象を特定（敵は index 0～2） */
export type AttackerKind = "player" | { enemyIndex: number };
export type TargetKind = "player" | { enemyIndex: number };

export interface BattleLogEntry {
  cycle: number;
  turn: number;
  attacker: BattleSide;
  attackerEnemyIndex?: number;
  target: BattleSide;
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
}

export interface BattleSummary {
  totalCycles: number;
  winner: "player" | "enemy" | "draw";
  playerHpFinal: number;
  enemyHpFinals: number[];
  playerMaxHp: number;
  playerMaxMp: number;
  enemyMaxHp: number;
  enemyMaxMp: number;
}

export interface BattleResult {
  result: "player" | "enemy" | "draw";
  log: BattleLogEntry[];
  summary: BattleSummary;
  enemyPositions: BattlePosition[];
}

interface FighterState {
  base: BaseStats;
  derived: ReturnType<typeof computeDerivedStats>;
  currentHp: number;
  currentMp: number;
}

const ENEMY_COUNT = 3;

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function turnWeight(derived: { EVA: number }, base: BaseStats): number {
  return Math.sqrt(derived.EVA) * (1 + BATTLE_ALPHA * (base.LUK / 7));
}

/** 生存者から重み付きで行動順を1人ずつ抽選（確定した者は除外） */
function buildTurnOrder(
  player: FighterState,
  enemies: FighterState[],
  alive: boolean[]
): ("player" | number)[] {
  const order: ("player" | number)[] = [];
  const pool: ("player" | number)[] = ["player"];
  for (let i = 0; i < ENEMY_COUNT; i++) if (alive[i]) pool.push(i);

  const getWeight = (idx: "player" | number): number => {
    if (idx === "player") return turnWeight(player.derived, player.base);
    return turnWeight(enemies[idx].derived, enemies[idx].base);
  };

  while (pool.length > 0) {
    const total = pool.reduce<number>((s, p) => s + getWeight(p), 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      const w = getWeight(pool[i]);
      if (r < w) {
        order.push(pool[i]);
        pool.splice(i, 1);
        break;
      }
      r -= w;
    }
  }
  return order;
}

/** 生存している敵から列ウェイトでターゲットを1体抽選 */
function pickEnemyTarget(enemies: FighterState[], positions: BattlePosition[], alive: boolean[]): number {
  let totalWeight = 0;
  const weights: number[] = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    if (!alive[i]) {
      weights.push(0);
      continue;
    }
    const w = getColumnWeight(positions[i].col);
    weights.push(w);
    totalWeight += w;
  }
  if (totalWeight <= 0) return 0;
  let r = Math.random() * totalWeight;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    if (!alive[i]) continue;
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return 0;
}

function rollHit(attackerHit: number, defenderEva: number): boolean {
  const denom = attackerHit + defenderEva * BATTLE_BETA;
  if (denom <= 0) return true;
  return Math.random() < attackerHit / denom;
}

function kParam(cap: number): number {
  return cap * 0.3 * 12;
}

function pDirect(attacker: FighterState, defender: FighterState): number {
  const delta = luckPoint(attacker.base) - luckPoint(defender.base);
  const k = kParam(attacker.base.CAP);
  return clamp(0.25 + BATTLE_D * (delta / (Math.abs(delta) + k)), 0, 0.95);
}

function pFatalGivenDirect(pDirectVal: number): number {
  return clamp(0.25 + (pDirectVal - 0.25) / 3, 0, 0.5);
}

function resolveNormalAttack(
  attacker: FighterState,
  defender: FighterState,
  player: FighterState,
  enemies: FighterState[],
  cycle: number,
  turn: number,
  fatigue: number
): Omit<BattleLogEntry, "attacker" | "attackerEnemyIndex" | "target" | "targetEnemyIndex" | "playerHpAfter" | "playerMpAfter" | "enemyHpAfter" | "enemyMpAfter"> {
  const hit = rollHit(attacker.derived.HIT, defender.derived.EVA);
  let direct = false;
  let fatal = false;
  let damage = 0;
  let defEffective = defender.derived.PDEF;

  if (hit) {
    const pDir = pDirect(attacker, defender);
    direct = Math.random() < pDir;
    if (direct) {
      fatal = Math.random() < pFatalGivenDirect(pDir);
      if (fatal) defEffective *= 0.5;
    }
    const randDef = randomFloat(BATTLE_DAMAGE_RAND_DEF_MIN, BATTLE_DAMAGE_RAND_DEF_MAX);
    defEffective *= randDef;
    const mitigation = BATTLE_MITIGATION_DENOM / (BATTLE_MITIGATION_DENOM + defEffective);
    let dmg = attacker.derived.PATK * 1.0 * mitigation * fatigue;
    if (direct) dmg *= BATTLE_DIRECT_MULT;
    if (fatal) dmg *= BATTLE_FATAL_MULT;
    damage = Math.max(0, Math.floor(dmg));
  }

  const targetHpAfter = Math.max(0, defender.currentHp - damage);
  defender.currentHp = targetHpAfter;

  const mpRecovery = Math.floor(attacker.derived.MP * BATTLE_MP_RECOVERY_PCT) + randomInt(BATTLE_MP_RECOVERY_MIN, BATTLE_MP_RECOVERY_MAX);
  attacker.currentMp = Math.min(attacker.derived.MP, attacker.currentMp + mpRecovery);

  return {
    cycle,
    turn,
    hit,
    direct,
    fatal,
    damage,
    targetHpAfter,
    mpRecovery,
  };
}

function fatigueForCycle(cycle: number): number {
  if (cycle <= BATTLE_FATIGUE_CYCLES_SAFE) return 1.0;
  return 1 + BATTLE_FATIGUE_RATE * (cycle - BATTLE_FATIGUE_CYCLES_SAFE);
}

function snapshotHpMp(player: FighterState, enemies: FighterState[]): { playerHp: number; playerMp: number; enemyHp: number[]; enemyMp: number[] } {
  return {
    playerHp: player.currentHp,
    playerMp: player.currentMp,
    enemyHp: enemies.map((e) => e.currentHp),
    enemyMp: enemies.map((e) => e.currentMp),
  };
}

/**
 * 1v3 仮戦闘。主人公 vs スライム3体。ターゲットは列ウェイトで抽選。
 */
export function runTestBattleLoop(
  playerBase: BaseStats,
  enemyBase: BaseStats,
  enemyPositions: BattlePosition[]
): BattleResult {
  const player: FighterState = {
    base: playerBase,
    derived: computeDerivedStats(playerBase),
    currentHp: 0,
    currentMp: 0,
  };
  player.currentHp = player.derived.HP;
  player.currentMp = player.derived.MP;

  const enemies: FighterState[] = enemyPositions.map(() => {
    const derived = computeDerivedStats(enemyBase);
    return {
      base: enemyBase,
      derived,
      currentHp: derived.HP,
      currentMp: derived.MP,
    };
  });

  const alive = [true, true, true];
  const log: BattleLogEntry[] = [];
  let totalCycles = 0;
  let winner: "player" | "enemy" | "draw" = "draw";
  let turnIndex = 0;

  for (let cycle = 1; cycle <= BATTLE_MAX_CYCLES; cycle++) {
    totalCycles = cycle;
    const fatigue = fatigueForCycle(cycle);

    if (player.currentHp <= 0) {
      winner = "enemy";
      break;
    }
    if (alive.every((_, i) => !alive[i])) {
      winner = "player";
      break;
    }

    const order = buildTurnOrder(player, enemies, alive);
    turnIndex = 0;

    for (const who of order) {
      turnIndex++;
      if (who === "player") {
        if (player.currentHp <= 0) continue;
        const targetIdx = pickEnemyTarget(enemies, enemyPositions, alive);
        if (!alive[targetIdx]) continue;

        const partial = resolveNormalAttack(player, enemies[targetIdx], player, enemies, cycle, turnIndex, fatigue);
        const snap = snapshotHpMp(player, enemies);
        log.push({
          ...partial,
          attacker: "player",
          target: "enemy",
          targetEnemyIndex: targetIdx,
          playerHpAfter: snap.playerHp,
          playerMpAfter: snap.playerMp,
          enemyHpAfter: snap.enemyHp,
          enemyMpAfter: snap.enemyMp,
        });
        if (enemies[targetIdx].currentHp <= 0) alive[targetIdx] = false;
      } else {
        const ei = who as number;
        if (!alive[ei] || enemies[ei].currentHp <= 0) continue;

        const partial = resolveNormalAttack(enemies[ei], player, player, enemies, cycle, turnIndex, fatigue);
        const snap = snapshotHpMp(player, enemies);
        log.push({
          ...partial,
          attacker: "enemy",
          attackerEnemyIndex: ei,
          target: "player",
          playerHpAfter: snap.playerHp,
          playerMpAfter: snap.playerMp,
          enemyHpAfter: snap.enemyHp,
          enemyMpAfter: snap.enemyMp,
        });
      }

      if (player.currentHp <= 0) {
        winner = "enemy";
        break;
      }
      if (alive.every((_, i) => !alive[i])) {
        winner = "player";
        break;
      }
    }

    if (player.currentHp <= 0 || alive.every((_, i) => !alive[i])) break;
  }

  if (player.currentHp > 0 && alive.some((a) => a)) winner = "draw";

  return {
    result: winner,
    log,
    summary: {
      totalCycles,
      winner,
      playerHpFinal: player.currentHp,
      enemyHpFinals: enemies.map((e) => e.currentHp),
      playerMaxHp: player.derived.HP,
      playerMaxMp: player.derived.MP,
      enemyMaxHp: enemies[0]?.derived.HP ?? 0,
      enemyMaxMp: enemies[0]?.derived.MP ?? 0,
    },
    enemyPositions,
  };
}
