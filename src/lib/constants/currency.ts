/**
 * 課金通貨の表示名・アイコン（manage/ECONOMY_DESIGN.md）
 * GRA（グラ）: スペイン語エングラナヘ（歯車）& イタリア語グラナ（粒）に由来。
 * 歯車の摩耗粉から再利用した金属を通貨にした文化に倣った呼称。
 */

/** 課金通貨の表示名（無償・有償とも画面ではこの単位で表示） */
export const PREMIUM_CURRENCY_DISPLAY_NAME = "GRA";

/** 課金通貨の日本語表示名（ツールチップ等） */
export const PREMIUM_CURRENCY_DISPLAY_NAME_JA = "グラ";

/** GRA 表示用の歯車アイコン（Game Icons のアイコン名） */
export const PREMIUM_CURRENCY_ICON_NAME = "big-gear";

/**
 * 課金でGRAを購入する際の価格リスト（manage/ECONOMY_DESIGN.md §2 準拠）。
 * 通貨発行タブの表示・将来的な決済処理で参照する。
 */
export const GRA_PURCHASE_OPTIONS: ReadonlyArray<{
  priceYen: number;
  gra: number;
  discountNote: string;
}> = [
  { priceYen: 100, gra: 777, discountNote: "基準" },
  { priceYen: 490, gra: 4000, discountNote: "約4.9%" },
  { priceYen: 1980, gra: 16500, discountNote: "約6.8%" },
  { priceYen: 4980, gra: 43000, discountNote: "約11.1%" },
  { priceYen: 8500, gra: 77777, discountNote: "約14.7%" },
] as const;
