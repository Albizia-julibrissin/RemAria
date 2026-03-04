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

/** メカパーツ種別（name または id ではなく、種別識別用）ごとの設定。MVP では未使用でも null を返す。 */
export const MECHA_PART_STAT_GEN_BY_NAME: Record<string, MechaPartStatGenConfig> = {
  // おんぼろ等、クラフト出力する種別を追加する場合はここに
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * メカパーツ種別名に応じてランダムな基礎ステ補正を生成する。
 * 設定が無い場合は null（固定値パーツ用）。
 */
export function generateMechaPartStats(mechaPartTypeName: string): Record<string, number> | null {
  const config = MECHA_PART_STAT_GEN_BY_NAME[mechaPartTypeName];
  if (!config || config.weights.length === 0) return null;

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
