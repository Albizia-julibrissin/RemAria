/**
 * パーティ（1～3人）＋作戦スロット＋スキル対応の戦闘ループ
 * docs/10_battle_calc_formulas.md（物理/魔法防御の別）、spec/038, 039 準拠
 */

import type { BaseStats } from "./derived-stats";
import type { DerivedStats } from "./derived-stats";
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
  BATTLE_MITIGATION_K,
} from "./battle-constants";
import {
  evaluateTactics as evaluateTacticsFromSpec,
  type TacticAction,
  type TacticEvaluationContext,
  type TacticSlotForEval,
} from "./tactic-evaluation";


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
  /** docs/073: 遺物パッシブ効果（effectType + param）。戦闘で最終ダメージ倍率・検証ログ用。 */
  relicPassiveEffects?: { effectType: string; param: Record<string, unknown> }[];
  /** spec/071: 装備の派生戦闘ステ加算。未指定時は加算なし。 */
  derivedBonus?: Partial<DerivedStats>;
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
  relicPassiveEffects: { effectType: string; param: Record<string, unknown> }[];
}

/** 敵が作戦・スキルを持つ場合（テスト用スライムの前進突撃など） */
interface EnemyFighter extends FighterState {
  tacticSlots?: TacticSlotInput[];
  skills?: Record<string, SkillDataForBattle>;
}

/** spec/050: 体ごとの敵入力（1～3体）。未使用枠は作らない。 */
export interface EnemyInput {
  base: BaseStats;
  tacticSlots: TacticSlotInput[];
  skills: Record<string, SkillDataForBattle>;
  displayName?: string;
  iconFilename?: string | null;
  position: BattlePosition;
  /** docs/054: クエスト進捗用。探索戦闘で渡すと撃破時に defeatedEnemyIds に含まれる。 */
  enemyId?: string;
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
    /** 遺物適用前ダメージ（検証ログ。NEXT_PUBLIC_SHOW_VERIFICATION_LOG 時のみ表示） */
    relicDamageBefore?: number;
    /** 遺物倍率の説明（同上） */
    relicDamageNote?: string;
  }[];
  /** 遺物適用前ダメージ（単一ヒット時。検証ログ。NEXT_PUBLIC_SHOW_VERIFICATION_LOG 時のみ表示） */
  relicDamageBefore?: number;
  /** 遺物倍率の説明（単一ヒット時。同上） */
  relicDamageNote?: string;
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
  /** Phase 6: 出血持ちが物理スキルで与ダメ後に受けた自己負けダメージ（ログで「出血の反動でXダメージ」表示用） */
  bleedingSelfDamage?: number;
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
  /** spec/050: 敵の表示名（enemyInputs の順）。未指定時は "敵" */
  enemyDisplayNames: string[];
  /** spec/050: 敵のアイコンファイル名（enemyInputs の順）。未設定時は null */
  enemyIconFilenames: (string | null)[];
  playerMaxHp: number;
  playerMaxMp: number;
  /** 敵ごとの最大HP（enemyInputs の順） */
  enemyMaxHp: number[];
  /** 敵ごとの最大MP（enemyInputs の順） */
  enemyMaxMp: number[];
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

