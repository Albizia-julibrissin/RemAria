/**
 * spec/084: 鍛錬・継承まわりの定数。
 */

/** 鍛錬時に消費する素材量 = 製造レシピ入力の amount × この値。 */
export const TEMPER_MATERIAL_MULTIPLIER = 2;

/** 継承の初期成功率（％）。 */
export const INHERIT_BASE_SUCCESS_RATE_PERCENT = 10;

/** 継承失敗ごとの成功率加算（％）。最大 100％。 */
export const INHERIT_SUCCESS_RATE_INCREMENT = 10;
