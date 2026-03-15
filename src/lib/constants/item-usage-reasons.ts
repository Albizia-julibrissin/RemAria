/**
 * 特別アイテム使用履歴（ItemUsageLog.reason）の理由コード一覧。
 * docs/081。特別アイテムを消費する機能を追加するときはここに理由を追加してからログを記録する。
 */
// 将来の使用先（機能実装時に有効化）
export const ITEM_USAGE_REASON_COMPANION_HIRE = "companion_hire";
export const ITEM_USAGE_REASON_FACILITY_SPEED = "facility_speed";
export const ITEM_USAGE_REASON_OTHER = "other";

// spec/092: ステータス振り直し
export const ITEM_USAGE_REASON_STAT_RECONSTITUTION_PARTIAL = "stat_reconstitution_partial";
export const ITEM_USAGE_REASON_STAT_RECONSTITUTION_FULL = "stat_reconstitution_full";
export const ITEM_USAGE_REASON_STAT_RECONSTITUTION_FULL_BETA = "stat_reconstitution_full_beta";

export const ITEM_USAGE_REASON_LABELS: Record<string, string> = {
  [ITEM_USAGE_REASON_COMPANION_HIRE]: "仲間雇用（権利書消費）",
  [ITEM_USAGE_REASON_FACILITY_SPEED]: "設備加速",
  [ITEM_USAGE_REASON_OTHER]: "その他",
  [ITEM_USAGE_REASON_STAT_RECONSTITUTION_PARTIAL]: "部分再構築",
  [ITEM_USAGE_REASON_STAT_RECONSTITUTION_FULL]: "完全再構築",
  [ITEM_USAGE_REASON_STAT_RECONSTITUTION_FULL_BETA]: "完全再構築β",
};