/** docs/073: 遺物パッシブの最終ダメージ倍率と検証ログ用メモを算出。 */
function computeRelicDamageMultAndNote(
  relicPassiveEffects: { effectType: string; param: Record<string, unknown> }[],
  attackType: "physical" | "magic",
  skillAttribute?: string
): { mult: number; note: string } {
  let mult = 1;
  const parts: string[] = [];
  for (const e of relicPassiveEffects) {
    if (e.effectType === "final_physical_damage_pct" && attackType === "physical") {
      const pct = Number(e.param?.pct) || 0;
      if (pct !== 0) {
        mult *= 1 + pct / 100;
        parts.push(`物理+${pct}%`);
      }
    } else if (e.effectType === "final_magic_damage_pct" && attackType === "magic") {
      const pct = Number(e.param?.pct) || 0;
      if (pct !== 0) {
        mult *= 1 + pct / 100;
        parts.push(`魔法+${pct}%`);
      }
    } else if (e.effectType === "final_attribute_damage_pct" && skillAttribute && e.param?.attribute === skillAttribute) {
      const pct = Number(e.param?.pct) || 0;
      if (pct !== 0) {
        mult *= 1 + pct / 100;
        parts.push(`${skillAttribute}+${pct}%`);
      }
    }
  }
  const note = parts.length > 0 ? `遺物: ${parts.join(" ")} (×${mult.toFixed(3)})` : "";
  return { mult, note };
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

/** Phase 5: デバフコード別のデフォルト statMult（麻痺＝EVA半減など）。付与時に未指定ならここを参照 */
const DEBUFF_STAT_MULT_BY_CODE: Record<string, Record<string, number>> = {
  paralysis: { EVA: 0.5 },
  accuracy_down: { HIT: 0.8 },
};

/** Phase 7: 毒デバフの DoT 割合（ターン開始時・現在HPのこの割合でダメージ）。HP0にしない処理は DoT 適用箇所で実施 */
const POISON_DOT_PCT = 0.05;

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

const BATTLE_ALPHA = 0.2;

function turnWeight(derived: { EVA: number }, base: BaseStats): number {
  return Math.sqrt(derived.EVA) * (1 + BATTLE_ALPHA * (base.LUK / 7));
}

/** 行動順用：EVA にデバフ乗数を適用したうえで重みを算出（麻痺で速度半減を反映） */
function turnWeightWithDebuffs(
  derived: { EVA: number },
  base: BaseStats,
  debuffs: DebuffEntry[]
): number {
  const eva = derived.EVA * (debuffs?.length ? getDebuffStatMult(debuffs, "EVA") : 1);
  return Math.sqrt(eva) * (1 + BATTLE_ALPHA * (base.LUK / 7));
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

/** 物理なら PDEF、魔法なら MDEF で減衰。Phase 7: バフ。Phase 8: デバフ。Phase 10: 属性耐性で最終ダメージを乗算。Phase 4: forceDirect 時は直撃を強制し致命は通常確率。 */
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
  defenderResistances?: AttributeResistances,
  /** Phase 4: true なら命中時に直撃を強制。致命は通常確率で判定。 */
  forceDirect?: boolean
): { hit: boolean; direct: boolean; fatal: boolean; damage: number } {
  const aDerived = attacker.derived as unknown as Record<string, number>;
  const dDerived = defender.derived as unknown as Record<string, number>;
  let hitStat = (attackerBuffs?.length ? getBuffedStat(aDerived, attackerBuffs, "HIT") : attacker.derived.HIT) as number;
  hitStat *= attackerDebuffs?.length ? getDebuffStatMult(attackerDebuffs, "HIT") : 1;
  let evaStat = (defenderBuffs?.length ? getBuffedStat(dDerived, defenderBuffs, "EVA") : defender.derived.EVA) as number;
  evaStat *= defenderDebuffs?.length ? getDebuffStatMult(defenderDebuffs, "EVA") : 1;
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
    direct = forceDirect ? true : Math.random() < pDir;
    if (direct) {
      fatal = Math.random() < pFatalGivenDirect(pDir);
      if (fatal) defEffective *= 0.5;
    }
    const randDef = randomFloat(BATTLE_DAMAGE_RAND_DEF_MIN, BATTLE_DAMAGE_RAND_DEF_MAX);
    defEffective *= randDef;
    const denom = BATTLE_MITIGATION_K * defender.base.CAP;
    const mitigation = denom <= 0 ? 1 : denom / (denom + defEffective);
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
  const dDerived = defender.derived as unknown as Record<string, number>;
  const defStatName = attackType === "physical" ? "PDEF" : "MDEF";
  const defRaw = defenderBuffs?.length
    ? getBuffedStat(dDerived, defenderBuffs, defStatName)
    : (attackType === "physical" ? defender.derived.PDEF : defender.derived.MDEF);
  const randDef = randomFloat(BATTLE_DAMAGE_RAND_DEF_MIN, BATTLE_DAMAGE_RAND_DEF_MAX);
  const defEffective = defRaw * randDef;
  const denom = BATTLE_MITIGATION_K * defender.base.CAP;
  const mitigation = denom <= 0 ? 1 : denom / (denom + defEffective);
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
  return best >= 0 ? best : party.findIndex((_, i) => partyAlive[i] && party[i].currentHp > 0);
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

/** 生存している敵から列ウェイトでターゲットを1体抽選。useEqualWeight 時は列ウェイト無視で均等抽選。 */
function pickEnemyTarget(
  enemies: FighterState[],
  positions: BattlePosition[],
  alive: boolean[],
  weightAdd?: SkillColumnWeightAdd,
  allowedIndices?: number[] | null,
  useEqualWeight?: boolean
): number {
  const n = positions.length;
  const pool = allowedIndices?.length
    ? allowedIndices.filter((i) => i >= 0 && i < n && alive[i])
    : Array.from({ length: n }, (_, i) => i).filter((i) => alive[i]);
  if (pool.length === 0) return 0;
  if (useEqualWeight) return pool[Math.floor(Math.random() * pool.length)]!;
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

/** 行動順：パーティ1～3人＋敵3体を速度重みで抽選。デバフ（麻痺＝EVA半減）を反映。 */
function buildTurnOrder(
  party: PartyFighter[],
  enemies: FighterState[],
  partyAlive: boolean[],
  enemyAlive: boolean[],
  partyDebuffs: DebuffEntry[][],
  enemyDebuffs: DebuffEntry[][]
): TurnSlot[] {
  const pool: TurnSlot[] = [];
  for (let i = 0; i < party.length; i++) if (partyAlive[i]) pool.push({ kind: "p", index: i });
  for (let i = 0; i < enemies.length; i++) if (enemyAlive[i]) pool.push({ kind: "e", index: i });

  const getWeight = (s: TurnSlot): number => {
    if (s.kind === "p")
      return turnWeightWithDebuffs(
        party[s.index].derived,
        party[s.index].base,
        partyDebuffs[s.index] ?? []
      );
    return turnWeightWithDebuffs(
      enemies[s.index].derived,
      enemies[s.index].base,
      enemyDebuffs[s.index] ?? []
    );
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
  /** spec/050: 敵を体ごとに渡す（1～3体）。未使用枠は作らない。 */
  enemyInputs: EnemyInput[],
  /** 戦闘開始時の味方の列位置。省略時は defaultPartyPositions。長さが party と一致する場合のみ使用 */
  initialPartyPositions?: BattlePosition[],
  /** Phase 10: 敵ごとの属性耐性。長さは enemyInputs.length。未指定時は全員耐性なし。 */
  enemyAttributeResistances?: AttributeResistances[],
  /** 探索などで HP/MP を引き継ぐときの初期値。未指定または 0 の場合は最大値から開始。partyInput と同じ順番を想定。 */
  initialPartyHpMp?: { currentHp: number; currentMp: number }[]
): BattleResultWithParty {
  if (partyInput.length === 0) {
    throw new Error("runBattleWithParty: party must have at least 1 member");
  }
  if (enemyInputs.length === 0 || enemyInputs.length > 3) {
    throw new Error("runBattleWithParty: enemyInputs must have 1 to 3 elements");
  }
  const enemyCount = enemyInputs.length;

  const party: PartyFighter[] = partyInput.map((p, idx) => {
    let derived: DerivedStats = computeDerivedStats(p.base);
    if (p.derivedBonus && Object.keys(p.derivedBonus).length > 0) {
      const bonus = p.derivedBonus;
      derived = {
        HP: derived.HP + (bonus.HP ?? 0),
        MP: derived.MP + (bonus.MP ?? 0),
        PATK: derived.PATK + (bonus.PATK ?? 0),
        MATK: derived.MATK + (bonus.MATK ?? 0),
        PDEF: derived.PDEF + (bonus.PDEF ?? 0),
        MDEF: derived.MDEF + (bonus.MDEF ?? 0),
        HIT: derived.HIT + (bonus.HIT ?? 0),
        EVA: derived.EVA + (bonus.EVA ?? 0),
        LUCK: derived.LUCK + (bonus.LUCK ?? 0),
      };
    }
    const override = initialPartyHpMp?.[idx];
    const startHp =
      override && override.currentHp >= 0
        ? Math.min(derived.HP, override.currentHp)
        : derived.HP;
    const startMp =
      override && override.currentMp >= 0
        ? Math.min(derived.MP, override.currentMp)
        : derived.MP;
    return {
      displayName: p.displayName,
      base: p.base,
      derived,
      currentHp: startHp,
      currentMp: startMp,
      tacticSlots: p.tacticSlots,
      skills: p.skills,
      relicPassiveEffects: p.relicPassiveEffects ?? [],
    };
  });

  /** Phase 10: 味方ごとの属性耐性。現状は partyInput からそのまま渡す（装備・遺物未実装のため空）。 */
  const partyAttributeResistances: AttributeResistances[] = partyInput.map(
    (p) => p.attributeResistances ?? {}
  );

  const enemies: EnemyFighter[] = enemyInputs.map((input) => {
    const derived = computeDerivedStats(input.base);
    return {
      base: input.base,
      derived,
      currentHp: derived.HP,
      currentMp: derived.MP,
      tacticSlots: input.tacticSlots,
      skills: input.skills,
    };
  });

  /** Phase 10: 敵ごとの属性耐性。未指定時は全員空（耐性なし）。 */
  const enemyResistances: AttributeResistances[] =
    enemyAttributeResistances && enemyAttributeResistances.length >= enemyCount
      ? enemyAttributeResistances.slice(0, enemyCount)
      : Array.from({ length: enemyCount }, () => ({}));

  const partyAlive = party.map(() => true);
  const enemyAlive = Array.from({ length: enemyCount }, () => true);

  // 戦闘開始時点で HP が 0 以下の味方は戦闘不能扱いとし、行動・回復対象から除外する
  for (let i = 0; i < party.length; i++) {
    if (party[i].currentHp <= 0) {
      partyAlive[i] = false;
    }
  }
  const log: BattleLogEntryWithParty[] = [];
  let totalCycles = 0;
  let winner: "player" | "enemy" | "draw" = "draw";
  const partyPositions: BattlePosition[] =
    initialPartyPositions && initialPartyPositions.length === party.length
      ? initialPartyPositions.map((p) => ({ row: p.row, col: p.col }))
      : defaultPartyPositions(party.length);
  /** Phase 2: 列移動を反映するため敵位置はループ内で更新可能なコピーを使用 */
  const currentEnemyPositions: BattlePosition[] = enemyInputs.map((input) => ({ row: input.position.row, col: input.position.col }));

  /** Phase 3: 属性状態。味方・敵ごとに { attr, remainingCycles }[]。サイクル終了時に tick で減算 */
  const partyAttrStates: AttrStateEntry[][] = Array.from({ length: party.length }, () => []);
  const enemyAttrStates: AttrStateEntry[][] = Array.from({ length: enemyCount }, () => []);

  /** Phase 4: デバフ。味方・敵ごとに { code, remainingCycles }[]。サイクル終了時に tick */
  const partyDebuffs: DebuffEntry[][] = Array.from({ length: party.length }, () => []);
  const enemyDebuffs: DebuffEntry[][] = Array.from({ length: enemyCount }, () => []);

  /** Phase 7: バフ。味方ごとに { stat, pct, remainingCycles }[]。サイクル終了時に tick */
  const partyBuffs: BuffEntry[][] = Array.from({ length: party.length }, () => []);

  /** Phase 9: 溜め予約。味方ごとに { skillId, remainingCycles } | null。死亡で破棄 */
  const chargeReservation: ({ skillId: string; remainingCycles: number } | null)[] = Array.from(
    { length: party.length },
    () => null
  );

  /** 戦闘不能（瀕死）になった味方 1 体の状態を整理する（行動不可・ターゲット外・状態異常リセット） */
  function handlePartyDeath(index: number): void {
    if (index < 0 || index >= party.length) return;
    partyAlive[index] = false;
    chargeReservation[index] = null;
    partyAttrStates[index] = [];
    partyDebuffs[index] = [];
    partyBuffs[index] = [];
  }

  /** 戦闘不能になった敵 1 体の状態を整理する（行動不可・ターゲット外・状態異常リセット） */
  function handleEnemyDeath(index: number): void {
    if (index < 0 || index >= enemyCount) return;
    enemyAlive[index] = false;
    enemyAttrStates[index] = [];
    enemyDebuffs[index] = [];
  }

  /** docs/023 方式B: 味方ごとの残りクール。partyCooldowns[i][skillId] = 残りサイクル数 */
  const partyCooldowns: Record<string, number>[] = Array.from({ length: party.length }, () => ({}));
  /** docs/023 方式B: このターンで使ったスキル（CT 付与用）。ターン終了処理後にクリア */
  const skillUsedThisTurnByPartyIndex: ({ skillId: string; cooldownCycles: number } | null)[] = Array.from(
    { length: party.length },
    () => null
  );
  /** 敵が作戦・スキルを持つ場合のクールダウン。enemyCooldowns[i][skillId] = 残りサイクル数 */
  const enemyCooldowns: Record<string, number>[] = Array.from({ length: enemyCount }, () => ({}));
  const enemySkillUsedThisTurn: ({ skillId: string; cooldownCycles: number } | null)[] = Array.from(
    { length: enemyCount },
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

  /** 敵が作戦・スキルを持つ場合のターン終了時。CT を 1 減算し、このターンで使ったスキルに CT をセット */
  function applyEnemyCooldownEndOfTurn(enemyIndex: number): void {
    const cooldowns = enemyCooldowns[enemyIndex];
    for (const skillId of Object.keys(cooldowns)) {
      const next = Math.max(0, cooldowns[skillId]! - 1);
      if (next <= 0) delete cooldowns[skillId];
      else cooldowns[skillId] = next;
    }
    const used = enemySkillUsedThisTurn[enemyIndex];
    if (used && used.cooldownCycles > 0) cooldowns[used.skillId] = used.cooldownCycles;
    enemySkillUsedThisTurn[enemyIndex] = null;
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

    const order = buildTurnOrder(party, enemies, partyAlive, enemyAlive, partyDebuffs, enemyDebuffs);
    let turnIndex = 0;

    slotLoop: for (const slot of order) {
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
            // Phase 7: 毒デバフはこの効果ではHPを0にしない（最低1）
            const minHp = d.code === "poison" ? 1 : 0;
            unit.currentHp = Math.max(minHp, unit.currentHp - dmg);
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
              handlePartyDeath(idx);
              if (party.every((p, i) => !partyAlive[i] || p.currentHp <= 0)) {
                winner = "enemy";
                break slotLoop;
              }
            }
          }
        }
      } else {
        const idx = slot.index;
        if (idx < enemyCount && enemyAlive[idx] && enemies[idx].currentHp > 0) {
          const unitDebuffs = enemyDebuffs[idx];
          for (const d of unitDebuffs) {
            if (d.remainingCycles <= 0 || !d.dotKind || d.dotPct == null) continue;
            const unit = enemies[idx];
            const dmg =
              d.dotKind === "record_pct"
                ? Math.floor((d.recordDamage ?? 0) * d.dotPct)
                : Math.max(0, Math.floor(unit.currentHp * d.dotPct));
            if (dmg <= 0) continue;
            // Phase 7: 毒デバフはこの効果ではHPを0にしない（最低1）
            const minHp = d.code === "poison" ? 1 : 0;
            unit.currentHp = Math.max(minHp, unit.currentHp - dmg);
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
            if (unit.currentHp <= 0) {
              handleEnemyDeath(idx);
              if (enemyAlive.every((a) => !a)) {
                winner = "player";
                break slotLoop;
              }
            }
          }
        }
      }

      if (slot.kind === "p") {
        const actorIndex = slot.index;
        if (actorIndex >= party.length || !partyAlive[actorIndex] || party[actorIndex].currentHp <= 0) {
          handlePartyDeath(actorIndex);
          applyCooldownEndOfTurn(actorIndex);
          continue;
        }

        const actor = party[actorIndex];
        for (const e of actor.relicPassiveEffects) {
          if (e.effectType === "hp_regen_per_turn") {
            const amount = Math.max(0, Math.floor(Number(e.param?.amount) ?? 0));
            if (amount > 0) actor.currentHp = Math.min(actor.derived.HP, actor.currentHp + amount);
          }
        }
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

          // Phase 6/7/8: ally_single / ally_all / self — 回復・解除・バフ（敵への攻撃は行わない）
          const targetScope = skill.targetScope ?? "enemy_single";
          if (targetScope === "ally_single" || targetScope === "ally_all" || targetScope === "self") {
            const effects = skill.effects ?? [];
            // Phase 8: ally_single で heal_single(targetSelection=lowest_hp_percent) または dispel_attr_states がある場合はHP割合最低の1体
            const useLowestHpPct =
              targetScope === "ally_single" &&
              effects.some(
                (e) =>
                  (e.effectType === "heal_single" &&
                    (e.param as { targetSelection?: string })?.targetSelection === "lowest_hp_percent") ||
                  e.effectType === "dispel_attr_states"
              );
            const targets: number[] =
              targetScope === "self"
                ? [actorIndex]
                : targetScope === "ally_single"
                ? (() => {
                    const i = useLowestHpPct
                      ? pickAllyTargetSingle(party, partyAlive)
                    : party.findIndex((_, idx) => partyAlive[idx] && party[idx].currentHp > 0);
                    return i >= 0 ? [i] : [];
                  })()
              : party.map((_, i) => i).filter((i) => partyAlive[i] && party[i].currentHp > 0);
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
                  if (!partyAlive[targets[0]] || m.currentHp <= 0) {
                    continue;
                  }
                  const prev = m.currentHp;
                  m.currentHp = Math.min(m.derived.HP, m.currentHp + Math.floor(amount));
                  totalHealAmount += m.currentHp - prev;
                }
              }
              if (e.effectType === "heal_all" && e.param && typeof e.param === "object") {
                const p = e.param as { scale?: string; randMin?: number; randMax?: number };
                let amount = resolveHealScale(p.scale ?? "", actor);
                // Phase 2: 回復乱数（randMin～randMax を1回だけ掛け、味方全員に同じ量を適用）
                if (amount > 0 && p.randMin != null && p.randMax != null) {
                  const rMin = Number(p.randMin);
                  const rMax = Number(p.randMax);
                  if (rMin <= rMax) {
                    const t = rMin + Math.random() * (rMax - rMin);
                    amount = amount * t;
                  }
                }
                if (amount > 0) {
                  isHealAll = true;
                  const floorAmount = Math.floor(amount);
                  for (let i = 0; i < party.length; i++) {
                    if (!partyAlive[i] || party[i].currentHp <= 0) continue;
                    const m = party[i];
                    const prev = m.currentHp;
                    m.currentHp = Math.min(m.derived.HP, m.currentHp + floorAmount);
                    totalHealAmount += m.currentHp - prev;
                  }
                }
              }
            }
            // Phase 8: dispel_attr_states — 対象の属性状態を全て解除（状態異常は触れない）。chance で確率判定
            for (const e of effects) {
              if (e.effectType !== "dispel_attr_states" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as { chance?: number };
              const chance = p.chance != null ? Number(p.chance) : 1;
              if (Math.random() >= chance) continue;
              for (const targetIdx of targets) {
                partyAttrStates[targetIdx] = [];
              }
              break;
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
          const hitCount = randomInt(Math.max(1, hitsMin), Math.max(1, hitsMax));
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
          const hitDetails: {
            damage: number;
            hit: boolean;
            direct: boolean;
            fatal: boolean;
            targetEnemyIndex: number;
            attrApplied?: string;
            splashDamagePerEnemy?: number[];
            triggeredAttr?: string;
            debuffApplied?: string;
          }[] = [];
          const attackType = skill.battleSkillType === "magic" ? "magic" : "physical";
          // Phase 8: 毒霧・萎縮など apply_debuff のみのスキルはダメージ 0
          const powerMult = skill.powerMultiplier ?? 1.0;
          const effects = skill.effects ?? [];
          // Phase 7: 列ウェイト無視（均等抽選）。effect で指定されていれば敵単体抽選を均等に
          const useEqualTargetWeight = effects.some((e) => e.effectType === "target_select_equal_weight");

          // 列指定攻撃（damage_target_columns）: 指定列にいる敵全員にダメージ。targetColumns=[1,2,3] で全体攻撃
          // targetScope: enemy_all のみのときも敵全体を対象にする（027 #23）
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
              for (let i = 0; i < enemyCount; i++) {
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
          if (targetScope === "enemy_all" && columnTargetIndices === null) {
            columnTargetIndices = [];
            for (let i = 0; i < enemyCount; i++) {
              if (enemyAlive[i]) columnTargetIndices.push(i);
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
                        columnTargetIndices,
                        useEqualTargetWeight
                      )
                    : resampleTargetPerHit || h === 0
                      ? pickEnemyTarget(
                          enemies,
                          currentEnemyPositions,
                          enemyAlive,
                          weightAdd,
                          undefined,
                          useEqualTargetWeight
                        )
                      : firstTargetIdx,
                ];
            if (targetsThisHit.length > 0 && !isColumnAll) firstTargetIdx = targetsThisHit[0];

            for (const targetIdx of targetsThisHit) {
              if (!enemyAlive[targetIdx]) continue;
              let thisHitTriggeredAttr: string | undefined;
              let thisHitDebuffApplied: string | undefined;
              // Phase 4: attr_state_force_direct — 対象が指定属性状態なら直撃を強制（致命は通常確率）
              let forceDirect = false;
              for (const e of effects) {
                if (e.effectType !== "attr_state_force_direct" || !e.param || typeof e.param !== "object") continue;
                const p = e.param as { triggerAttr?: string };
                const triggerAttr = p.triggerAttr as string | undefined;
                if (triggerAttr && hasAttrState(enemyAttrStates[targetIdx], triggerAttr)) {
                  forceDirect = true;
                  conditionMet = true;
                  if (triggeredAttr === undefined) triggeredAttr = triggerAttr;
                  thisHitTriggeredAttr = triggerAttr; // ログで「〇〇決壊！」および条件達成メッセージ用
                  break;
                }
              }
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
              enemyResistances[targetIdx],
              forceDirect
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

            const relicMult = computeRelicDamageMultAndNote(
              actor.relicPassiveEffects,
              attackType,
              skill.attribute ?? undefined
            );
            const damageBeforeRelic = relicMult.note ? finalDmg : undefined;
            if (relicMult.mult !== 1) finalDmg = Math.floor(finalDmg * relicMult.mult);

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
              for (let i = 0; i < enemyCount; i++) {
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
              const p = e.param as {
                triggerAttr?: string;
                chance?: number;
                debuffCode?: string;
                durationCycles?: number;
                recordDamagePct?: number;
              };
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

            // Phase 5: attr_state_trigger_debuff — 対象が指定属性状態なら必ずデバフ付与し属性状態を消費（麻痺・毒など）
            for (const e of effects) {
              if (e.effectType !== "attr_state_trigger_debuff" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as { triggerAttr?: string; debuffCode?: string; durationCycles?: number; statMult?: Record<string, number> };
              const triggerAttr = p.triggerAttr as string | undefined;
              if (!triggerAttr || !hasAttrState(enemyAttrStates[targetIdx], triggerAttr)) continue;
              const code = (p.debuffCode as string) || "unknown";
              const duration = Math.max(0, Number(p.durationCycles) ?? 0);
              const statMult = p.statMult ?? DEBUFF_STAT_MULT_BY_CODE[code];
              const meta: Parameters<typeof addDebuff>[3] = {};
              if (statMult) meta.statMult = statMult;
              if (code === "poison") {
                meta.dotKind = "current_hp_pct";
                meta.dotPct = POISON_DOT_PCT;
              }
              addDebuff(enemyDebuffs[targetIdx], code, duration, Object.keys(meta).length > 0 ? meta : undefined);
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
              for (let i = 0; i < enemyCount; i++) {
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

            // Phase 8: apply_debuff — 毒霧・萎縮の呪いなど。敵にデバフを付与（Phase 3: targetScope: enemy_all なら敵全員に1回だけ）
            for (const e of effects) {
              if (e.effectType !== "apply_debuff" || !e.param || typeof e.param !== "object") continue;
              const p = e.param as {
                debuffCode?: string;
                durationCycles?: number;
                damageKind?: string;
                pct?: number;
                statMult?: Record<string, number>;
                targetScope?: string;
              };
              const code = (p.debuffCode as string) || "unknown";
              const duration = Math.max(0, Number(p.durationCycles) ?? 0);
              const meta: Parameters<typeof addDebuff>[3] = {};
              if (p.damageKind === "current_hp_pct" && p.pct != null) {
                meta.dotKind = "current_hp_pct";
                meta.dotPct = Number(p.pct);
              }
              if (p.statMult && typeof p.statMult === "object") meta.statMult = p.statMult;
              if (p.targetScope === "enemy_all") {
                // 敵全員に1回だけ適用（同じヒット内で複数ターゲットに重複適用しない）
                if (targetIdx === targetsThisHit[0]) {
                  for (let i = 0; i < enemyCount; i++) {
                    if (enemyAlive[i]) addDebuff(enemyDebuffs[i], code, duration, meta);
                  }
                }
              } else {
                addDebuff(enemyDebuffs[targetIdx], code, duration, meta);
              }
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
              ...(damageBeforeRelic != null && relicMult.note
                ? { relicDamageBefore: damageBeforeRelic, relicDamageNote: relicMult.note }
                : {}),
            });
            // Phase 2: ヒット時のみ move_target_column を適用（命中していない敵には列移動しない。Phase 1: chance 指定時は確率で適用）
            if (result.hit) {
              for (const e of effects) {
                if (e.effectType === "move_target_column" && e.param && typeof e.param === "object") {
                  const p = e.param as Record<string, unknown>;
                  const chance = p.chance != null ? Number(p.chance) : 1;
                  if (chance >= 1 || Math.random() < chance) {
                    applyMoveColumn(currentEnemyPositions[targetIdx], p);
                  }
                }
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
          for (let i = 0; i < enemyCount; i++) {
            if (enemies[i].currentHp <= 0) handleEnemyDeath(i);
          }

          // Phase 6: 出血デバフ — 物理スキルで与ダメ後、行動者が出血持ちなら合計与ダメの20%を自己に与え、出血を解除
          let bleedingSelfDamage = 0;
          if (
            attackType === "physical" &&
            totalDamage > 0 &&
            (partyDebuffs[actorIndex] ?? []).some((d) => d.code === "bleeding" && d.remainingCycles > 0)
          ) {
            bleedingSelfDamage = Math.floor(totalDamage * 0.2);
            actor.currentHp = Math.max(0, actor.currentHp - bleedingSelfDamage);
            partyDebuffs[actorIndex] = (partyDebuffs[actorIndex] ?? []).filter((d) => d.code !== "bleeding");
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
            ...(bleedingSelfDamage > 0 ? { bleedingSelfDamage } : {}),
            ...snapshotPositions(partyPositions, currentEnemyPositions),
          });
          if (actor.currentHp <= 0) {
            handlePartyDeath(actorIndex);
          }
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
          const normalRelicMult = computeRelicDamageMultAndNote(actor.relicPassiveEffects, "physical", undefined);
          const normalFinalDmg =
            normalRelicMult.mult !== 1 ? Math.floor(result.damage * normalRelicMult.mult) : result.damage;
          enemies[targetIdx].currentHp = Math.max(0, enemies[targetIdx].currentHp - normalFinalDmg);
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
            damage: normalFinalDmg,
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
            ...(normalRelicMult.note
              ? { relicDamageBefore: result.damage, relicDamageNote: normalRelicMult.note }
              : {}),
            ...snapshotPositions(partyPositions, currentEnemyPositions),
          });
          if (enemies[targetIdx].currentHp <= 0) enemyAlive[targetIdx] = false;
          applyCooldownEndOfTurn(actorIndex);
        }
      } else {
        const enemyIdx = slot.index;
        if (enemyIdx >= enemyCount || !enemyAlive[enemyIdx] || enemies[enemyIdx].currentHp <= 0) continue;

        const enemy = enemies[enemyIdx];
        let action: TacticAction = { actionType: "normal_attack", skillId: null };
        if (enemy.tacticSlots?.length && enemy.skills && Object.keys(enemy.skills).length > 0) {
          const tacticCtx: TacticEvaluationContext = {
            cycle,
            turnIndexInCycle: turnIndex,
            actorPartyIndex: enemyIdx,
            party: enemies.map((e, i) => ({
              currentHp: e.currentHp,
              maxHp: e.derived.HP,
              currentMp: e.currentMp,
              maxMp: e.derived.MP,
              attrStates: attrStatesToSnapshot(enemyAttrStates[i] ?? []),
              debuffs: debuffsToSnapshot(enemyDebuffs[i] ?? []),
            })),
            partyAlive: [...enemyAlive],
            enemies: party.map((p, i) => ({
              currentHp: p.currentHp,
              maxHp: p.derived.HP,
              currentMp: p.currentMp,
              maxMp: p.derived.MP,
              attrStates: attrStatesToSnapshot(partyAttrStates[i] ?? []),
              debuffs: debuffsToSnapshot(partyDebuffs[i] ?? []),
            })),
            enemyAlive: [...partyAlive],
            partyPositions: currentEnemyPositions,
            enemyPositions: partyPositions,
          };
          const hasSkill = (skillId: string) => {
            const skill = enemy.skills![skillId];
            return !!skill && enemy.currentMp >= getMpCost(skill, enemy.base.CAP);
          };
          const isSkillOnCooldown = (skillId: string) => (enemyCooldowns[enemyIdx][skillId] ?? 0) > 0;
          action = evaluateTacticsFromSpec(
            toSlotsForEval(enemy.tacticSlots!),
            tacticCtx,
            hasSkill,
            isSkillOnCooldown
          );
        }

        if (action.actionType === "skill" && action.skillId) {
          const skill = enemy.skills?.[action.skillId] as SkillDataForBattle | undefined;
          if (skill && enemy.currentMp >= getMpCost(skill, enemy.base.CAP)) {
            const targetPartyIdx = pickPartyTarget(partyAlive);
            if (partyAlive[targetPartyIdx] && party[targetPartyIdx].currentHp > 0) {
              const attackType = skill.battleSkillType === "magic" ? "magic" : "physical";
              const powerMult = Number(skill.powerMultiplier) || 1;
              const result = resolveDamage(
                enemy,
                party[targetPartyIdx],
                attackType,
                powerMult,
                fatigue,
                undefined,
                partyBuffs[targetPartyIdx],
                enemyDebuffs[enemyIdx],
                partyDebuffs[targetPartyIdx],
                undefined,
                partyAttributeResistances[targetPartyIdx]
              );
              party[targetPartyIdx].currentHp = Math.max(0, party[targetPartyIdx].currentHp - result.damage);
              if (result.hit && skill.attribute && skill.attribute !== "none") {
                addAttrState(partyAttrStates[targetPartyIdx], skill.attribute, DEFAULT_ATTR_DURATION_CYCLES);
              }
              for (const e of skill.effects ?? []) {
                if (e.effectType === "move_self_column" && e.param && typeof e.param === "object") {
                  applyMoveColumn(currentEnemyPositions[enemyIdx], e.param as Record<string, unknown>);
                }
              }
              enemy.currentMp = Math.max(0, enemy.currentMp - getMpCost(skill, enemy.base.CAP));
              const ct = skill.cooldownCycles ?? 0;
              if (ct > 0) enemySkillUsedThisTurn[enemyIdx] = { skillId: action.skillId!, cooldownCycles: ct };
              // Phase 6: 出血デバフ — 敵が物理スキルで与ダメ後、出血持ちなら合計与ダメの20%を自己に与え、出血を解除
              let enemyBleedingSelfDamage = 0;
              if (
                attackType === "physical" &&
                result.damage > 0 &&
                (enemyDebuffs[enemyIdx] ?? []).some((d) => d.code === "bleeding" && d.remainingCycles > 0)
              ) {
                enemyBleedingSelfDamage = Math.floor(result.damage * 0.2);
                enemy.currentHp = Math.max(0, enemy.currentHp - enemyBleedingSelfDamage);
                enemyDebuffs[enemyIdx] = (enemyDebuffs[enemyIdx] ?? []).filter((d) => d.code !== "bleeding");
              }
              const legacy = partyToLegacyPlayer(party);
              const snapParty = snapshotPartyHpMp(party);
              log.push({
                cycle,
                turn: turnIndex,
                attacker: "enemy",
                attackerEnemyIndex: enemyIdx,
                target: "player",
                targetPartyIndex: targetPartyIdx,
                actionType: "skill",
                skillName: skill.name,
                fizzle: false,
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
                logMessage: skill.logMessage ?? undefined,
                tacticSlotOrder: action.matchedOrderIndex,
                tacticSlotSkippedDueToCt: action.skippedDueToCt,
                ...(enemyBleedingSelfDamage > 0 ? { bleedingSelfDamage: enemyBleedingSelfDamage } : {}),
                ...snapshotPositions(partyPositions, currentEnemyPositions),
              });
            if (party[targetPartyIdx].currentHp <= 0) {
              handlePartyDeath(targetPartyIdx);
            }
            if (enemy.currentHp <= 0) handleEnemyDeath(enemyIdx);
              applyEnemyCooldownEndOfTurn(enemyIdx);
              continue;
            }
          }
        }

        const targetPartyIdx = pickPartyTarget(partyAlive);
        if (!partyAlive[targetPartyIdx] || party[targetPartyIdx].currentHp <= 0) continue;

        const result = resolveDamage(
          enemy,
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
          handlePartyDeath(targetPartyIdx);
        }
        applyEnemyCooldownEndOfTurn(enemyIdx);
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

  // サイクル上限で双方に生存者がいる場合: 生き残り数で判定、同数なら残りHP合計で判定
  if (party.some((p, i) => partyAlive[i] && p.currentHp > 0) && enemyAlive.some((a) => a)) {
    const partySurvivors = party.filter((p, i) => partyAlive[i] && p.currentHp > 0).length;
    const enemySurvivors = enemies.filter((e, i) => enemyAlive[i] && e.currentHp > 0).length;
    const partyHpSum = party
      .filter((p, i) => partyAlive[i] && p.currentHp > 0)
      .reduce((acc, p) => acc + p.currentHp, 0);
    const enemyHpSum = enemies
      .filter((e, i) => enemyAlive[i] && e.currentHp > 0)
      .reduce((acc, e) => acc + e.currentHp, 0);
    if (partySurvivors > enemySurvivors) winner = "player";
    else if (enemySurvivors > partySurvivors) winner = "enemy";
    else if (partyHpSum > enemyHpSum) winner = "player";
    else if (enemyHpSum > partyHpSum) winner = "enemy";
    else winner = "draw";
  }

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
      enemyDisplayNames: enemyInputs.map((e) => e.displayName ?? "敵"),
      enemyIconFilenames: enemyInputs.map((e) => e.iconFilename ?? null),
      playerMaxHp: party[0]?.derived.HP ?? 0,
      playerMaxMp: party[0]?.derived.MP ?? 0,
      enemyMaxHp: enemies.map((e) => e.derived.HP),
      enemyMaxMp: enemies.map((e) => e.derived.MP),
    },
    enemyPositions: currentEnemyPositions,
  };
}
