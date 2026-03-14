// spec/075_market.md Phase 1 - グローバル規定
// Item.marketMinPricePerUnit / marketMinQuantity が NULL のときに使用する定数

/** 出品時の単価下限（グローバル）。アイテム別が NULL のとき使用。 */
export const MARKET_MIN_PRICE_PER_UNIT_GLOBAL = 1;

/** 出品時の数量下限（グローバル）。アイテム別が NULL のとき使用。 */
export const MARKET_MIN_QUANTITY_GLOBAL = 1;

/** 成約額の手数料率（10％）。売り手から控除。端数切り捨て。 */
export const MARKET_FEE_RATE = 0.1;

/** 出品の有効期限（日数）。Phase 2.2。 */
export const MARKET_LISTING_DEFAULT_DAYS = 7;

/** 価格履歴の直近件数。Phase 2.3。 */
export const MARKET_PRICE_HISTORY_LIMIT = 50;

/** 同時出品数上限（通常）。Phase 2.4。サブスク未実装時は常にこの値。 */
export const MARKET_MAX_LISTINGS_DEFAULT = 10;

/** 同時出品数上限（サブスク用）。Phase 2.4。未実装時は使用しない。 */
export const MARKET_MAX_LISTINGS_SUBSCRIPTION = 20;
