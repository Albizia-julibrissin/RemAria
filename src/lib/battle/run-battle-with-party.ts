/**
 * パーティ（1～3人）＋作戦スロット＋スキル対応の戦闘ループ
 * docs/10_battle_calc_formulas.md（物理/魔法防御の別）、spec/038, 039 準拠
 */

import type { BaseStats } from "./derived-stats";
import { computeDerivedStats, luckPoint } from "./derived-stats";
import type { BattlePosition } from "./battle-position";
import type { BattleCol } from "./battle-position";
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

/** スキル使用時の列ウェイト加算（targetScope=enemy_single のとき使用） */
export interface SkillColumnWeightAdd {
  front: number;
  mid: number;
  back: number;
}

/** 戦闘に渡すスキル1件。docs/041 Phase0: 多ヒット・列ウェイト・効果用に拡張 */
export interface SkillDataForBattle {
  name: string;
  battleSkillType: string | null;
  powerMultiplier: number | null;
  mpCostCapCoef: number;
  mpCostFlat: number;
  /** 攻撃回数 min。省略時 1 */
  hitsMin?: number;
  /** 攻撃回数 max。省略時 1 */
  hitsMax?: number;
  /** ヒットごとにターゲット再抽選。省略時 false */
  resampleTargetPerHit?: boolean;
  /** enemy_single / enemy_all / ally_single / ally_all / self。省略時 enemy_single 扱い */
  targetScope?: string;
  /** 属性（none / crush / slash / pierce / burn / freeze / corrode / polarity）。効果適用は Phase 以降 */
  attribute?: string;
  /** 溜めサイクル。0=即時。Phase で発動予約対応 */
  chargeCycles?: number;
  /** クールタイム。0=なし。使用後 N サイクル再使用不可（docs/023 方式B） */
  cooldownCycles?: number;
  weightAddFront?: number;
  weightAddMid?: number;
  weightAddBack?: number;
  /** SkillEffect の配列。Phase で効果適用 */
  effects?: { effectType: string; param: Record<string, unknown> }[];
  logMessage?: string | null;
  logMessageOnCondition?: string | null;
}

/** Phase 10: 属性耐性。キー=属性コード(none/crush/slash/pierce/burn/freeze/corrode/polarity)、値=受けるダメージ倍率(1.0=通常, 0.8=20%軽減, 1.2=20%弱体)。未定義は1.0扱い。装備・遺物実装後に算出して渡す想定。 */
export type AttributeResistances = Record<string, number>;

