// spec/030, docs/13, docs/079/081: 仲間雇用まわりの定数（推薦紹介状で仲間追加）

/** 推薦紹介状の Item.code。このアイテムを1消費して仲間を1体追加する。 */
export const LETTER_OF_RECOMMENDATION_ITEM_CODE = "letter_of_recommendation";

/** 1 アカウントが持てる仲間の上限（デフォルト値・フォールバック用）。ユーザー別は User.companionLimit。 */
export const COMPANION_MAX_COUNT = 5;
