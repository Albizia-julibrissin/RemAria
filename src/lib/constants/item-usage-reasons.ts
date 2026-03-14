/**
 * 特別アイテム使用履歴（ItemUsageLog.reason）の理由コード一覧。
 * docs/081。特別アイテムを消費する機能を追加するときはここに理由を追加してからログを記録する。
 */
// 将来の使用先（機能実装時に有効化）
export const ITEM_USAGE_REASON_COMPANION_HIRE = "companion_hire";
export const ITEM_USAGE_REASON_FACILITY_SPEED = "facility_speed";
export const ITEM_USAGE_REASON_OTHER = "other";

export const ITEM_USAGE_REASON_LABELS: Record<string, string> = {
  [ITEM_USAGE_REASON_COMPANION_HIRE]: "仲間雇用（権利書消費）",
  [ITEM_USAGE_REASON_FACILITY_SPEED]: "設備加速",
  [ITEM_USAGE_REASON_OTHER]: "その他",
};
