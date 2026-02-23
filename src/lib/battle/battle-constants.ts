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
export const BATTLE_MITIGATION_DENOM = 1000;
