// spec/015_protagonist_creation.md: 主人公作成まわりの定数

/** 表示名の最大文字数 */
export const DISPLAY_NAME_MAX_LEN = 50;

/** 主人公の基礎ステータス初期値（オール10） */
export const INITIAL_STR = 10;
export const INITIAL_INT = 10;
export const INITIAL_DEX = 10;
export const INITIAL_VIT = 10;
export const INITIAL_SPD = 10;
export const INITIAL_LUK = 10;

/** 主人公の CAP 初期値 */
export const INITIAL_CAP = 60;

/** 初期ステータスをまとめたオブジェクト（作成時に使用） */
export const INITIAL_PROTAGONIST_STATS = {
  STR: INITIAL_STR,
  INT: INITIAL_INT,
  DEX: INITIAL_DEX,
  VIT: INITIAL_VIT,
  SPD: INITIAL_SPD,
  LUK: INITIAL_LUK,
  CAP: INITIAL_CAP,
} as const;
