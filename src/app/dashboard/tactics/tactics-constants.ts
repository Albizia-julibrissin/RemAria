// spec/039, spec/040, docs/14_battle_attributes_tactics: 作戦スロットの主語・条件・行動の選択肢

export const SUBJECT_OPTIONS = [
  { value: "self", label: "自分" },
  { value: "any_ally", label: "味方のいずれか" },
  { value: "any_enemy", label: "相手のいずれか" },
  { value: "front_enemy", label: "正面の相手" },
  { value: "cycle", label: "サイクル" },
  { value: "turn", label: "ターン" },
] as const;

/** ユニット主語（self / any_ally / any_enemy / front_enemy）用の条件 */
export const CONDITION_OPTIONS = [
  { value: "always", label: "常に" },
  { value: "hp_below_percent", label: "HPが〇％以下" },
  { value: "hp_above_percent", label: "HPが〇％以上" },
  { value: "mp_below_percent", label: "MPが〇％以下" },
  { value: "mp_above_percent", label: "MPが〇％以上" },
  { value: "subject_has_attr_state", label: "指定の属性状態になっている" },
] as const;

/** 主語「サイクル」用の条件（偶数／奇数／Nの倍数／N以上／Nのとき） */
export const CYCLE_CONDITION_OPTIONS = [
  { value: "cycle_is_even", label: "偶数サイクル" },
  { value: "cycle_is_odd", label: "奇数サイクル" },
  { value: "cycle_is_multiple_of", label: "Nの倍数サイクル" },
  { value: "cycle_at_least", label: "Nサイクル以上" },
  { value: "cycle_equals", label: "サイクルがNのとき" },
] as const;

/** 主語「ターン」用の条件（本サイクル内の行動順 1～6） */
export const TURN_CONDITION_OPTIONS = [
  { value: "turn_order_in_range", label: "行動順が〇～〇番目" },
] as const;

/** サイクル条件で使う N の選択肢（倍数・以上） */
export const CYCLE_N_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** ターン順の範囲（1～6） */
export const TURN_INDEX_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export const PERCENT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

export const ATTR_OPTIONS = [
  { value: "none", label: "無" },
  { value: "crush", label: "圧縮" },
  { value: "slash", label: "切創" },
  { value: "pierce", label: "穿孔" },
  { value: "burn", label: "焼損" },
  { value: "freeze", label: "凍傷" },
  { value: "corrode", label: "侵食" },
  { value: "polarity", label: "極性" },
] as const;

export const ACTION_TYPES = [
  { value: "normal_attack", label: "通常攻撃" },
  { value: "skill", label: "スキル" },
] as const;

export const BATTLE_SKILL_TYPE_LABELS: Record<string, string> = {
  physical: "物理",
  magic: "魔法",
  support: "補助",
};
