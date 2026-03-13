/**
 * 経験値・レベル計算（docs/048_experience_and_levelup, spec/048）
 * Lv N に達する累計経験値 = 10 × (N-1) × N / 2
 */

/** 累計経験値からレベルを求める（1 以上） */
export function computeLevelFromTotalExp(totalExp: number): number {
  if (totalExp <= 0) return 1;
  // N*(N-1) <= totalExp/5 なる最大 N. N = floor((1+sqrt(1+4*totalExp/5))/2)
  const n = (1 + Math.sqrt(1 + (4 * totalExp) / 5)) / 2;
  return Math.max(1, Math.floor(n));
}

/** Lv N に達するために必要な累計経験値 */
export function getRequiredExpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (10 * (level - 1) * level) / 2;
}

/** 指定レベルの CAP（docs/09: 560 + 60*(N-1)） */
export function getCapForLevel(level: number): number {
  return 560 + 60 * (level - 1);
}

const STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export type Stats = Record<StatKey, number>;

/**
 * レベルアップ時のステータス配分（spec/048 2.6）。
 * 各ステに floor(deltaCAP×0.10) のみ加算する。残り 30% は配分せず、
 * CAP との差（未割り振りポイント）としてプレイヤーが後で割り振る。
 */
export function computeNewStatsForLevelUp(
  oldStats: Stats,
  oldCap: number,
  newCap: number
): Stats {
  const deltaCap = newCap - oldCap;
  if (deltaCap <= 0) return { ...oldStats };

  const baseAdd = Math.floor(deltaCap * 0.1); // 70% 分を各ステに均等に加算

  const next: Stats = { ...oldStats };
  for (const k of STAT_KEYS) {
    next[k] = oldStats[k] + baseAdd;
  }

  return next;
}
