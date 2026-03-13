// spec/051: 遺物枠・鑑定トークン対応

/** 1キャラあたりの遺物スロット数 */
export const RELIC_SLOT_COUNT = 4;

/** 遺物スロット番号の配列（1～4） */
export const RELIC_SLOTS = [1, 2, 3, 4] as const;

export type RelicSlotIndex = (typeof RELIC_SLOTS)[number];

/**
 * 遺物トークンとして扱う Item.code。
 * 鑑定時はこの code に対応する groupCode で RelicType を抽選する（relic_group_a_token → group_a）。
 */
export const RELIC_TOKEN_ITEM_CODES: readonly string[] = ["relic_group_a_token"];

/** トークン code → 鑑定グループコード */
export const RELIC_TOKEN_TO_GROUP: Record<string, string> = {
  relic_group_a_token: "group_a",
};

/**
 * 遺物グループごとの鑑定パラメータ。
 * - passiveEffectCodes: 抽選対象のパッシブ効果の code。空配列なら効果なしのみ。未指定なら全効果から抽選。
 * - statBonus1 / statBonus2: ステ補正の percent の min〜max（整数）。
 * - attributeResist: 7属性から1つランダムに付与するときの倍率の min〜max（1.0=通常、0.9=10%軽減）。
 */
export type RelicGroupAppraisalConfig = {
  /** 抽選対象の RelicPassiveEffect.code。空なら効果なし(null)のみ。 */
  passiveEffectCodes: string[];
  statBonus1: { min: number; max: number };
  statBonus2: { min: number; max: number };
  /** 属性耐性の倍率（0.8=20%軽減 等）。7属性のうち1つにこの範囲でランダム付与。 */
  attributeResist: { min: number; max: number };
};

/** 遺物グループコードごとの鑑定設定。トークン→グループ→ここを参照。 */
export const RELIC_GROUP_APPRAISAL_CONFIG: Record<string, RelicGroupAppraisalConfig> = {
  group_a: {
    passiveEffectCodes: ["none", "patk_up_5", "matk_up_5"],
    statBonus1: { min: 3, max: 8 },
    statBonus2: { min: 2, max: 5 },
    attributeResist: { min: 0.85, max: 0.95 },
  },
};

/** 戦闘属性耐性の7属性（圧縮～極星）。表示順・テーブル列用。 */
export const ATTRIBUTE_RESISTANCE_KEYS = [
  "crush",
  "slash",
  "pierce",
  "burn",
  "freeze",
  "corrode",
  "polarity",
] as const;

/** 属性コード → 表示名（正本。docs/skill_fields_ja.md の attribute 行と揃える。変更時は両方更新する） */
export const ATTRIBUTE_RESISTANCE_LABELS: Record<(typeof ATTRIBUTE_RESISTANCE_KEYS)[number], string> = {
  crush: "圧縮",
  slash: "切創",
  pierce: "穿孔",
  burn: "焼損",
  freeze: "凍傷",
  corrode: "侵食",
  polarity: "極星",
};
