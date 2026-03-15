/**
 * レベルキャップとキャップ到達時報酬（spec/074, docs/074_level_cap_and_cap_break_item）。
 * 経験値付与でレベルをこの値で打ち止め、超過分はアイテムに変換する。
 */

/**
 * ゲーム全体の最大レベル。経験値でこれ以上は上がらない。
 * 段階解放する場合は 30 → 40 → … → 100 のように定数変更で対応する。
 */
export const LEVEL_CAP = 30;

/**
 * キャップ到達後、「次のレベル（未解放）」に相当する経験値の単位（固定）。
 * この経験値が貯まるごとに振り直しアイテムを 1 個付与する。キャップが 30 でも 100 でも常に 1000。
 * 解放されていない先のレベルを「1000 = 1 アイテム」で統一するため。
 */
export const EXP_PER_LEVEL_AT_CAP = 1000;

/**
 * キャップ到達後に「レベル1分の経験値」が貯まったときに付与するアイテムの code（Item.code）。
 * 振り直し用アイテム「再構築アンプルα」。部分再構築・完全再構築で消費（spec/092）。
 */
export const LEVEL_CAP_REWARD_ITEM_CODE = "reconstitution_ampoule_alpha";

/**
 * 完全再構築βで消費するアイテムの code（Item.code）。レベルダウンなしで全ポイント振り戻し（spec/092）。
 */
export const RECONSTITUTION_AMPOULE_BETA_ITEM_CODE = "reconstitution_ampoule_beta";

/** 部分再構築で 1 アイテムあたり振り戻せるポイント数（60×0.30。spec/048 §2.6, spec/092） */
export const POINTS_PER_RECONSTITUTION_ITEM = 18;
