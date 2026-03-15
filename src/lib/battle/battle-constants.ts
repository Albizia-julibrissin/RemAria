/**
 * spec/020_test_battle.md, docs/10_battle_calc_formulas.md 5.4 定数一覧
 */

export const BATTLE_ALPHA = 0.2;       // 行動順
export const BATTLE_BETA = 0.5;        // 命中（回避減衰）
export const BATTLE_D = 0.5;           // 直撃/致命 影響力
export const BATTLE_MAX_CYCLES = 30;
export const BATTLE_FATIGUE_CYCLES_SAFE = 5;   // このサイクルまでは Fatigue=1.0
export const BATTLE_FATIGUE_RATE = 0.04;       // 6サイクル目以降 1 + rate*(cycle-5)
export const BATTLE_MP_RECOVERY_MIN = 6;
export const BATTLE_MP_RECOVERY_MAX = 12;
export const BATTLE_MP_RECOVERY_PCT = 0.02;    // MaxMP * this + random(6,12)
export const BATTLE_DAMAGE_RAND_DEF_MIN = 0.8;
export const BATTLE_DAMAGE_RAND_DEF_MAX = 1.0;
export const BATTLE_DIRECT_MULT = 1.2;
export const BATTLE_FATAL_MULT = 1.2;
/**
 * 防御減衰の CAP 係数 k。
 * docs/10_battle_calc_formulas.md 6.5.1:
 *   Denom_defender(CAP_def) = k * CAP_def
 * 初期値は 1.0。決着速度に応じて微調整する。
 */
export const BATTLE_MITIGATION_K = 1.0;

/**
 * spec/052 §4.3: スキルレベル補正（戦闘への反映）
 * 設計最大レベル。L は 0～この値で cap し、sqrt(L/CAP) で補正を算出。
 */
export const SKILL_LEVEL_CAP = 99;
/** 物理・魔法: L=0→1.00, L=CAP→この倍率。式は 1 + (MULT_AT_CAP - 1) * sqrt(L/CAP)。 */
export const SKILL_LEVEL_DAMAGE_MULT_AT_CAP = 1.1;
/** 物理・魔法: L=CAP のときの消費MP倍率（0.9 = 10%軽減）。 */
export const SKILL_LEVEL_MP_FACTOR_AT_CAP_PHYSICAL_MAGIC = 0.9;
/** 補助: L=CAP のときの消費MP倍率（0.8 = 20%軽減）。 */
export const SKILL_LEVEL_MP_FACTOR_AT_CAP_SUPPORT = 0.8;
