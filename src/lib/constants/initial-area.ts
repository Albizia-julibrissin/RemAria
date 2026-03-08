/**
 * ゲーム開始時付与（manage/ECONOMY_DESIGN.md）。
 * 新規登録時に 500 GRA と携帯食料 1000 個を付与する。
 */
export const INITIAL_GRA_AMOUNT = 500;
export const PORTABLE_RATION_ITEM_CODE = "portable_ration";
export const INITIAL_PORTABLE_RATION_AMOUNT = 1000;

/**
 * spec/035: 強制配置する 5 設備の名前（表示順）。
 * ensureInitialFacilities / getIndustrial / seed でこの配列を正本とする。
 */
export const INITIAL_FACILITY_NAMES = [
  "川探索",
  "浄水施設",
  "小麦畑",
  "小麦製粉器",
  "携帯食料包装",
] as const;

export type InitialFacilityName = (typeof INITIAL_FACILITY_NAMES)[number];
