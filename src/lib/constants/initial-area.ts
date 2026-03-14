/**
 * ゲーム開始時付与（manage/ECONOMY_DESIGN.md）。
 * 新規登録時に 3000 GRA と基本探索キット 500 個を付与する。
 */
export const INITIAL_GRA_AMOUNT = 3000;
export const INITIAL_GRANT_ITEM_CODE = "basic_exploration_kit";
export const INITIAL_GRANT_ITEM_AMOUNT = 500;

/**
 * spec/035: 強制配置する 5 設備の名前（表示順）。
 * ensureInitialFacilities / getIndustrial / seed でこの配列を正本とする。
 * 設備マスタ（FacilityType.name）と完全一致させること。
 */
export const INITIAL_FACILITY_NAMES = [
  "備品生産設備",
  "探索備品包装",
  "食糧生産設備",
  "携帯食糧包装",
  "基本探索キット組立",
] as const;

export type InitialFacilityName = (typeof INITIAL_FACILITY_NAMES)[number];
