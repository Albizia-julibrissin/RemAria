// spec/015_protagonist_creation.md: 主人公作成まわりの定数

/** 表示名の最大文字数（おおよそ全角 12 文字） */
export const DISPLAY_NAME_MAX_CHARS = 12;

/** 表示名の最大バイト長（半角換算で約 24 バイト） */
export const DISPLAY_NAME_MAX_BYTES = 24;

/** レベル1の基礎ステータス初期値（CAP560想定で各80）。主人公作成・仲間雇用時に使用。docs/09, 10_battle_status.csv 準拠 */
export const INITIAL_STR = 80;
export const INITIAL_INT = 80;
export const INITIAL_VIT = 80;
export const INITIAL_WIS = 80;
export const INITIAL_DEX = 80;
export const INITIAL_AGI = 80;
export const INITIAL_LUK = 80;

/** レベル1の CAP 初期値（560 = 80×7）。docs/09: 560 + 60*(N-1) の N=1 の場合 */
export const INITIAL_CAP = 560;

/** 初期ステータスをまとめたオブジェクト（主人公作成・仲間雇用・メカ作成時に使用） */
export const INITIAL_PROTAGONIST_STATS = {
  STR: INITIAL_STR,
  INT: INITIAL_INT,
  VIT: INITIAL_VIT,
  WIS: INITIAL_WIS,
  DEX: INITIAL_DEX,
  AGI: INITIAL_AGI,
  LUK: INITIAL_LUK,
  CAP: INITIAL_CAP,
} as const;