export interface PartyMemberInput {
  displayName: string;
  base: BaseStats;
  tacticSlots: TacticSlotInput[];
  skills: Record<string, SkillDataForBattle>;
  /** Phase 10: 属性耐性。現状は未使用。装備・遺物実装後にここへ渡す。 */
  attributeResistances?: AttributeResistances;
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
  actionType?: "normal" | "skill" | "dot" | "charge";
  skillName?: string;
  /** Phase 8: DoT ログ用。継続ダメージの原因デバフコード（表示名変換用） */
  dotDebuffCode?: string;
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
  /** 採用した作戦スロットの優先順（1～10）。味方スキル/通常攻撃で採用時のみ */
  tacticSlotOrder?: number;
  /** 条件一致したが CT でスキップしたスロットの orderIndex 配列（ログ「No.N Skip To CT」用） */
  tacticSlotSkippedDueToCt?: number[];
  /** スキルの通常ログメッセージ。条件達成時は logMessageOnCondition を併記 */
  logMessage?: string | null;
  logMessageOnCondition?: string | null;
  /** スキル効果の条件達成時 true（起爆など） */
  conditionMet?: boolean;
  /** 条件達成時に消費した属性状態（ログの「〇〇決壊！」表示用） */
  triggeredAttr?: string;
  /** 多ヒット時のヒットごとの内容。1件でもあればログでヒットごと表示 */
  hitDetails?: {
    damage: number;
    hit: boolean;
    direct: boolean;
    fatal: boolean;
    targetEnemyIndex?: number;
    targetPartyIndex?: number;
    /** このヒットで付与した属性状態（ログ用。crush / burn 等） */
    attrApplied?: string;
    /** このヒットで敵各体に与えた追加ダメージ（column_splash / attr_state_trigger_splash）。ログで段落下げ表示用 */
    splashDamagePerEnemy?: number[];
    /** このヒットで起爆した属性（「〇〇決壊！」をこのヒット行だけに表示する用） */
    triggeredAttr?: string;
    /** このヒットで付与したデバフコード（「〇〇状態異常を付与」表示用） */
    debuffApplied?: string;
  }[];
  /** このターン終了時点の味方の陣地位置（ターンごとの表示用） */
  partyPositions?: BattlePosition[];
  /** このターン終了時点の敵の陣地位置（ターンごとの表示用） */
  enemyPositions?: BattlePosition[];
  /** Phase 6: 味方への回復量（ログで「〇〇のHPがX回復」表示用） */
  healAmount?: number;
  /** Phase 6: 全体回復のとき true（ログで「味方全体のHPがX回復」表示用） */
  isHealAll?: boolean;
  /** Phase 6: 回復効果を持つスキルで回復がなかったとき「回復対象がいなかった」表示用 */
  hadHealEffect?: boolean;
  /** Phase 6: 解除したデバフ（対象インデックスと解除したコード配列）。ログで「〇〇の〇〇状態を解除した」表示用 */
  dispelledDebuffs?: { targetPartyIndex: number; codes: string[] }[];
  /** Phase 7: バフ効果のみ発動した（ログで「0ダメージ」を出さない用） */
  hadBuffEffect?: boolean;
  /** 列指定攻撃で対象列に敵が1体もいなかったとき。ログで「対象範囲に敵がいなかった。」表示用 */
  noColumnTarget?: boolean;
  /** Phase 9: 溜めログ用。溜め開始時 true / 溜め中は chargeRemaining を表示 */
  isChargeStart?: boolean;
  chargeRemaining?: number;
  /** Phase 9: 魔法なら「詠唱しはじめた」、物理なら「溜め始めた」と表記する用 */
  chargeSkillType?: "physical" | "magic";
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

/** 現在の陣地位置のスナップショット（ログエントリ用。参照のコピーでなく値のコピー） */
function snapshotPositions(
  partyPos: BattlePosition[],
  enemyPos: BattlePosition[]
): { partyPositions: BattlePosition[]; enemyPositions: BattlePosition[] } {
  return {
    partyPositions: partyPos.map((p) => ({ row: p.row, col: p.col })),
    enemyPositions: enemyPos.map((p) => ({ row: p.row, col: p.col })),
  };
}

/** Phase 3: 属性状態 1 件（持続はサイクル単位） */
export interface AttrStateEntry {
  attr: string;
  remainingCycles: number;
}

const DEFAULT_ATTR_DURATION_CYCLES = 2;

/** Phase 3: ユニットに属性状態を付与。既に同じ attr があれば残りサイクルを上書き（リフレッシュ） */
function addAttrState(unitStates: AttrStateEntry[], attr: string, durationCycles: number): void {
  const existing = unitStates.find((s) => s.attr === attr);
  if (existing) {
    existing.remainingCycles = durationCycles;
    return;
  }
  unitStates.push({ attr, remainingCycles: durationCycles });
}

/** Phase 3: 全ユニットの属性状態の残りサイクルを 1 減算し、0 以下を削除 */
function tickAttrStates(partyAttrStates: AttrStateEntry[][], enemyAttrStates: AttrStateEntry[][]): void {
  for (const unit of partyAttrStates) {
    for (const s of unit) s.remainingCycles -= 1;
    unit.splice(0, unit.length, ...unit.filter((s) => s.remainingCycles > 0));
  }
  for (const unit of enemyAttrStates) {
    for (const s of unit) s.remainingCycles -= 1;
    unit.splice(0, unit.length, ...unit.filter((s) => s.remainingCycles > 0));
  }
}

/** Phase 3: 作戦評価用に「残り > 0 の属性名だけ」の配列に変換 */
function attrStatesToSnapshot(unitStates: AttrStateEntry[]): string[] {
  return unitStates.filter((s) => s.remainingCycles > 0).map((s) => s.attr);
}

/** Phase 4: 指定属性状態を1つ消費。あれば true、なければ false */
function consumeAttrState(unitStates: AttrStateEntry[], attr: string): boolean {
  const idx = unitStates.findIndex((s) => s.attr === attr && s.remainingCycles > 0);
  if (idx < 0) return false;
  unitStates.splice(idx, 1);
  return true;
}

/** Phase 4: 指定属性状態を所持しているか */
function hasAttrState(unitStates: AttrStateEntry[], attr: string): boolean {
  return unitStates.some((s) => s.attr === attr && s.remainingCycles > 0);
}

/** Phase 4/8: デバフ1件。DoT 用の recordDamage/dotKind/dotPct、萎縮用の statMult */
export interface DebuffEntry {
  code: string;
  remainingCycles: number;
  /** Phase 8: 燃焼 DoT 用。記録した与ダメの何割かで継続ダメージ */
  recordDamage?: number;
  dotKind?: "record_pct" | "current_hp_pct";
  dotPct?: number;
  /** Phase 8: 萎縮など。PATK/MATK 等の乗数（0.75 = 25% ダウン） */
  statMult?: Record<string, number>;
}

function addDebuff(
  unitDebuffs: DebuffEntry[],
  code: string,
  durationCycles: number,
  meta?: Partial<Pick<DebuffEntry, "recordDamage" | "dotKind" | "dotPct" | "statMult">>
): void {
  const entry: DebuffEntry = { code, remainingCycles: Math.max(0, durationCycles) };
  if (meta?.recordDamage != null) entry.recordDamage = meta.recordDamage;
  if (meta?.dotKind) entry.dotKind = meta.dotKind;
  if (meta?.dotPct != null) entry.dotPct = meta.dotPct;
  if (meta?.statMult) entry.statMult = meta.statMult;
  unitDebuffs.push(entry);
}

/** Phase 8: デバフのステータス乗算をまとめた値（0.75 等）。複数あれば積 */
function getDebuffStatMult(debuffs: DebuffEntry[], stat: string): number {
  let mult = 1;
  for (const d of debuffs) {
    if (d.remainingCycles <= 0 || !d.statMult) continue;
    const m = d.statMult[stat];
    if (m != null) mult *= m;
  }
  return mult;
}

function tickDebuffs(partyDebuffs: DebuffEntry[][], enemyDebuffs: DebuffEntry[][]): void {
  for (const unit of partyDebuffs) {
    for (const d of unit) d.remainingCycles -= 1;
    unit.splice(0, unit.length, ...unit.filter((d) => d.remainingCycles > 0));
  }
  for (const unit of enemyDebuffs) {
    for (const d of unit) d.remainingCycles -= 1;
    unit.splice(0, unit.length, ...unit.filter((d) => d.remainingCycles > 0));
  }
}

/** Phase 4: 作戦評価用にデバフコード一覧を返す */
function debuffsToSnapshot(unitDebuffs: DebuffEntry[]): string[] {
  return unitDebuffs.filter((d) => d.remainingCycles > 0).map((d) => d.code);
}

/** Phase 7: バフ1件（ステータス上昇率と残りサイクル） */
export interface BuffEntry {
  stat: string;
  pct: number;
  remainingCycles: number;
}

function addBuff(unitBuffs: BuffEntry[], stat: string, pct: number, durationCycles: number): void {
  unitBuffs.push({ stat, pct, remainingCycles: Math.max(0, durationCycles) });
}

function tickBuffs(partyBuffs: BuffEntry[][]): void {
  for (const unit of partyBuffs) {
    for (const b of unit) b.remainingCycles -= 1;
    unit.splice(0, unit.length, ...unit.filter((b) => b.remainingCycles > 0));
  }
}

/** Phase 7: バフを適用したステータス値（derived[stat] * (1 + sum(pct))） */
function getBuffedStat(
  derived: Record<string, number>,
  buffs: BuffEntry[],
  stat: string
): number {
  const base = derived[stat];
  if (base == null || typeof base !== "number") return base ?? 0;
  const sumPct = buffs
    .filter((b) => b.remainingCycles > 0 && b.stat === stat)
    .reduce((s, b) => s + b.pct, 0);
  return base * (1 + sumPct);
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

/** 物理なら PDEF、魔法なら MDEF で減衰。Phase 7: バフ。Phase 8: デバフ。Phase 10: 属性耐性で最終ダメージを乗算。 */
function resolveDamage(
  attacker: FighterState,
  defender: FighterState,
  attackType: "physical" | "magic",
  powerMult: number,
  fatigue: number,
  attackerBuffs?: BuffEntry[],
  defenderBuffs?: BuffEntry[],
  attackerDebuffs?: DebuffEntry[],
  defenderDebuffs?: DebuffEntry[],
  /** Phase 10: スキル属性。none/未指定時は耐性適用なし。 */
  attribute?: string,
  /** Phase 10: 防御側の属性耐性。装備・遺物実装後に渡す。 */
  defenderResistances?: AttributeResistances
): { hit: boolean; direct: boolean; fatal: boolean; damage: number } {
  const aDerived = attacker.derived as Record<string, number>;
  const dDerived = defender.derived as Record<string, number>;
  const hitStat = (attackerBuffs?.length ? getBuffedStat(aDerived, attackerBuffs, "HIT") : attacker.derived.HIT) as number;
  const evaStat = (defenderBuffs?.length ? getBuffedStat(dDerived, defenderBuffs, "EVA") : defender.derived.EVA) as number;
  const hit = rollHit(hitStat, evaStat);
  let direct = false;
  let fatal = false;
  let damage = 0;
  const defStatName = attackType === "physical" ? "PDEF" : "MDEF";
  let defRaw = defenderBuffs?.length
    ? getBuffedStat(dDerived, defenderBuffs, defStatName)
    : (attackType === "physical" ? defender.derived.PDEF : defender.derived.MDEF);
  defRaw *= defenderDebuffs?.length ? getDebuffStatMult(defenderDebuffs, defStatName) : 1;
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
    const atkStatName = attackType === "physical" ? "PATK" : "MATK";
    let atk = attackerBuffs?.length
      ? getBuffedStat(aDerived, attackerBuffs, atkStatName)
      : (attackType === "physical" ? attacker.derived.PATK : attacker.derived.MATK);
    atk *= attackerDebuffs?.length ? getDebuffStatMult(attackerDebuffs, atkStatName) : 1;
    let dmg = atk * powerMult * mitigation * fatigue;
    if (direct) dmg *= BATTLE_DIRECT_MULT;
    if (fatal) dmg *= BATTLE_FATAL_MULT;
    const resistMult =
      attribute && attribute !== "none" && defenderResistances
        ? (defenderResistances[attribute] ?? 1.0)
        : 1.0;
    damage = Math.max(0, Math.floor(dmg * resistMult));
  }

  return { hit, direct, fatal, damage };
}

/** 全体への追加ダメージ用：基準ダメージに各敵の防御・乱数・Phase 10 属性耐性を適用。 */
function resolveSplashDamage(
  defender: FighterState,
  attackType: "physical" | "magic",
  baseDamage: number,
  defenderBuffs?: BuffEntry[],
  attribute?: string,
  defenderResistances?: AttributeResistances
): number {
  const dDerived = defender.derived as Record<string, number>;
  const defStatName = attackType === "physical" ? "PDEF" : "MDEF";
  const defRaw = defenderBuffs?.length
    ? getBuffedStat(dDerived, defenderBuffs, defStatName)
    : (attackType === "physical" ? defender.derived.PDEF : defender.derived.MDEF);
  const randDef = randomFloat(BATTLE_DAMAGE_RAND_DEF_MIN, BATTLE_DAMAGE_RAND_DEF_MAX);
  const defEffective = defRaw * randDef;
  const mitigation = BATTLE_MITIGATION_DENOM / (BATTLE_MITIGATION_DENOM + defEffective);
  const resistMult =
    attribute && attribute !== "none" && defenderResistances
      ? (defenderResistances[attribute] ?? 1.0)
      : 1.0;
  return Math.max(0, Math.floor(baseDamage * mitigation * resistMult));
}

function fatigueForCycle(cycle: number): number {
  if (cycle <= BATTLE_FATIGUE_CYCLES_SAFE) return 1.0;
  return 1 + BATTLE_FATIGUE_RATE * (cycle - BATTLE_FATIGUE_CYCLES_SAFE);
}

export function getMpCost(skill: SkillDataForBattle, cap: number): number {
  return Math.floor(cap * skill.mpCostCapCoef) + skill.mpCostFlat;
}

/** Phase 6: 回復スケール文字列をパース（例: "MATK*0.5" → actor.derived.MATK * 0.5） */
function resolveHealScale(scale: string, actor: FighterState): number {
  const s = (scale || "").trim();
  if (s.startsWith("MATK*")) {
    const coef = parseFloat(s.slice(5)) || 0;
    return actor.derived.MATK * coef;
  }
  if (s.startsWith("PATK*")) {
    const coef = parseFloat(s.slice(5)) || 0;
    return actor.derived.PATK * coef;
  }
  return 0;
}

/** Phase 6: 味方単体ターゲットを1人選ぶ（生存中で現在HP割合が最も低い者） */
function pickAllyTargetSingle(
  party: PartyFighter[],
  partyAlive: boolean[]
): number {
  let best = -1;
  let bestPct = 2;
  for (let i = 0; i < party.length; i++) {
    if (!partyAlive[i] || party[i].currentHp <= 0) continue;
    const pct = party[i].currentHp / party[i].derived.HP;
    if (pct < bestPct) {
      bestPct = pct;
      best = i;
    }
  }
  return best >= 0 ? best : party.findIndex((_, i) => partyAlive[i]);
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
  return Array.from({ length: count }, (_, i) => ({ row: (i + 1) as 1 | 2 | 3, col: 1 as BattleCol }));
}

/** Phase 2: 列移動効果の param を適用して position.col を更新（1=前列, 3=後列）。direction: forward=前列へ, back=後列へ */
function applyMoveColumn(position: BattlePosition, param: Record<string, unknown>): void {
  const toCol = param.toColumn as number | undefined;
  if (typeof toCol === "number") {
    position.col = Math.max(1, Math.min(3, toCol)) as BattleCol;
    return;
  }
  const dir = param.direction as string | undefined;
  const steps = Math.max(0, Number(param.steps) || 0);
  if (dir === "forward") {
    position.col = Math.max(1, position.col - steps) as BattleCol;
  } else if (dir === "back") {
    position.col = Math.min(3, position.col + steps) as BattleCol;
  }
}

/** 生存している敵から列ウェイトでターゲットを1体抽選。スキル用の列ウェイト加算を渡せる。allowedIndices 指定時はその列の敵のみが対象。 */
function pickEnemyTarget(
  enemies: FighterState[],
  positions: BattlePosition[],
  alive: boolean[],
  weightAdd?: SkillColumnWeightAdd,
  allowedIndices?: number[] | null
): number {
  const pool = allowedIndices?.length
    ? allowedIndices.filter((i) => i >= 0 && i < ENEMY_COUNT && alive[i])
    : Array.from({ length: ENEMY_COUNT }, (_, i) => i).filter((i) => alive[i]);
  if (pool.length === 0) return 0;
  let totalWeight = 0;
  const weights: number[] = [];
  for (const i of pool) {
    let w = getColumnWeight(positions[i].col);
    if (weightAdd) {
      if (positions[i].col === 1) w += weightAdd.front;
      else if (positions[i].col === 2) w += weightAdd.mid;
      else w += weightAdd.back;
    }
    weights.push(Math.max(0, w));
    totalWeight += weights[weights.length - 1];
  }
  if (totalWeight <= 0) return pool[0];
  let r = Math.random() * totalWeight;
  for (let k = 0; k < pool.length; k++) {
    if (r < weights[k]) return pool[k];
    r -= weights[k];
  }
  return pool[0];
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
  enemyPositions: BattlePosition[],
  /** 戦闘開始時の味方の列位置。省略時は defaultPartyPositions。長さが party と一致する場合のみ使用 */
  initialPartyPositions?: BattlePosition[],
  /** Phase 10: 敵ごとの属性耐性。長さ3。未指定時は全員耐性なし(空オブジェクト)。装備・遺物実装後に敵側も拡張可能。 */
  enemyAttributeResistances?: AttributeResistances[]
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

  /** Phase 10: 味方ごとの属性耐性。現状は partyInput からそのまま渡す（装備・遺物未実装のため空）。 */
  const partyAttributeResistances: AttributeResistances[] = partyInput.map(
    (p) => p.attributeResistances ?? {}
  );

  const enemies: FighterState[] = enemyPositions.map(() => {
    const derived = computeDerivedStats(enemyBase);
    return {
      base: enemyBase,
      derived,
      currentHp: derived.HP,
      currentMp: derived.MP,
    };
  });

  /** Phase 10: 敵ごとの属性耐性。未指定時は全員空（耐性なし）。 */
  const enemyResistances: AttributeResistances[] =
    enemyAttributeResistances && enemyAttributeResistances.length >= ENEMY_COUNT
      ? enemyAttributeResistances.slice(0, ENEMY_COUNT)
      : Array.from({ length: ENEMY_COUNT }, () => ({}));

  const partyAlive = party.map(() => true);
  const enemyAlive = [true, true, true];
  const log: BattleLogEntryWithParty[] = [];
  let totalCycles = 0;
  let winner: "player" | "enemy" | "draw" = "draw";
  const partyPositions: BattlePosition[] =
    initialPartyPositions && initialPartyPositions.length === party.length
      ? initialPartyPositions.map((p) => ({ row: p.row, col: p.col }))
      : defaultPartyPositions(party.length);
  /** Phase 2: 列移動を反映するため敵位置はループ内で更新可能なコピーを使用 */
  const currentEnemyPositions: BattlePosition[] = enemyPositions.map((p) => ({ row: p.row, col: p.col }));

  /** Phase 3: 属性状態。味方・敵ごとに { attr, remainingCycles }[]。サイクル終了時に tick で減算 */
  const partyAttrStates: AttrStateEntry[][] = Array.from({ length: party.length }, () => []);
  const enemyAttrStates: AttrStateEntry[][] = Array.from({ length: ENEMY_COUNT }, () => []);

  /** Phase 4: デバフ。味方・敵ごとに { code, remainingCycles }[]。サイクル終了時に tick */
  const partyDebuffs: DebuffEntry[][] = Array.from({ length: party.length }, () => []);
  const enemyDebuffs: DebuffEntry[][] = Array.from({ length: ENEMY_COUNT }, () => []);

  /** Phase 7: バフ。味方ごとに { stat, pct, remainingCycles }[]。サイクル終了時に tick */
  const partyBuffs: BuffEntry[][] = Array.from({ length: party.length }, () => []);

  /** Phase 9: 溜め予約。味方ごとに { skillId, remainingCycles } | null。死亡で破棄 */
  const chargeReservation: ({ skillId: string; remainingCycles: number } | null)[] = Array.from(
    { length: party.length },
    () => null
  );

  /** docs/023 方式B: 味方ごとの残りクール。partyCooldowns[i][skillId] = 残りサイクル数 */
  const partyCooldowns: Record<string, number>[] = Array.from({ length: party.length }, () => ({}));
  /** docs/023 方式B: このターンで使ったスキル（CT 付与用）。ターン終了処理後にクリア */
  const skillUsedThisTurnByPartyIndex: ({ skillId: string; cooldownCycles: number } | null)[] = Array.from(
    { length: party.length },
    () => null
  );

  /** docs/023 方式B: 味方ターン終了時。既存クールを1減算し、このターンで使ったスキルにCTをセット */
  function applyCooldownEndOfTurn(partyIndex: number): void {
    const cooldowns = partyCooldowns[partyIndex];
    for (const skillId of Object.keys(cooldowns)) {
      const next = Math.max(0, cooldowns[skillId]! - 1);
      if (next <= 0) delete cooldowns[skillId];
      else cooldowns[skillId] = next;
    }
    const used = skillUsedThisTurnByPartyIndex[partyIndex];
    if (used && used.cooldownCycles > 0) cooldowns[used.skillId] = used.cooldownCycles;
    skillUsedThisTurnByPartyIndex[partyIndex] = null;
  }

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

      // Phase 8: このスロットのユニットのターンが来た時点で DoT を処理（毎サイクル発生ダメージをここで表示）
      if (slot.kind === "p") {
        const idx = slot.index;
        if (idx < party.length && partyAlive[idx] && party[idx].currentHp > 0) {
          const unitDebuffs = partyDebuffs[idx];
          for (const d of unitDebuffs) {
            if (d.remainingCycles <= 0 || !d.dotKind || d.dotPct == null) continue;
            const unit = party[idx];
            const dmg =
              d.dotKind === "record_pct"
                ? Math.floor((d.recordDamage ?? 0) * d.dotPct)
                : Math.max(0, Math.floor(unit.currentHp * d.dotPct));
            if (dmg <= 0) continue;
            unit.currentHp = Math.max(0, unit.currentHp - dmg);
            const snapAfter = snapshotPartyHpMp(party);
            const posSnap = snapshotPositions(partyPositions, currentEnemyPositions);
            log.push({
              cycle,
              turn: turnIndex,
              attacker: "player",
              attackerPartyIndex: idx,
              target: "player",
              targetPartyIndex: idx,
              actionType: "dot",
              hit: true,
              direct: false,
              fatal: false,
              damage: dmg,
              targetHpAfter: unit.currentHp,
              mpRecovery: 0,
              playerHpAfter: party[0]?.currentHp ?? 0,
              playerMpAfter: party[0]?.currentMp ?? 0,
              enemyHpAfter: enemies.map((e) => e.currentHp),
              enemyMpAfter: enemies.map((e) => e.currentMp),
              partyHpAfter: snapAfter.partyHp,
              partyMpAfter: snapAfter.partyMp,
              dotDebuffCode: d.code,
              partyPositions: posSnap.partyPositions,
              enemyPositions: posSnap.enemyPositions,
            });
            if (unit.currentHp <= 0) {
              partyAlive[idx] = false;
              chargeReservation[idx] = null;
            }
          }
        }
      } else {
        const idx = slot.index;
        if (idx < ENEMY_COUNT && enemyAlive[idx] && enemies[idx].currentHp > 0) {
          const unitDebuffs = enemyDebuffs[idx];
          for (const d of unitDebuffs) {
            if (d.remainingCycles <= 0 || !d.dotKind || d.dotPct == null) continue;
            const unit = enemies[idx];
            const dmg =
              d.dotKind === "record_pct"
                ? Math.floor((d.recordDamage ?? 0) * d.dotPct)
                : Math.max(0, Math.floor(unit.currentHp * d.dotPct));
            if (dmg <= 0) continue;
            unit.currentHp = Math.max(0, unit.currentHp - dmg);
            const snapAfter = snapshotPartyHpMp(party);
            const posSnap = snapshotPositions(partyPositions, currentEnemyPositions);
            log.push({
              cycle,
              turn: turnIndex,
              attacker: "enemy",
              attackerEnemyIndex: idx,
              target: "enemy",
              targetEnemyIndex: idx,
              actionType: "dot",
              hit: true,
              direct: false,
              fatal: false,
              damage: dmg,
              targetHpAfter: unit.currentHp,
              mpRecovery: 0,
              playerHpAfter: party[0]?.currentHp ?? 0,
              playerMpAfter: party[0]?.currentMp ?? 0,
              enemyHpAfter: enemies.map((e) => e.currentHp),
              enemyMpAfter: enemies.map((e) => e.currentMp),
              partyHpAfter: snapAfter.partyHp,
              partyMpAfter: snapAfter.partyMp,
              dotDebuffCode: d.code,
              partyPositions: posSnap.partyPositions,
              enemyPositions: posSnap.enemyPositions,
            });
            if (unit.currentHp <= 0) enemyAlive[idx] = false;
          }
        }
      }

      if (slot.kind === "p") {
        const actorIndex = slot.index;
        if (actorIndex >= party.length || !partyAlive[actorIndex] || party[actorIndex].currentHp <= 0) {
          chargeReservation[actorIndex] = null;
          applyCooldownEndOfTurn(actorIndex);
          continue;
        }

        const actor = party[actorIndex];
        const legacy = partyToLegacyPlayer(party);
        const snapParty = snapshotPartyHpMp(party);
        const enemyHp = enemies.map((e) => e.currentHp);
        const enemyMp = enemies.map((e) => e.currentMp);

        // Phase 9: 溜め予約があればカウント減算。0 なら発動、否则 溜め中ログでターン消費
        let action: {
          actionType: string;
          skillId: string | null;
          matchedOrderIndex?: number;
          skippedDueToCt?: number[];
        };
        let actionFromChargeReservation = false;
        const res = chargeReservation[actorIndex];
        if (res) {
          res.remainingCycles -= 1;
          if (res.remainingCycles <= 0) {
            action = { actionType: "skill", skillId: res.skillId, skippedDueToCt: undefined };
            chargeReservation[actorIndex] = null;
            actionFromChargeReservation = true;
          } else {
            const posSnap = snapshotPositions(partyPositions, currentEnemyPositions);
            const chargedSkill = actor.skills[res.skillId] as SkillDataForBattle | undefined;
            const chargeType = chargedSkill?.battleSkillType === "magic" ? "magic" : "physical";
            log.push({
              cycle,
              turn: turnIndex,
              attacker: "player",
              attackerPartyIndex: actorIndex,
              target: "enemy",
              targetEnemyIndex: 0,
              actionType: "charge",
              skillName: chargedSkill?.name ?? res.skillId,
              hit: false,
              direct: false,
              fatal: false,
              damage: 0,
              targetHpAfter: enemies[0]?.currentHp ?? 0,
              mpRecovery: 0,
              playerHpAfter: legacy.playerHp,
              playerMpAfter: legacy.playerMp,
              enemyHpAfter: enemyHp,
              enemyMpAfter: enemyMp,
              partyHpAfter: snapParty.partyHp,
              partyMpAfter: snapParty.partyMp,
              chargeRemaining: res.remainingCycles,
              chargeSkillType: chargeType,
              partyPositions: posSnap.partyPositions,
              enemyPositions: posSnap.enemyPositions,
            });
            applyCooldownEndOfTurn(actorIndex);
            continue;
          }
        } else {
          const tacticCtx: TacticEvaluationContext = {
          cycle,
          turnIndexInCycle: turnIndex,
          actorPartyIndex: actorIndex,
          party: party.map((p, i) => ({
            currentHp: p.currentHp,
            maxHp: p.derived.HP,
            currentMp: p.currentMp,
            maxMp: p.derived.MP,
            attrStates: attrStatesToSnapshot(partyAttrStates[i] ?? []),
            debuffs: debuffsToSnapshot(partyDebuffs[i] ?? []),
          })),
          partyAlive: [...partyAlive],
          enemies: enemies.map((e, i) => ({
            currentHp: e.currentHp,
            maxHp: e.derived.HP,
            currentMp: e.currentMp,
            maxMp: e.derived.MP,
            attrStates: attrStatesToSnapshot(enemyAttrStates[i] ?? []),
            debuffs: debuffsToSnapshot(enemyDebuffs[i] ?? []),
          })),
          enemyAlive: [...enemyAlive],
          partyPositions,
          enemyPositions: currentEnemyPositions,
        };
          const hasSkill = (skillId: string) => {
            const skill = actor.skills[skillId];
            return !!skill && actor.currentMp >= getMpCost(skill, actor.base.CAP);
          };
          const isSkillOnCooldown = (skillId: string) =>
            (partyCooldowns[actorIndex][skillId] ?? 0) > 0;
          action = evaluateTacticsFromSpec(
            toSlotsForEval(actor.tacticSlots),
            tacticCtx,
            hasSkill,
            isSkillOnCooldown
          );
        }

        if (action.actionType === "skill" && action.skillId) {
          const skill = actor.skills[action.skillId] as SkillDataForBattle | undefined;
          // Phase 9: 溜めスキルを選択した場合はこのターンは予約のみ。予約発動時（actionFromChargeReservation）は実行する
          if (!actionFromChargeReservation && skill && (skill.chargeCycles ?? 0) >= 1) {
            chargeReservation[actorIndex] = {
              skillId: action.skillId,
              remainingCycles: skill.chargeCycles!,
            };
            const posSnap = snapshotPositions(partyPositions, currentEnemyPositions);
            const chargeType = skill.battleSkillType === "magic" ? "magic" : "physical";
            log.push({
              cycle,
              turn: turnIndex,
              attacker: "player",
              attackerPartyIndex: actorIndex,
              target: "enemy",
              targetEnemyIndex: 0,
              actionType: "charge",
              skillName: skill.name,
              hit: false,
              direct: false,
              fatal: false,
              damage: 0,
              targetHpAfter: enemies[0]?.currentHp ?? 0,
              mpRecovery: 0,
              playerHpAfter: legacy.playerHp,
              playerMpAfter: legacy.playerMp,
              enemyHpAfter: enemyHp,
              enemyMpAfter: enemyMp,
              partyHpAfter: snapParty.partyHp,
              partyMpAfter: snapParty.partyMp,
              isChargeStart: true,
              chargeSkillType: chargeType,
              partyPositions: posSnap.partyPositions,
              enemyPositions: posSnap.enemyPositions,
            });
            applyCooldownEndOfTurn(actorIndex);
            continue;
          }
          if (!skill) {
            const targetIdx = pickEnemyTarget(enemies, currentEnemyPositions, enemyAlive);
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
              targetHpAfter: enemies[targetIdx]?.currentHp ?? 0,
              mpRecovery: 0,
              playerHpAfter: legacy.playerHp,
              playerMpAfter: legacy.playerMp,
              enemyHpAfter: enemyHp,
              enemyMpAfter: enemyMp,
              partyHpAfter: snapParty.partyHp,
              partyMpAfter: snapParty.partyMp,
            };
            const posSnap = snapshotPositions(partyPositions, currentEnemyPositions);
            entry.partyPositions = posSnap.partyPositions;
            entry.enemyPositions = posSnap.enemyPositions;
            log.push(entry);
            applyCooldownEndOfTurn(actorIndex);
            continue;
          }
          const cost = getMpCost(skill, actor.base.CAP);
          if (actor.currentMp < cost) {
            const targetIdx = pickEnemyTarget(enemies, currentEnemyPositions, enemyAlive);
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
              targetHpAfter: enemies[targetIdx]?.currentHp ?? 0,
              mpRecovery: 0,
              playerHpAfter: legacy.playerHp,
              playerMpAfter: legacy.playerMp,
              enemyHpAfter: enemyHp,
              enemyMpAfter: enemyMp,
              partyHpAfter: snapParty.partyHp,
              partyMpAfter: snapParty.partyMp,
            };
            const posSnapFizzle = snapshotPositions(partyPositions, currentEnemyPositions);
            entry.partyPositions = posSnapFizzle.partyPositions;
            entry.enemyPositions = posSnapFizzle.enemyPositions;
            log.push(entry);
            applyCooldownEndOfTurn(actorIndex);
            continue;
          }

          // Phase 6/7: ally_single / ally_all / self — 回復・解除・バフ（敵への攻撃は行わない）
          const targetScope = skill.targetScope ?? "enemy_single";
          if (targetScope === "ally_single" || targetScope === "ally_all" || targetScope === "self") {
            const targets: number[] =
              targetScope === "self"
                ? [actorIndex]
                : targetScope === "ally_single"
                ? (() => {
                    const i = pickAllyTargetSingle(party, partyAlive);
                    return i >= 0 ? [i] : [];
                  })()
                : party.map((_, i) => i).filter((i) => partyAlive[i]);
            const effects = skill.effects ?? [];
            let totalHealAmount = 0;
            let isHealAll = false;
            const hadHealEffect = effects.some(
              (e) => e.effectType === "heal_single" || e.effectType === "heal_all"
            );
            const hadBuffEffect = effects.some((e) => e.effectType === "ally_buff");
            const dispelledDebuffs: { targetPartyIndex: number; codes: string[] }[] = [];

            for (const e of effects) {
              if (e.effectType === "heal_single" && e.param && typeof e.param === "object" && targets.length > 0) {
                const p = e.param as { scale?: string };
                const amount = resolveHealScale(p.scale ?? "", actor);
                if (amount > 0) {
                  const m = party[targets[0]];
                  const prev = m.currentHp;
                  m.currentHp = Math.min(m.derived.HP, m.currentHp + Math.floor(amount));
                  totalHealAmount += m.currentHp - prev;
                }
              }
              if (e.effectType === "heal_all" && e.param && typeof e.param === "object") {
                const p = e.param as { scale?: string };
                const amount = resolveHealScale(p.scale ?? "", actor);
                if (amount > 0) {
                  isHealAll = true;
                  const floorAmount = Math.floor(amount);
                  for (let i = 0; i < party.length; i++) {
                    if (!partyAlive[i]) continue;
                    const m = party[i];
                    const prev = m.currentHp;
                    m.currentHp = Math.min(m.derived.HP, m.currentHp + floorAmount);
                    totalHealAmount += m.currentHp - prev;
                  }
                }
              }
            }
            // Phase 7: ally_buff — 味方にステータスバフを付与
            for (const e of effects) {
              if (e.effectType !== "ally_buff" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as { target?: string; stat?: string; pct?: number; durationCycles?: number };
              const bufTarget = (p.target as string) || "self";
              const stat = (p.stat as string) || "";
              const pct = Number(p.pct) ?? 0;
              const duration = Math.max(0, Number(p.durationCycles) ?? 0);
              if (!stat || pct <= 0) continue;
              const indices =
                bufTarget === "self"
                  ? [actorIndex]
                  : party.map((_, i) => i).filter((i) => partyAlive[i]);
              for (const i of indices) addBuff(partyBuffs[i], stat, pct, duration);
            }
            for (const targetIdx of targets) {
              const removedCodes: string[] = [];
              for (const e of effects) {
                if (e.effectType === "dispel_debuff" && e.param && typeof e.param === "object") {
                  const p = e.param as { count?: number };
                  const count = Math.min(Number(p.count) || 1, partyDebuffs[targetIdx].length);
                  for (let c = 0; c < count; c++) {
                    const d = partyDebuffs[targetIdx][0];
                    if (d) removedCodes.push(d.code);
                    partyDebuffs[targetIdx].shift();
                  }
                }
                if (e.effectType === "dispel_debuffs" && e.param && typeof e.param === "object") {
                  const p = e.param as { list?: string[] };
                  const list = Array.isArray(p.list) ? p.list : [];
                  if (list.length === 0) {
                    for (const d of partyDebuffs[targetIdx]) removedCodes.push(d.code);
                    partyDebuffs[targetIdx] = [];
                  } else {
                    const before = partyDebuffs[targetIdx].length;
                    partyDebuffs[targetIdx] = partyDebuffs[targetIdx].filter((d) => {
                      if (list.includes(d.code)) {
                        removedCodes.push(d.code);
                        return false;
                      }
                      return true;
                    });
                  }
                }
              }
              if (removedCodes.length > 0) {
                dispelledDebuffs.push({ targetPartyIndex: targetIdx, codes: removedCodes });
              }
            }
            // Phase 7: self のとき move_self_column / self_attr_state_cost を適用
            if (targetScope === "self") {
              for (const e of effects) {
                if (e.effectType === "move_self_column" && e.param && typeof e.param === "object") {
                  applyMoveColumn(partyPositions[actorIndex], e.param as Record<string, unknown>);
                }
                if (e.effectType === "self_attr_state_cost" && e.param && typeof e.param === "object") {
                  const p = e.param as { attr?: string; durationCycles?: number };
                  const attr = p.attr as string | undefined;
                  if (attr) {
                    const duration = Math.max(0, Number(p.durationCycles) ?? 0);
                    addAttrState(partyAttrStates[actorIndex], attr, duration);
                  }
                }
              }
            }

            actor.currentMp = Math.max(0, actor.currentMp - cost);
            const snapAfter = snapshotPartyHpMp(party);
            const posSnap = snapshotPositions(partyPositions, currentEnemyPositions);
            log.push({
              cycle,
              turn: turnIndex,
              attacker: "player",
              attackerPartyIndex: actorIndex,
              target: "player",
              targetPartyIndex: targets[0],
              actionType: "skill",
              skillName: skill.name,
              fizzle: false,
              hit: true,
              direct: false,
              fatal: false,
              damage: 0,
              targetHpAfter: party[targets[0]]?.currentHp ?? 0,
              mpRecovery: 0,
              playerHpAfter: party[0]?.currentHp ?? 0,
              playerMpAfter: party[0]?.currentMp ?? 0,
              enemyHpAfter: enemies.map((e) => e.currentHp),
              enemyMpAfter: enemies.map((e) => e.currentMp),
              partyHpAfter: snapAfter.partyHp,
              partyMpAfter: snapAfter.partyMp,
              tacticSlotOrder: action.matchedOrderIndex,
              tacticSlotSkippedDueToCt: action.skippedDueToCt,
              logMessage: skill.logMessage ?? undefined,
              logMessageOnCondition: skill.logMessageOnCondition ?? undefined,
              partyPositions: posSnap.partyPositions,
              enemyPositions: posSnap.enemyPositions,
              healAmount: totalHealAmount > 0 ? totalHealAmount : undefined,
              isHealAll: isHealAll || undefined,
              hadHealEffect: hadHealEffect || undefined,
              dispelledDebuffs:
                dispelledDebuffs.length > 0 ? dispelledDebuffs : undefined,
              hadBuffEffect: hadBuffEffect || undefined,
            });
            const ct = skill.cooldownCycles ?? 0;
            if (ct > 0 && action.skillId) skillUsedThisTurnByPartyIndex[actorIndex] = { skillId: action.skillId, cooldownCycles: ct };
            applyCooldownEndOfTurn(actorIndex);
            continue;
          }

          const hitsMin = skill.hitsMin ?? 1;
          const hitsMax = skill.hitsMax ?? 1;
          let hitCount = randomInt(Math.max(1, hitsMin), Math.max(1, hitsMax));
          const resampleTargetPerHit = skill.resampleTargetPerHit ?? false;
          const weightAdd: SkillColumnWeightAdd | undefined =
            skill.weightAddFront != null || skill.weightAddMid != null || skill.weightAddBack != null
              ? {
                  front: Number(skill.weightAddFront ?? 0),
                  mid: Number(skill.weightAddMid ?? 0),
                  back: Number(skill.weightAddBack ?? 0),
                }
              : undefined;

          let firstTargetIdx = 0;
          let totalDamage = 0;
          let conditionMet = false;
          let triggeredAttr: string | undefined;
          const hitResults: { hit: boolean; direct: boolean; fatal: boolean }[] = [];
          const hitDetails: { damage: number; hit: boolean; direct: boolean; fatal: boolean; targetEnemyIndex: number; attrApplied?: string }[] = [];
          const attackType = skill.battleSkillType === "magic" ? "magic" : "physical";
          // Phase 8: 毒霧・萎縮など apply_debuff のみのスキルはダメージ 0
          const powerMult = skill.powerMultiplier ?? 1.0;
          const effects = skill.effects ?? [];

          // 列指定攻撃（damage_target_columns）: 指定列にいる敵全員にダメージ。targetColumns=[1,2,3] で全体攻撃
          let columnTargetIndices: number[] | null = null;
          const colEffect = effects.find(
            (e) => e.effectType === "damage_target_columns" && e.param && typeof e.param === "object"
          );
          if (colEffect?.param) {
            const p = colEffect.param as { targetColumns?: unknown };
            const cols = Array.isArray(p.targetColumns)
              ? (p.targetColumns.filter((c): c is number => typeof c === "number" && c >= 1 && c <= 3) as number[])
              : [];
            if (cols.length > 0) {
              columnTargetIndices = [];
              for (let i = 0; i < ENEMY_COUNT; i++) {
                if (enemyAlive[i] && cols.includes(currentEnemyPositions[i].col)) columnTargetIndices.push(i);
              }
              if (columnTargetIndices.length === 0) {
                const cost = getMpCost(skill, actor.base.CAP);
                actor.currentMp = Math.max(0, actor.currentMp - cost);
                const ct = skill.cooldownCycles ?? 0;
                if (ct > 0) skillUsedThisTurnByPartyIndex[actorIndex] = { skillId: action.skillId!, cooldownCycles: ct };
                const posSnap = snapshotPositions(partyPositions, currentEnemyPositions);
                const snapAfter = snapshotPartyHpMp(party);
                log.push({
                  cycle,
                  turn: turnIndex,
                  attacker: "player",
                  attackerPartyIndex: actorIndex,
                  target: "enemy",
                  targetEnemyIndex: 0,
                  actionType: "skill",
                  skillName: skill.name,
                  fizzle: false,
                  hit: false,
                  direct: false,
                  fatal: false,
                  damage: 0,
                  targetHpAfter: enemies[0]?.currentHp ?? 0,
                  mpRecovery: 0,
                  playerHpAfter: party[0]?.currentHp ?? 0,
                  playerMpAfter: actor.currentMp,
                  enemyHpAfter: enemies.map((e) => e.currentHp),
                  enemyMpAfter: enemies.map((e) => e.currentMp),
                  partyHpAfter: snapAfter.partyHp,
                  partyMpAfter: snapAfter.partyMp,
                  tacticSlotOrder: action.matchedOrderIndex,
                  tacticSlotSkippedDueToCt: action.skippedDueToCt,
                  logMessage: skill.logMessage ?? undefined,
                  logMessageOnCondition: skill.logMessageOnCondition ?? undefined,
                  noColumnTarget: true,
                  partyPositions: posSnap.partyPositions,
                  enemyPositions: posSnap.enemyPositions,
                });
                applyCooldownEndOfTurn(actorIndex);
                continue;
              }
              // enemy_all + 列指定: hitCount はそのまま（範囲全体に hitCount 回）。enemy_single + 列指定: 列内ウェイト抽選で hitCount 回
            }
          }

          const isColumnAll = !!(columnTargetIndices && targetScope === "enemy_all");
          if (isColumnAll && columnTargetIndices!.length > 0) firstTargetIdx = columnTargetIndices![0];

          for (let h = 0; h < hitCount; h++) {
            const targetsThisHit: number[] = isColumnAll
              ? [...columnTargetIndices!]
              : [
                  columnTargetIndices
                    ? pickEnemyTarget(
                        enemies,
                        currentEnemyPositions,
                        enemyAlive,
                        weightAdd,
                        columnTargetIndices
                      )
                    : resampleTargetPerHit || h === 0
                      ? pickEnemyTarget(enemies, currentEnemyPositions, enemyAlive, weightAdd)
                      : firstTargetIdx,
                ];
            if (targetsThisHit.length > 0 && !isColumnAll) firstTargetIdx = targetsThisHit[0];

            for (const targetIdx of targetsThisHit) {
              if (!enemyAlive[targetIdx]) continue;
              let thisHitTriggeredAttr: string | undefined;
              let thisHitDebuffApplied: string | undefined;
            const result = resolveDamage(
              actor,
              enemies[targetIdx],
              attackType,
              powerMult,
              fatigue,
              partyBuffs[actorIndex],
              undefined,
              partyDebuffs[actorIndex],
              enemyDebuffs[targetIdx],
              skill.attribute ?? undefined,
              enemyResistances[targetIdx]
            );
            let finalDmg = result.damage;
            const splashPerEnemy = [0, 0, 0] as number[];

            // Phase 4: attr_state_trigger_damage — 対象が指定属性状態なら倍率を掛け、消費
            for (const e of effects) {
              if (e.effectType !== "attr_state_trigger_damage" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as { triggerAttr?: string; damageMultiplier?: number; consumeAttr?: boolean };
              const triggerAttr = p.triggerAttr as string | undefined;
              if (!triggerAttr || !hasAttrState(enemyAttrStates[targetIdx], triggerAttr)) continue;
              const mult = Number(p.damageMultiplier) || 1;
              finalDmg = Math.floor(finalDmg * mult);
              if (p.consumeAttr) consumeAttrState(enemyAttrStates[targetIdx], triggerAttr);
              conditionMet = true;
              if (triggeredAttr === undefined) triggeredAttr = triggerAttr;
              thisHitTriggeredAttr = triggerAttr;
            }

            enemies[targetIdx].currentHp = Math.max(0, enemies[targetIdx].currentHp - finalDmg);
            totalDamage += finalDmg;

            // Phase 4: attr_state_trigger_splash — 対象が指定属性状態なら与ダメの一定割合を敵全体に（各敵で乱数・防御減算）
            for (const e of effects) {
              if (e.effectType !== "attr_state_trigger_splash" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as { triggerAttr?: string; pctOfDealtDamage?: number };
              const triggerAttr = p.triggerAttr as string | undefined;
              if (!triggerAttr || !hasAttrState(enemyAttrStates[targetIdx], triggerAttr)) continue;
              const pct = Number(p.pctOfDealtDamage) || 0;
              const splashBase = finalDmg * pct;
              for (let i = 0; i < ENEMY_COUNT; i++) {
                if (!enemyAlive[i]) continue;
                const splash = resolveSplashDamage(
                  enemies[i],
                  attackType,
                  splashBase,
                  undefined,
                  skill.attribute ?? undefined,
                  enemyResistances[i]
                );
                enemies[i].currentHp = Math.max(0, enemies[i].currentHp - splash);
                totalDamage += splash;
                splashPerEnemy[i] += splash;
              }
              consumeAttrState(enemyAttrStates[targetIdx], triggerAttr);
              conditionMet = true;
              if (triggeredAttr === undefined) triggeredAttr = triggerAttr;
            }

            // Phase 4: attr_state_chance_debuff — 対象が指定属性状態なら確率でデバフ付与（属性消費）
            for (const e of effects) {
              if (e.effectType !== "attr_state_chance_debuff" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as { triggerAttr?: string; chance?: number; debuffCode?: string; durationCycles?: number };
              const triggerAttr = p.triggerAttr as string | undefined;
              if (!triggerAttr || !hasAttrState(enemyAttrStates[targetIdx], triggerAttr)) continue;
              const chance = Number(p.chance) ?? 0;
              if (Math.random() >= chance) continue;
              const code = (p.debuffCode as string) || "unknown";
              const duration = Math.max(0, Number(p.durationCycles) ?? 0);
              const recordPct = Number(p.recordDamagePct) ?? 0;
              const meta =
                recordPct > 0
                  ? { recordDamage: finalDmg, dotKind: "record_pct" as const, dotPct: recordPct }
                  : undefined;
              addDebuff(enemyDebuffs[targetIdx], code, duration, meta);
              consumeAttrState(enemyAttrStates[targetIdx], triggerAttr);
              conditionMet = true;
              if (triggeredAttr === undefined) triggeredAttr = triggerAttr;
              thisHitTriggeredAttr = triggerAttr;
              thisHitDebuffApplied = code;
            }

            // Phase 5: column_splash — ターゲットが指定列のとき、与ダメの一定割合を敵全体に（各敵で乱数・防御減算）
            for (const e of effects) {
              if (e.effectType !== "column_splash" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as { whenTargetCol?: number; pctOfDealtDamage?: number };
              const whenCol = Number(p.whenTargetCol);
              if (currentEnemyPositions[targetIdx].col !== whenCol) continue;
              const pct = Number(p.pctOfDealtDamage) || 0;
              const splashBase = finalDmg * pct;
              for (let i = 0; i < ENEMY_COUNT; i++) {
                if (!enemyAlive[i]) continue;
                const splash = resolveSplashDamage(
                  enemies[i],
                  attackType,
                  splashBase,
                  undefined,
                  skill.attribute ?? undefined,
                  enemyResistances[i]
                );
                enemies[i].currentHp = Math.max(0, enemies[i].currentHp - splash);
                totalDamage += splash;
                splashPerEnemy[i] += splash;
              }
              conditionMet = true;
            }

            // Phase 8: apply_debuff — 毒霧・萎縮の呪いなど。敵にデバフを付与
            for (const e of effects) {
              if (e.effectType !== "apply_debuff" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as {
                debuffCode?: string;
                durationCycles?: number;
                damageKind?: string;
                pct?: number;
                statMult?: Record<string, number>;
              };
              const code = (p.debuffCode as string) || "unknown";
              const duration = Math.max(0, Number(p.durationCycles) ?? 0);
              const meta: Parameters<typeof addDebuff>[3] = {};
              if (p.damageKind === "current_hp_pct" && p.pct != null) {
                meta.dotKind = "current_hp_pct";
                meta.dotPct = Number(p.pct);
              }
              if (p.statMult && typeof p.statMult === "object") meta.statMult = p.statMult;
              addDebuff(enemyDebuffs[targetIdx], code, duration, meta);
            }

            hitResults.push({ hit: result.hit, direct: result.direct, fatal: result.fatal });
            const attrApplied =
              result.hit && skill.attribute && skill.attribute !== "none" ? skill.attribute : undefined;
            if (attrApplied) {
              addAttrState(enemyAttrStates[targetIdx], attrApplied, DEFAULT_ATTR_DURATION_CYCLES);
            }
            hitDetails.push({
              damage: finalDmg,
              hit: result.hit,
              direct: result.direct,
              fatal: result.fatal,
              targetEnemyIndex: targetIdx,
              attrApplied,
              splashDamagePerEnemy: splashPerEnemy.some((x) => x > 0) ? [...splashPerEnemy] : undefined,
              triggeredAttr: thisHitTriggeredAttr,
              debuffApplied: thisHitDebuffApplied,
            });
            // Phase 2: ヒットごとに move_target_column を適用
            for (const e of effects) {
              if (e.effectType === "move_target_column" && e.param && typeof e.param === "object") {
                applyMoveColumn(currentEnemyPositions[targetIdx], e.param as Record<string, unknown>);
              }
            }
            } // for (const targetIdx of targetsThisHit)
          } // for (let h)

          // Phase 2: スキル使用後に move_self_column を適用
          for (const e of effects) {
            if (e.effectType === "move_self_column" && e.param && typeof e.param === "object") {
              applyMoveColumn(partyPositions[actorIndex], e.param as Record<string, unknown>);
            }
          }

          // Phase 4: self_attr_state_cost — 使用時に自分に属性状態を付与（代償）
          for (const e of effects) {
            if (e.effectType !== "self_attr_state_cost" || !e.param || typeof e.param !== "object") continue;
            const p = e.param as { attr?: string; durationCycles?: number };
            const attr = p.attr as string | undefined;
            if (!attr) continue;
            const duration = Math.max(0, Number(p.durationCycles) ?? 0);
            addAttrState(partyAttrStates[actorIndex], attr, duration);
          }

          actor.currentMp = Math.max(0, actor.currentMp - cost);
          const ctMain = skill.cooldownCycles ?? 0;
          if (ctMain > 0) skillUsedThisTurnByPartyIndex[actorIndex] = { skillId: action.skillId!, cooldownCycles: ctMain };
          for (let i = 0; i < ENEMY_COUNT; i++) {
            if (enemies[i].currentHp <= 0) enemyAlive[i] = false;
          }

          const snapAfter = snapshotPartyHpMp(party);
          const enemyHpAfter = enemies.map((e) => e.currentHp);
          const enemyMpAfter = enemies.map((e) => e.currentMp);
          log.push({
            cycle,
            turn: turnIndex,
            attacker: "player",
            attackerPartyIndex: actorIndex,
            target: "enemy",
            targetEnemyIndex: firstTargetIdx,
            actionType: "skill",
            skillName: skill.name,
            fizzle: false,
            hit: hitResults.some((r) => r.hit),
            direct: hitResults.some((r) => r.direct),
            fatal: hitResults.some((r) => r.fatal),
            damage: totalDamage,
            targetHpAfter: enemies[firstTargetIdx]?.currentHp ?? 0,
            mpRecovery: 0,
            playerHpAfter: party[0]?.currentHp ?? 0,
            playerMpAfter: party[0]?.currentMp ?? 0,
            enemyHpAfter,
            enemyMpAfter,
            partyHpAfter: snapAfter.partyHp,
            partyMpAfter: snapAfter.partyMp,
            tacticSlotOrder: action.matchedOrderIndex,
            tacticSlotSkippedDueToCt: action.skippedDueToCt,
            logMessage: skill.logMessage ?? undefined,
            logMessageOnCondition: skill.logMessageOnCondition ?? undefined,
            conditionMet,
            triggeredAttr,
            hitDetails: hitDetails.length > 0 ? hitDetails : undefined,
            ...snapshotPositions(partyPositions, currentEnemyPositions),
          });
          applyCooldownEndOfTurn(actorIndex);
        } else {
          const targetIdx = pickEnemyTarget(enemies, currentEnemyPositions, enemyAlive);
          if (!enemyAlive[targetIdx]) {
            applyCooldownEndOfTurn(actorIndex);
            continue;
          }
          const result = resolveDamage(
          actor,
          enemies[targetIdx],
          "physical",
          1.0,
          fatigue,
          partyBuffs[actorIndex],
          undefined,
          partyDebuffs[actorIndex],
          enemyDebuffs[targetIdx],
          undefined,
          enemyResistances[targetIdx]
        );
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
            tacticSlotOrder: action.matchedOrderIndex,
            tacticSlotSkippedDueToCt: action.skippedDueToCt,
            ...snapshotPositions(partyPositions, currentEnemyPositions),
          });
          if (enemies[targetIdx].currentHp <= 0) enemyAlive[targetIdx] = false;
          applyCooldownEndOfTurn(actorIndex);
        }
      } else {
        const enemyIdx = slot.index;
        if (enemyIdx >= ENEMY_COUNT || !enemyAlive[enemyIdx] || enemies[enemyIdx].currentHp <= 0) continue;

        const targetPartyIdx = pickPartyTarget(partyAlive);
        if (!partyAlive[targetPartyIdx] || party[targetPartyIdx].currentHp <= 0) continue;

        const result = resolveDamage(
        enemies[enemyIdx],
        party[targetPartyIdx],
        "physical",
        1.0,
        fatigue,
        undefined,
        partyBuffs[targetPartyIdx],
        enemyDebuffs[enemyIdx],
        partyDebuffs[targetPartyIdx],
        undefined,
        partyAttributeResistances[targetPartyIdx]
      );
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
          ...snapshotPositions(partyPositions, currentEnemyPositions),
        });
        if (party[targetPartyIdx].currentHp <= 0) {
          partyAlive[targetPartyIdx] = false;
          chargeReservation[targetPartyIdx] = null;
        }
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

    // Phase 3: サイクル終了時に属性状態の残りサイクルを 1 減算
    tickAttrStates(partyAttrStates, enemyAttrStates);
    // Phase 4: デバフ持続を 1 減算
    tickDebuffs(partyDebuffs, enemyDebuffs);
    // Phase 7: バフ持続を 1 減算
    tickBuffs(partyBuffs);

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
    enemyPositions: currentEnemyPositions,
  };
}
