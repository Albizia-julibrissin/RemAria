/**
 * spec/046, docs/021: 装備個体のステータスを CAP・重みで乱数生成。
 * 戦闘用ステータス（PATK, PDEF 等）への加算値を返す。
 */

/** 装備が補正できる戦闘用ステータス（derived-stats のキーと対応）。戦闘時は合算値をそのまま派生ステに加算（spec/071）。 */
export const EQUIPMENT_STAT_KEYS = [
  "HP",
  "MP",
  "PATK",
  "MATK",
  "PDEF",
  "MDEF",
  "HIT",
  "EVA",
  "LUCK",
] as const;

export type EquipmentStatKey = (typeof EQUIPMENT_STAT_KEYS)[number];

/** 装備ステータスの表示名（UI 一覧・モーダル用） */
export const EQUIPMENT_STAT_LABELS: Record<EquipmentStatKey, string> = {
  HP: "HP",
  MP: "MP",
  PATK: "物理攻撃",
  MATK: "魔法攻撃",
  PDEF: "物理防御",
  MDEF: "魔法防御",
  HIT: "命中",
  EVA: "回避",
  LUCK: "運",
};

export type EquipmentStatWeightConfig = {
  key: EquipmentStatKey;
  weightMin: number;
  weightMax: number;
};

export type EquipmentStatGenConfig = {
  capMin: number;
  capMax: number;
  weights: EquipmentStatWeightConfig[];
};

/** 装備種別 code ごとの CAP 範囲と重み範囲。021 準拠。MVP ではここで定義。 */
export const EQUIPMENT_STAT_GEN_BY_CODE: Record<string, EquipmentStatGenConfig> = {
  iron_sword: {
    capMin: 70,
    capMax: 100,
    weights: [
      { key: "PATK", weightMin: 5, weightMax: 10 },
      { key: "PDEF", weightMin: 1, weightMax: 5 },
    ],
  },
  cotton_robe: {
    capMin: 50,
    capMax: 80,
    weights: [
      { key: "PDEF", weightMin: 3, weightMax: 8 },
      { key: "MDEF", weightMin: 2, weightMax: 6 },
    ],
  },
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * config に従ってランダムな戦闘用ステ補正を生成する。docs/053: マスタから渡された config のみ使用。
 * CAP を範囲内で乱数し、各採用ステの重みを乱数して按分配分。
 */
export function generateEquipmentStatsFromConfig(
  config: EquipmentStatGenConfig
): Record<string, number> | null {
  if (!config.weights.length) return null;

  const cap = randomInt(config.capMin, config.capMax);
  const weightValues: { key: EquipmentStatKey; weight: number }[] = config.weights.map((w) => ({
    key: w.key,
    weight: randomInt(Math.max(1, w.weightMin), w.weightMax),
  }));
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

/**
 * 指定した cap を重みで按分して戦闘用ステ補正を生成する。spec/084 鍛錬用。
 * 重みは config.weights の範囲で乱数し、その cap を按分配分する。
 */
export function generateEquipmentStatsWithFixedCap(
  config: EquipmentStatGenConfig,
  cap: number
): Record<string, number> | null {
  if (!config.weights.length || cap < 0) return null;

  const weightValues: { key: EquipmentStatKey; weight: number }[] = config.weights.map((w) => ({
    key: w.key,
    weight: randomInt(Math.max(1, w.weightMin), w.weightMax),
  }));
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

/**
 * 装備種別 code に応じてランダムな戦闘用ステ補正を生成する。
 * 053 移行後は craft では使用しない。seed で statGenConfig を組み立てる参考用。
 */
export function generateEquipmentStats(equipmentTypeCode: string): Record<string, number> | null {
  const config = EQUIPMENT_STAT_GEN_BY_CODE[equipmentTypeCode];
  if (!config) return null;
  return generateEquipmentStatsFromConfig(config);
}
