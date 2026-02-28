// spec/039, docs/14_battle_attributes_tactics: 作戦スロットの主語・条件・行動の選択肢

export const SUBJECT_OPTIONS = [
  { value: "self", label: "自分" },
  { value: "any_ally", label: "味方のいずれか" },
  { value: "any_enemy", label: "相手のいずれか" },
  { value: "front_enemy", label: "正面の相手" },
] as const;

export const CONDITION_OPTIONS = [
  { value: "always", label: "常に" },
  { value: "hp_below_percent", label: "HPが〇％以下" },
  { value: "hp_above_percent", label: "HPが〇％以上" },
  { value: "mp_below_percent", label: "MPが〇％以下" },
  { value: "mp_above_percent", label: "MPが〇％以上" },
  { value: "subject_has_attr_state", label: "指定の属性状態になっている" },
] as const;

export const PERCENT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

export const ATTR_OPTIONS = [
  { value: "none", label: "無" },
  { value: "crush", label: "圧壊" },
  { value: "slash", label: "切断" },
  { value: "pierce", label: "刺突" },
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
