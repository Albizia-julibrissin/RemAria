/**
 * パーティ（1～3人）＋作戦スロット＋スキル対応の戦闘ループ
 * docs/10_battle_calc_formulas.md（物理/魔法防御の別）、spec/038, 039 準拠
 */

import type { BaseStats } from "./derived-stats";
import { computeDerivedStats, luckPoint } from "./derived-stats";
import type { BattlePosition } from "./battle-position";
import { getColumnWeight } from "./battle-position";
import {
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
import {
  evaluateTactics as evaluateTacticsFromSpec,
  type TacticEvaluationContext,
  type TacticSlotForEval,
} from "./tactic-evaluation";

const ENEMY_COUNT = 3;

export interface TacticSlotInput {
  orderIndex: number;
  /** spec/040 主語。省略時は "self" */
  subject?: string;
  conditionKind: string;
  conditionParam: unknown;
  actionType: string;
  skillId: string | null;
}

export interface SkillDataForBattle {
  name: string;
  battleSkillType: string | null;
  powerMultiplier: number | null;
  mpCostCapCoef: number;
  mpCostFlat: number;
}

export interface PartyMemberInput {
  displayName: string;
  base: BaseStats;
  tacticSlots: TacticSlotInput[];
  skills: Record<string, SkillDataForBattle>;
}

interface FighterState {
  base: BaseStats;
  derived: ReturnType<typeof computeDerivedStats>;
  currentHp: number;
  currentMp: number;
}

interface PartyFighter extends FighterState {
  displayName: string;
  tacticSlots: TacticSlotInput[];
  skills: Record<string, SkillDataForBattle>;
}

export interface BattleLogEntryWithParty {
  cycle: number;
  turn: number;
  attacker: "player" | "enemy";
  attackerPartyIndex?: number;
  attackerEnemyIndex?: number;
  target: "player" | "enemy";
  targetEnemyIndex?: number;
  targetPartyIndex?: number;
  actionType?: "normal" | "skill";
  skillName?: string;
  fizzle?: boolean;
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
  partyHpAfter: number[];
  partyMpAfter: number[];
}

export interface BattleSummaryWithParty {
  totalCycles: number;
  winner: "player" | "enemy" | "draw";
  playerHpFinal: number;
  playerMpFinal: number;
  enemyHpFinals: number[];
  partyHpFinals: number[];
  partyMpFinals: number[];
  partyMaxHp: number[];
  partyMaxMp: number[];
  partyDisplayNames: string[];
  playerMaxHp: number;
  playerMaxMp: number;
  enemyMaxHp: number;
  enemyMaxMp: number;
}

export interface BattleResultWithParty {
  result: "player" | "enemy" | "draw";
  log: BattleLogEntryWithParty[];
  summary: BattleSummaryWithParty;
  enemyPositions: BattlePosition[];
}

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
  const BATTLE_ALPHA = 0.2;
  return Math.sqrt(derived.EVA) * (1 + BATTLE_ALPHA * (base.LUK / 7));
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

/** 物理なら PDEF、魔法なら MDEF で減衰。docs/10_battle_calc_formulas.md 6.4, 6.5 */
function resolveDamage(
  attacker: FighterState,
  defender: FighterState,
  attackType: "physical" | "magic",
  powerMult: number,
  fatigue: number
): { hit: boolean; direct: boolean; fatal: boolean; damage: number } {
  const hit = rollHit(attacker.derived.HIT, defender.derived.EVA);
  let direct = false;
  let fatal = false;
  let damage = 0;
  const defRaw = attackType === "physical" ? defender.derived.PDEF : defender.derived.MDEF;
  let defEffective = defRaw;

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
    const atk = attackType === "physical" ? attacker.derived.PATK : attacker.derived.MATK;
    let dmg = atk * powerMult * mitigation * fatigue;
    if (direct) dmg *= BATTLE_DIRECT_MULT;
    if (fatal) dmg *= BATTLE_FATAL_MULT;
    damage = Math.max(0, Math.floor(dmg));
  }

  return { hit, direct, fatal, damage };
}

function fatigueForCycle(cycle: number): number {
  if (cycle <= BATTLE_FATIGUE_CYCLES_SAFE) return 1.0;
  return 1 + BATTLE_FATIGUE_RATE * (cycle - BATTLE_FATIGUE_CYCLES_SAFE);
}

export function getMpCost(skill: SkillDataForBattle, cap: number): number {
  return Math.floor(cap * skill.mpCostCapCoef) + skill.mpCostFlat;
}

/** 作戦スロット入力を評価用スロットに変換（subject 省略時は "self"） */
function toSlotsForEval(slots: TacticSlotInput[]): TacticSlotForEval[] {
  return slots.map((s) => ({
    orderIndex: s.orderIndex,
    subject: s.subject ?? "self",
    conditionKind: s.conditionKind,
    conditionParam: s.conditionParam,
    actionType: s.actionType,
    skillId: s.skillId,
  }));
}

