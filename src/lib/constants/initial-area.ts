/**
 * spec/035: 強制配置する 5 設備の名前（表示順）。
 * ensureInitialFacilities / getIndustrial / seed でこの配列を正本とする。
 */
export const INITIAL_FACILITY_NAMES = [
  "川探索拠点",
  "浄水施設",
  "小麦畑",
  "小麦製粉器",
  "携帯食料包装",
] as const;

export type InitialFacilityName = (typeof INITIAL_FACILITY_NAMES)[number];
