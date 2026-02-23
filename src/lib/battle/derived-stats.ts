/**
 * spec/020_test_battle.md, docs/10_battle_calc_formulas.md, docs/10_battle_status.csv 準拠
 * 基礎ステータス → 派生ステータス（戦闘用）の算出
 *
 * CSV の列順: STR, INT, VIT, WIS, DEX, AGI, LUK（7種）。合計上限が CAP。
 */

/** 戦闘計算に渡す基礎ステータス（キャラ・敵とも同じ形で渡す） */
export interface BaseStats {
  STR: number;
  INT: number;
  VIT: number;
  WIS: number;
  DEX: number;
  AGI: number;
  LUK: number;
  CAP: number;
}

/** 算出した派生ステータス（戦闘で使用） */
export interface DerivedStats {
  HP: number;
  MP: number;
  /** 物理攻撃 */
  PATK: number;
  /** 魔法攻撃 */
  MATK: number;
  /** 物理防御 */
  PDEF: number;
  /** 魔法防御 */
  MDEF: number;
  /** 命中力 */
  HIT: number;
  /** 速度（回避）EVA */
  EVA: number;
  /** 運（派生値）。LuckPoint = 12 * base.LUK で別計算 */
  LUCK: number;
}

/**
 * docs/10_battle_status.csv ベース表（2〜10行目）の係数
 * 行: HP, MP, 物理攻撃, 魔法攻撃, 物理防御, 魔法防御, 命中力, 速度（回避）, 運
 * 列: STR, INT, VIT, WIS, DEX, AGI, LUK
 */
const COEF: number[][] = [
  [11, 7, 12, 7, 4, 8, 2],       // HP
  [0, 2, 1, 5, 2, 1, 1],         // MP
  [7, 0, 0, 0, 3, 1, 1],         // 物理攻撃
  [0, 8, 0, 1, 1, 1, 1],         // 魔法攻撃
  [1, 0, 7, 0, 1, 2, 1],         // 物理防御
  [0, 1, 1, 7, 1, 1, 1],         // 魔法防御
  [0, 3, 0, 0, 7, 1, 1],         // 命中力
  [2, 0, 0, 1, 2, 6, 1],         // 速度（回避）
  [0, 0, 0, 0, 0, 0, 12],        // 運
];

/**
 * 基礎ステータスから派生ステータスを算出する。
 * CSV 列順: STR, INT, VIT, WIS, DEX, AGI, LUK。
 */
export function computeDerivedStats(base: BaseStats): DerivedStats {
  const v = [base.STR, base.INT, base.VIT, base.WIS, base.DEX, base.AGI, base.LUK];
  return {
    HP: dot(COEF[0], v),
    MP: dot(COEF[1], v),
    PATK: dot(COEF[2], v),
    MATK: dot(COEF[3], v),
    PDEF: dot(COEF[4], v),
    MDEF: dot(COEF[5], v),
    HIT: dot(COEF[6], v),
    EVA: dot(COEF[7], v),
    LUCK: dot(COEF[8], v),
  };
}

/** 運ポイント（直撃・致命用）。LuckPoint = 12 * LUK（基礎） */
export function luckPoint(base: BaseStats): number {
  return 12 * base.LUK;
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