/** 味方デフォルト位置（パーティ i 番目 = row i+1, col 1） */
function defaultPartyPositions(count: number): BattlePosition[] {
  return Array.from({ length: count }, (_, i) => ({ row: i + 1, col: 1 }));
}

/** 生存している敵から列ウェイトでターゲットを1体抽選 */
function pickEnemyTarget(
  enemies: FighterState[],
  positions: BattlePosition[],
  alive: boolean[]
): number {
  let totalWeight = 0;
  const weights: number[] = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    if (!alive[i]) {
      weights.push(0);
      continue;
    }
    weights.push(getColumnWeight(positions[i].col));
    totalWeight += weights[i];
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

/** 敵が味方パーティの誰を狙うか（生存者から一様ランダム） */
function pickPartyTarget(partyAlive: boolean[]): number {
  const indices = partyAlive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
  if (indices.length === 0) return 0;
  return indices[Math.floor(Math.random() * indices.length)]!;
}

type TurnSlot = { kind: "p"; index: number } | { kind: "e"; index: number };

/** 行動順：パーティ1～3人＋敵3体を速度重みで抽選。誰が何番目かが分かる配列を返す。 */
function buildTurnOrder(
  party: PartyFighter[],
  enemies: FighterState[],
  partyAlive: boolean[],
  enemyAlive: boolean[]
): TurnSlot[] {
  const pool: TurnSlot[] = [];
  for (let i = 0; i < party.length; i++) if (partyAlive[i]) pool.push({ kind: "p", index: i });
  for (let i = 0; i < ENEMY_COUNT; i++) if (enemyAlive[i]) pool.push({ kind: "e", index: i });

  const getWeight = (s: TurnSlot): number => {
    if (s.kind === "p") return turnWeight(party[s.index].derived, party[s.index].base);
    return turnWeight(enemies[s.index].derived, enemies[s.index].base);
  };

  const order: TurnSlot[] = [];
  while (pool.length > 0) {
    const total = pool.reduce((sum, s) => sum + getWeight(s), 0);
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

function snapshotPartyHpMp(party: PartyFighter[]): { partyHp: number[]; partyMp: number[] } {
  return {
    partyHp: party.map((p) => p.currentHp),
    partyMp: party.map((p) => p.currentMp),
  };
}

/** 後方互換用：先頭1人分の HP/MP を player として返す */
function partyToLegacyPlayer(party: PartyFighter[]): { playerHp: number; playerMp: number } {
  const p = party[0];
  return {
    playerHp: p ? p.currentHp : 0,
    playerMp: p ? p.currentMp : 0,
  };
}

/**
 * パーティ（1～3人）＋作戦＋スキルで敵3体と戦闘。
 * 味方ターン：作戦スロットで行動決定（通常攻撃 or スキル）。MP不足なら不発。
 * 敵ターン：生存している味方1人をランダムに狙って通常攻撃（物理）。
 */
export function runBattleWithParty(
  partyInput: PartyMemberInput[],
  enemyBase: BaseStats,
  enemyPositions: BattlePosition[]
): BattleResultWithParty {
  if (partyInput.length === 0) {
    throw new Error("runBattleWithParty: party must have at least 1 member");
  }

  const party: PartyFighter[] = partyInput.map((p) => {
    const derived = computeDerivedStats(p.base);
    return {
      displayName: p.displayName,
      base: p.base,
      derived,
      currentHp: derived.HP,
      currentMp: derived.MP,
      tacticSlots: p.tacticSlots,
      skills: p.skills,
    };
  });

  const enemies: FighterState[] = enemyPositions.map(() => {
    const derived = computeDerivedStats(enemyBase);
    return {
      base: enemyBase,
      derived,
      currentHp: derived.HP,
      currentMp: derived.MP,
    };
  });

  const partyAlive = party.map(() => true);
  const enemyAlive = [true, true, true];
  const log: BattleLogEntryWithParty[] = [];
  let totalCycles = 0;
  let winner: "player" | "enemy" | "draw" = "draw";
  const partyPositions = defaultPartyPositions(party.length);

  for (let cycle = 1; cycle <= BATTLE_MAX_CYCLES; cycle++) {
    totalCycles = cycle;
    const fatigue = fatigueForCycle(cycle);

    if (partyAlive.every((_, i) => !partyAlive[i] || party[i].currentHp <= 0)) {
      winner = "enemy";
      break;
    }
    if (enemyAlive.every((a) => !a)) {
      winner = "player";
      break;
    }

    const order = buildTurnOrder(party, enemies, partyAlive, enemyAlive);
    let turnIndex = 0;

    for (const slot of order) {
      turnIndex++;
      if (slot.kind === "p") {
        const actorIndex = slot.index;
        if (actorIndex >= party.length || !partyAlive[actorIndex] || party[actorIndex].currentHp <= 0) continue;

        const actor = party[actorIndex];
        const tacticCtx: TacticEvaluationContext = {
          cycle,
          turnIndexInCycle: turnIndex,
          actorPartyIndex: actorIndex,
          party: party.map((p) => ({
            currentHp: p.currentHp,
            maxHp: p.derived.HP,
            currentMp: p.currentMp,
            maxMp: p.derived.MP,
            attrStates: [],
            debuffs: [],
          })),
          partyAlive: [...partyAlive],
          enemies: enemies.map((e) => ({
            currentHp: e.currentHp,
            maxHp: e.derived.HP,
            currentMp: e.currentMp,
            maxMp: e.derived.MP,
            attrStates: [],
            debuffs: [],
          })),
          enemyAlive: [...enemyAlive],
          partyPositions,
          enemyPositions,
        };
        const hasSkill = (skillId: string) => {
          const skill = actor.skills[skillId];
          return !!skill && actor.currentMp >= getMpCost(skill, actor.base.CAP);
        };
        const action = evaluateTacticsFromSpec(toSlotsForEval(actor.tacticSlots), tacticCtx, hasSkill);
        const targetIdx = pickEnemyTarget(enemies, enemyPositions, enemyAlive);
        if (!enemyAlive[targetIdx]) continue;

        const legacy = partyToLegacyPlayer(party);
        const snapParty = snapshotPartyHpMp(party);
        const enemyHp = enemies.map((e) => e.currentHp);
        const enemyMp = enemies.map((e) => e.currentMp);

        if (action.actionType === "skill" && action.skillId) {
          const skill = actor.skills[action.skillId];
          if (!skill) {
            const entry: BattleLogEntryWithParty = {
              cycle,
              turn: turnIndex,
              attacker: "player",
              attackerPartyIndex: actorIndex,
              target: "enemy",
              targetEnemyIndex: targetIdx,
              actionType: "skill",
              skillName: undefined,
              fizzle: false,
              hit: false,
              direct: false,
              fatal: false,
              damage: 0,
              targetHpAfter: enemies[targetIdx].currentHp,
              mpRecovery: 0,
              playerHpAfter: legacy.playerHp,
              playerMpAfter: legacy.playerMp,
              enemyHpAfter: enemyHp,
              enemyMpAfter: enemyMp,
              partyHpAfter: snapParty.partyHp,
              partyMpAfter: snapParty.partyMp,
            };
            log.push(entry);
            continue;
          }
          const cost = getMpCost(skill, actor.base.CAP);
          if (actor.currentMp < cost) {
            const entry: BattleLogEntryWithParty = {
              cycle,
              turn: turnIndex,
              attacker: "player",
              attackerPartyIndex: actorIndex,
              target: "enemy",
              targetEnemyIndex: targetIdx,
              actionType: "skill",
              skillName: skill.name,
              fizzle: true,
              hit: false,
              direct: false,
              fatal: false,
              damage: 0,
              targetHpAfter: enemies[targetIdx].currentHp,
              mpRecovery: 0,
              playerHpAfter: legacy.playerHp,
              playerMpAfter: legacy.playerMp,
              enemyHpAfter: enemyHp,
              enemyMpAfter: enemyMp,
              partyHpAfter: snapParty.partyHp,
              partyMpAfter: snapParty.partyMp,
            };
            log.push(entry);
            continue;
          }

          const attackType = skill.battleSkillType === "magic" ? "magic" : "physical";
          const powerMult = skill.powerMultiplier ?? 1.0;
          const result = resolveDamage(actor, enemies[targetIdx], attackType, powerMult, fatigue);
          enemies[targetIdx].currentHp = Math.max(0, enemies[targetIdx].currentHp - result.damage);
          actor.currentMp = Math.max(0, actor.currentMp - cost);

          const snapAfter = snapshotPartyHpMp(party);
          const enemyHpAfter = enemies.map((e) => e.currentHp);
          const enemyMpAfter = enemies.map((e) => e.currentMp);
          log.push({
            cycle,
            turn: turnIndex,
            attacker: "player",
            attackerPartyIndex: actorIndex,
            target: "enemy",
            targetEnemyIndex: targetIdx,
            actionType: "skill",
            skillName: skill.name,
            fizzle: false,
            hit: result.hit,
            direct: result.direct,
            fatal: result.fatal,
            damage: result.damage,
            targetHpAfter: enemies[targetIdx].currentHp,
            mpRecovery: 0,
            playerHpAfter: party[0]?.currentHp ?? 0,
            playerMpAfter: party[0]?.currentMp ?? 0,
            enemyHpAfter,
            enemyMpAfter,
            partyHpAfter: snapAfter.partyHp,
            partyMpAfter: snapAfter.partyMp,
          });
          if (enemies[targetIdx].currentHp <= 0) enemyAlive[targetIdx] = false;
        } else {
          const result = resolveDamage(actor, enemies[targetIdx], "physical", 1.0, fatigue);
          enemies[targetIdx].currentHp = Math.max(0, enemies[targetIdx].currentHp - result.damage);
          const mpRec = Math.floor(actor.derived.MP * BATTLE_MP_RECOVERY_PCT) + randomInt(BATTLE_MP_RECOVERY_MIN, BATTLE_MP_RECOVERY_MAX);
          actor.currentMp = Math.min(actor.derived.MP, actor.currentMp + mpRec);

          const snapAfter = snapshotPartyHpMp(party);
          log.push({
            cycle,
            turn: turnIndex,
            attacker: "player",
            attackerPartyIndex: actorIndex,
            target: "enemy",
            targetEnemyIndex: targetIdx,
            actionType: "normal",
            hit: result.hit,
            direct: result.direct,
            fatal: result.fatal,
            damage: result.damage,
            targetHpAfter: enemies[targetIdx].currentHp,
            mpRecovery: mpRec,
            playerHpAfter: party[0]?.currentHp ?? 0,
            playerMpAfter: party[0]?.currentMp ?? 0,
            enemyHpAfter: enemies.map((e) => e.currentHp),
            enemyMpAfter: enemies.map((e) => e.currentMp),
            partyHpAfter: snapAfter.partyHp,
            partyMpAfter: snapAfter.partyMp,
          });
          if (enemies[targetIdx].currentHp <= 0) enemyAlive[targetIdx] = false;
        }
      } else {
        const enemyIdx = slot.index;
        if (enemyIdx >= ENEMY_COUNT || !enemyAlive[enemyIdx] || enemies[enemyIdx].currentHp <= 0) continue;

        const targetPartyIdx = pickPartyTarget(partyAlive);
        if (!partyAlive[targetPartyIdx] || party[targetPartyIdx].currentHp <= 0) continue;

        const result = resolveDamage(enemies[enemyIdx], party[targetPartyIdx], "physical", 1.0, fatigue);
        party[targetPartyIdx].currentHp = Math.max(0, party[targetPartyIdx].currentHp - result.damage);

        const legacy = partyToLegacyPlayer(party);
        const snapParty = snapshotPartyHpMp(party);
        log.push({
          cycle,
          turn: turnIndex,
          attacker: "enemy",
          attackerEnemyIndex: enemyIdx,
          target: "player",
          targetPartyIndex: targetPartyIdx,
          hit: result.hit,
          direct: result.direct,
          fatal: result.fatal,
          damage: result.damage,
          targetHpAfter: party[targetPartyIdx].currentHp,
          mpRecovery: 0,
          playerHpAfter: legacy.playerHp,
          playerMpAfter: legacy.playerMp,
          enemyHpAfter: enemies.map((e) => e.currentHp),
          enemyMpAfter: enemies.map((e) => e.currentMp),
          partyHpAfter: snapParty.partyHp,
          partyMpAfter: snapParty.partyMp,
        });
        if (party[targetPartyIdx].currentHp <= 0) partyAlive[targetPartyIdx] = false;
      }

      if (party.every((p, i) => !partyAlive[i] || p.currentHp <= 0)) {
        winner = "enemy";
        break;
      }
      if (enemyAlive.every((a) => !a)) {
        winner = "player";
        break;
      }
    }

    if (party.every((p, i) => !partyAlive[i] || p.currentHp <= 0)) break;
    if (enemyAlive.every((a) => !a)) break;
  }

  if (party.some((p, i) => partyAlive[i] && p.currentHp > 0) && enemyAlive.some((a) => a)) winner = "draw";

  return {
    result: winner,
    log,
    summary: {
      totalCycles,
      winner,
      playerHpFinal: party[0]?.currentHp ?? 0,
      playerMpFinal: party[0]?.currentMp ?? 0,
      enemyHpFinals: enemies.map((e) => e.currentHp),
      partyHpFinals: party.map((p) => p.currentHp),
      partyMpFinals: party.map((p) => p.currentMp),
      partyMaxHp: party.map((p) => p.derived.HP),
      partyMaxMp: party.map((p) => p.derived.MP),
      partyDisplayNames: party.map((p) => p.displayName),
      playerMaxHp: party[0]?.derived.HP ?? 0,
      playerMaxMp: party[0]?.derived.MP ?? 0,
      enemyMaxHp: enemies[0]?.derived.HP ?? 0,
      enemyMaxMp: enemies[0]?.derived.MP ?? 0,
    },
    enemyPositions,
  };
}
