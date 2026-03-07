/**
 * spec/040_tactic_slot_evaluation.md - 作戦スロットの戦闘時評価（行動決定）
 */

import type { BattlePosition } from "./battle-position";

export interface TacticSlotForEval {
  orderIndex: number;
  subject: string;
  conditionKind: string;
  conditionParam: unknown;
  actionType: string;
  skillId: string | null;
}

/** 条件評価用のユニットスナップショット（主語で解決した「対象」1体分） */
export interface UnitSnapshot {
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  attrStates: string[];
  debuffs: string[];
}

/** spec/040 戦闘コンテキスト */
export interface TacticEvaluationContext {
  cycle: number;
  turnIndexInCycle: number;
  actorPartyIndex: number;
  party: UnitSnapshot[];
  partyAlive: boolean[];
  enemies: UnitSnapshot[];
  enemyAlive: boolean[];
  partyPositions: BattlePosition[];
  enemyPositions: BattlePosition[];
}

/** 採用する行動（ログ用に採用したスロットの orderIndex を返す） */
export interface TacticAction {
  actionType: "normal_attack" | "skill";
  skillId: string | null;
  /** 条件を満たしたスロットの orderIndex（1～10）。ログ表示用 */
  matchedOrderIndex?: number;
  /** 条件は満たしたが CT でスキップしたスロットの orderIndex 配列（ログ用「No.N Skip To CT」） */
  skippedDueToCt?: number[];
}

/** 主語を解決して対象のユニットスナップショットのリストを返す */
function resolveSubject(ctx: TacticEvaluationContext, subject: string): UnitSnapshot[] {
  const { actorPartyIndex, party, partyAlive, enemies, enemyAlive, partyPositions, enemyPositions } = ctx;

  switch (subject) {
    case "self": {
      if (actorPartyIndex < 0 || actorPartyIndex >= party.length || !partyAlive[actorPartyIndex]) return [];
      return [party[actorPartyIndex]!];
    }
    case "any_ally": {
      return party.filter((_, i) => partyAlive[i]).map((u) => u);
    }
    case "any_enemy": {
      return enemies.filter((_, i) => enemyAlive[i]).map((u) => u);
    }
    case "front_enemy": {
      const actorRow = partyPositions[actorPartyIndex]?.row;
      if (actorRow == null) return [];
      let best: UnitSnapshot | null = null;
      let bestCol = 4;
      for (let i = 0; i < enemies.length; i++) {
        if (!enemyAlive[i]) continue;
        const pos = enemyPositions[i];
        if (!pos || pos.row !== actorRow) continue;
        if (pos.col < bestCol) {
          bestCol = pos.col;
          best = enemies[i]!;
        }
      }
      return best ? [best] : [];
    }
    default:
      return [];
  }
}

/** サイクル条件を評価（主語 cycle または従来の主語なし） */
function evaluateCycleCondition(
  conditionKind: string,
  param: Record<string, unknown>,
  cycle: number
): boolean {
  if (conditionKind === "cycle_is_even") return cycle % 2 === 0;
  if (conditionKind === "cycle_is_odd") return cycle % 2 === 1;
  if (conditionKind === "cycle_is_multiple_of") {
    const n = Number(param["n"] ?? 1);
    return n !== 0 && cycle % n === 0;
  }
  if (conditionKind === "cycle_at_least") {
    const n = Number(param["n"] ?? 0);
    return cycle >= n;
  }
  if (conditionKind === "cycle_equals") {
    const n = Number(param["n"] ?? 1);
    return cycle === n;
  }
  return false;
}

/** ターン順条件を評価（主語 turn または従来の主語なし） */
function evaluateTurnCondition(
  conditionKind: string,
  param: Record<string, unknown>,
  turnIndexInCycle: number
): boolean {
  if (conditionKind !== "turn_order_in_range") return false;
  const min = Number(param["turnIndexMin"] ?? param["turnMin"] ?? 1);
  const max = Number(param["turnIndexMax"] ?? param["turnMax"] ?? 6);
  return turnIndexInCycle >= min && turnIndexInCycle <= max;
}

