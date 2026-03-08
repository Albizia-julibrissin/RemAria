/**
 * docs/042_battle_effect_types_reference.md に基づく effectType の短いラベルと説明。
 * 管理画面で「どの効果が何をするか」を表示する用。新規 effectType 追加時はここにも1行追加する。
 */
export const SKILL_EFFECT_TYPE_INFO: Record<
  string,
  { label: string; description: string }
> = {
  apply_debuff: {
    label: "デバフ付与",
    description:
      "対象に状態異常（デバフ）を付与。debuffCode, durationCycles, statMult 等。",
  },
  ally_buff: {
    label: "味方バフ",
    description: "味方にステータスバフを N サイクル付与。target, stat, pct, durationCycles。",
  },
  attr_state_chance_debuff: {
    label: "属性状態で確率デバフ",
    description: "指定属性状態のとき確率でデバフ付与し属性消費。triggerAttr, chance, debuffCode。",
  },
  attr_state_force_direct: {
    label: "属性状態で直撃100%",
    description: "指定属性状態のとき直撃を100%に。triggerAttr, fatalAsNormal。",
  },
  attr_state_trigger_damage: {
    label: "属性状態でダメージ倍率",
    description: "指定属性状態のとき倍率乗算・属性消費。triggerAttr, damageMultiplier, consumeAttr。",
  },
  attr_state_trigger_debuff: {
    label: "属性状態でデバフ付与",
    description: "指定属性状態のとき必ずデバフ付与し属性消費。triggerAttr, debuffCode, durationCycles。",
  },
  attr_state_trigger_splash: {
    label: "属性状態でスプラッシュ",
    description: "指定属性状態のとき与ダメの一定割合を敵全体に。triggerAttr, pctOfDealtDamage。",
  },
  column_splash: {
    label: "列条件スプラッシュ",
    description: "ターゲットが指定列のとき与ダメの一定割合を敵全体に。whenTargetCol, pctOfDealtDamage。",
  },
  damage_target_columns: {
    label: "対象列指定",
    description: "指定列の敵にダメージ。targetColumns: [1,2,3] 等。",
  },
  dispel_attr_states: {
    label: "属性状態解除",
    description: "対象の属性状態を全て解除。chance。",
  },
  dispel_debuff: {
    label: "デバフ解除（最大N個）",
    description: "状態異常を最大 N 個解除。count。",
  },
  dispel_debuffs: {
    label: "デバフ解除（指定）",
    description: "指定 debuffCode のみ解除。list: string[]。",
  },
  heal_all: {
    label: "味方全体回復",
    description: "味方全体を回復。scale, randMin, randMax。",
  },
  heal_single: {
    label: "味方単体回復",
    description: "味方単体を回復。scale, targetSelection。",
  },
  move_self_column: {
    label: "自分列移動",
    description: "スキル使用後に自分の列を変更。direction, steps または toColumn。",
  },
  move_target_column: {
    label: "対象列移動",
    description: "ヒットした対象の列を変更。direction, steps, toColumn, chance。",
  },
  self_attr_state_cost: {
    label: "代償の属性状態",
    description: "使用時に自分に属性状態を付与（代償）。attr, durationCycles。",
  },
  target_select_equal_weight: {
    label: "均等抽選",
    description: "敵単体抽選で列ウェイトを使わず均等確率。param は {}。",
  },
};
