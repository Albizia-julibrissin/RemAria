/**
 * spec/046, docs/021: メカパーツ個体の基礎ステ補正を CAP・重みで乱数生成。
 */

export const MECHA_PART_BASE_STAT_KEYS = [
  "STR",
  "INT",
  "VIT",
  "WIS",
  "DEX",
  "AGI",
  "LUK",
] as const;

export type MechaPartBaseStatKey = (typeof MECHA_PART_BASE_STAT_KEYS)[number];

export type MechaPartStatWeightConfig = {
  key: MechaPartBaseStatKey;
  weightMin: number;
  weightMax: number;
};

export type MechaPartStatGenConfig = {
  capMin: number;
  capMax: number;
  weights: MechaPartStatWeightConfig[];
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * config に従ってランダムな基礎ステ補正を生成する。docs/053: マスタから渡された config のみ使用。
 */
export function generateMechaPartStatsFromConfig(
  config: MechaPartStatGenConfig
): Record<string, number> | null {
  if (!config.weights.length) return null;

  const cap = randomInt(config.capMin, config.capMax);
  const weightValues: { key: MechaPartBaseStatKey; weight: number }[] = config.weights.map(
    (w) => ({
      key: w.key,
      weight: randomInt(Math.max(1, w.weightMin), w.weightMax),
    })
  );
  const totalWeight = weightValues.reduce((s, x) => s + x.weight, 0);
  if (totalWeight <= 0) return null;

  const result: Record<string, number> = {};
  let assigned = 0;
  for (let i = 0; i < weightValues.length; i++) {
    const isLast = i === weightValues.length - 1;
    const value = isLast
      ? cap - assigned
      : Math.round((cap * weightValues[i].weight) / totalWeight);
    result[weightValues[i].key] = Math.max(0, value);
    assigned += result[weightValues[i].key];
  }
  return result;
}
