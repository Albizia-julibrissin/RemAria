/**
 * spec/046, docs/021: 装備個体のステータスを CAP・重みで乱数生成。
 * 戦闘用ステータス（PATK, PDEF 等）への加算値を返す。
 */

/** 装備が補正できる戦闘用ステータス（derived-stats のキーと対応） */
export const EQUIPMENT_STAT_KEYS = [
  "PATK",
  "MATK",
  "PDEF",
  "MDEF",
  "HIT",
  "EVA",
] as const;

export type EquipmentStatKey = (typeof EQUIPMENT_STAT_KEYS)[number];

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
  cloth_armor: {
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
 * 装備種別 code に応じてランダムな戦闘用ステ補正を生成する。
 * CAP を範囲内で乱数し、各採用ステの重みを乱数して按分配分。
 */
export function generateEquipmentStats(equipmentTypeCode: string): Record<string, number> | null {
  const config = EQUIPMENT_STAT_GEN_BY_CODE[equipmentTypeCode];
  if (!config || config.weights.length === 0) return null;

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
