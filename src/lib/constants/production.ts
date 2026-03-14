/**
 * 生産受け取りのキャップ（docs/019, spec/036）。
 * 経過時間をこの分数でキャップし、「貯められるのは最大24時間分まで」とする。
 * 例：3日放置してログインしても受け取れるのは24時間分まで。それ以上は付与しない。
 */
export const PRODUCTION_CAP_MINUTES = 1440;

/**
 * 緊急製造指示書で全設備を加速する分数。spec/083, docs/065 §7。
 */
export const EMERGENCY_PRODUCTION_ACCELERATION_MINUTES = 120;

/** 緊急製造指示書の Item.code。spec/083 */
export const EMERGENCY_PRODUCTION_ORDER_ITEM_CODE = "emergency_production_order";
