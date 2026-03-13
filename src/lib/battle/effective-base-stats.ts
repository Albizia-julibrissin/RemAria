/**
 * spec/069, docs/070: 戦闘時有効基礎ステの算出（遺物％・メカフラット・フレーム倍率）
 * 純粋関数のみ。battle.ts がデータ取得し、ここで合成する。
 */

import type { BaseStats } from "./derived-stats";

const BASE_STAT_KEYS = ["STR", "INT", "VIT", "WIS", "DEX", "AGI", "LUK", "CAP"] as const;

/** 遺物の基礎ステ％補正1件。RelicInstance.statBonus1 / statBonus2 の形 */
export function parseRelicStatBonus(json: unknown): { stat: string; percent: number } | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const stat = typeof o.stat === "string" ? o.stat : "";
  const percent = typeof o.percent === "number" ? o.percent : 0;
  if (!stat || !BASE_STAT_KEYS.includes(stat as (typeof BASE_STAT_KEYS)[number])) return null;
  return { stat, percent };
}

/** 複数遺物の％をステータスごとに合算し、基礎に適用。base をコピーして返す。 */
export function applyRelicStatBonuses(
  base: BaseStats,
  relicBonuses: { stat: string; percent: number }[]
): BaseStats {
  const percentByStat: Record<string, number> = {};
  for (const b of relicBonuses) {
    percentByStat[b.stat] = (percentByStat[b.stat] ?? 0) + b.percent;
  }
  const out = { ...base };
  for (const key of BASE_STAT_KEYS) {
    const pct = percentByStat[key] ?? 0;
    if (pct !== 0) out[key as keyof BaseStats] = Math.floor(base[key as keyof BaseStats] * (1 + pct / 100));
  }
  return out;
}

/** メカのフラット加算（フレーム以外の部位）。MechaPartType の strAdd 等を合算したもの。 */
export function addMechaPartsFlat(base: BaseStats, flat: Partial<BaseStats>): BaseStats {
  const out = { ...base };
  for (const key of BASE_STAT_KEYS) {
    const add = flat[key as keyof BaseStats];
    if (add != null && typeof add === "number") out[key as keyof BaseStats] += add;
  }
  return out;
}

/** フレーム倍率を適用。statRates のキーが無い基礎ステは 1.0 扱い。 */
export function applyFrameMultiplier(
  base: BaseStats,
  statRates: Record<string, number> | null | undefined
): BaseStats {
  if (!statRates || typeof statRates !== "object") return base;
  const out = { ...base };
  for (const key of BASE_STAT_KEYS) {
    const rate = statRates[key];
    if (rate != null && typeof rate === "number") out[key as keyof BaseStats] = Math.floor(base[key as keyof BaseStats] * rate);
  }
  return out;
}

/**
 * 戦闘用の有効基礎ステを算出。
 * 順序: base → 遺物％適用 → メカフラット加算（メカのみ）→ フレーム倍率（メカのみ）。
 */
export function computeEffectiveBaseStats(
  base: BaseStats,
  options: {
    relicStatBonuses: { stat: string; percent: number }[];
    mechaFlat?: Partial<BaseStats>;
    frameMultiplier?: Record<string, number> | null;
  }
): BaseStats {
  let effective = applyRelicStatBonuses(base, options.relicStatBonuses);
  if (options.mechaFlat && Object.keys(options.mechaFlat).length > 0) {
    effective = addMechaPartsFlat(effective, options.mechaFlat);
  }
  if (options.frameMultiplier && Object.keys(options.frameMultiplier).length > 0) {
    effective = applyFrameMultiplier(effective, options.frameMultiplier);
  }
  return effective;
}
