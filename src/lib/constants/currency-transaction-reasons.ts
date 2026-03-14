/**
 * 通貨履歴（CurrencyTransaction.reason）の理由コード一覧。
 * 監査・運営ビュー用。manage/OPERATIONAL_LOGS.md §2.2、spec/075 Phase 3。
 * GRA を増減する処理はすべていずれかのコードで記録すること。
 */
export const CURRENCY_REASON_GAME_START = "game_start";
export const CURRENCY_REASON_QUEST_REWARD = "quest_reward";
export const CURRENCY_REASON_COMPANION_HIRE_PURCHASE = "companion_hire_purchase";
export const CURRENCY_REASON_MARKET_PURCHASE = "market_purchase";
export const CURRENCY_REASON_MARKET_SALE = "market_sale";

export const CURRENCY_REASON_LABELS: Record<string, string> = {
  [CURRENCY_REASON_GAME_START]: "ゲーム開始付与",
  [CURRENCY_REASON_QUEST_REWARD]: "任務報酬",
  [CURRENCY_REASON_COMPANION_HIRE_PURCHASE]: "仲間雇用枠購入",
  [CURRENCY_REASON_MARKET_PURCHASE]: "市場購入",
  [CURRENCY_REASON_MARKET_SALE]: "市場成約（売却）",
};