/** 条件を 1 つ評価（主語で得た対象のうち 1 体でも満たせば true） */
function evaluateCondition(slot: TacticSlotForEval, ctx: TacticEvaluationContext): boolean {
  const { conditionKind, conditionParam } = slot;
  const param = (conditionParam as Record<string, unknown>) ?? {};

  // 4.5 サイクル（主語 cycle のときはここで完結；主語なしでも従来どおりここで判定）
  if (slot.subject === "cycle") {
    return evaluateCycleCondition(conditionKind, param, ctx.cycle);
  }
  if (slot.subject === "turn") {
    return evaluateTurnCondition(conditionKind, param, ctx.turnIndexInCycle);
  }
  if (
    conditionKind === "cycle_is_even" ||
    conditionKind === "cycle_is_odd" ||
    conditionKind === "cycle_is_multiple_of" ||
    conditionKind === "cycle_at_least" ||
    conditionKind === "cycle_equals"
  ) {
    return evaluateCycleCondition(conditionKind, param, ctx.cycle);
  }
  if (conditionKind === "turn_order_in_range") {
    return evaluateTurnCondition(conditionKind, param, ctx.turnIndexInCycle);
  }

  // 4.4 自分が状態異常（主語は常に自分）
  if (conditionKind === "self_has_debuff") {
    const self = ctx.party[ctx.actorPartyIndex];
    return self != null && self.debuffs.length > 0;
  }

  // 4.1 常に成立
  if (conditionKind === "always") {
    return true;
  }

  // 主語を解決して対象リストを得る
  const targets = resolveSubject(ctx, slot.subject);
  if (targets.length === 0 && conditionKind !== "always") {
    return false;
  }

  // 4.2 HP・MP 閾値
  const percent = Number(param["percent"] ?? 50);
  const pct01 = percent / 100;

  if (conditionKind === "hp_below_percent") {
    return targets.some((u) => (u.maxHp <= 0 ? true : u.currentHp / u.maxHp <= pct01));
  }
  if (conditionKind === "hp_above_percent") {
    return targets.some((u) => (u.maxHp <= 0 ? false : u.currentHp / u.maxHp >= pct01));
  }
  if (conditionKind === "mp_below_percent") {
    return targets.some((u) => (u.maxMp <= 0 ? true : u.currentMp / u.maxMp <= pct01));
  }
  if (conditionKind === "mp_above_percent") {
    return targets.some((u) => (u.maxMp <= 0 ? false : u.currentMp / u.maxMp >= pct01));
  }

  // 4.3 主語が特定の属性状態
  if (conditionKind === "subject_has_attr_state") {
    const attr = String(param["attr"] ?? "none");
    return targets.some((u) => u.attrStates.includes(attr));
  }

  return false;
}

/**
 * 作戦スロットを orderIndex 昇順で評価し、最初に条件を満たしたスロットの行動を返す。
 * いずれも満たさない場合は通常攻撃。
 * docs/023: CT 中のスキルは採用せず次のスロットを評価する（isSkillOnCooldown が true ならスキップ）。
 */
export function evaluateTactics(
  slots: TacticSlotForEval[],
  ctx: TacticEvaluationContext,
  hasSkill: (skillId: string) => boolean,
  isSkillOnCooldown?: (skillId: string) => boolean
): TacticAction {
  const sorted = [...slots].sort((a, b) => a.orderIndex - b.orderIndex);
  const skippedDueToCt: number[] = [];
  for (const slot of sorted) {
    if (!evaluateCondition(slot, ctx)) continue;
    if (slot.actionType === "skill" && slot.skillId != null && hasSkill(slot.skillId)) {
      if (isSkillOnCooldown?.(slot.skillId)) {
        skippedDueToCt.push(slot.orderIndex);
        continue;
      }
      return {
        actionType: "skill",
        skillId: slot.skillId,
        matchedOrderIndex: slot.orderIndex,
        skippedDueToCt: skippedDueToCt.length > 0 ? skippedDueToCt : undefined,
      };
    }
    if (slot.actionType === "normal_attack") {
      return {
        actionType: "normal_attack",
        skillId: null,
        matchedOrderIndex: slot.orderIndex,
        skippedDueToCt: skippedDueToCt.length > 0 ? skippedDueToCt : undefined,
      };
    }
    // スキル指定だが MP 不足等で不発 → 次スロットには行かず通常攻撃（spec/040）
    return {
      actionType: "normal_attack",
      skillId: null,
      matchedOrderIndex: slot.orderIndex,
      skippedDueToCt: skippedDueToCt.length > 0 ? skippedDueToCt : undefined,
    };
  }
  return {
    actionType: "normal_attack",
    skillId: null,
    skippedDueToCt: skippedDueToCt.length > 0 ? skippedDueToCt : undefined,
  };
}
