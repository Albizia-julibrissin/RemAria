/**
 * spec/020_test_battle.md - 敵未指定時のデフォルト敵（仮戦闘・練習用）
 * DB には持たず、定数で定義。1v3 用にスライム3体・中列と後列に配置
 */

import type { BaseStats } from "./derived-stats";
import type { BattlePosition } from "./battle-position";
import type { SkillDataForBattle, TacticSlotInput } from "./run-battle-with-party";

export const DEFAULT_ENEMY_NAME = "スライム";

/** スライム用アイコン（public/icons/ に配置） */
export const DEFAULT_ENEMY_ICON_FILENAME = "6.gif";

/** 敵未指定時の固定敵（スライム1～3）の基礎ステータス。
 *  元は CAP=560 を 7 種に均等配分（各 80）だったが、
 *  探索テスト用にプレイヤー側より少し強めに感じられるよう「すべて 2 倍」にしている。
 */
export const DEFAULT_ENEMY_BASE_STATS: BaseStats = {
  STR: 160,
  INT: 160,
  VIT: 160,
  WIS: 160,
  DEX: 160,
  AGI: 160,
  LUK: 160,
  CAP: 1120,
};

/** 1v3 用: 敵3体の配置（中列・後列のみ。前列は使わない） */
export const DEFAULT_ENEMY_POSITIONS_1V3: BattlePosition[] = [
  { row: 1, col: 2 }, // 1体目: 1行目・中列
  { row: 2, col: 2 }, // 2体目: 2行目・中列
  { row: 3, col: 3 }, // 3体目: 3行目・後列
];

/** 敵がスキルを参照するためのID（作戦スロットの skillId と一致させる） */
export const DEFAULT_ENEMY_SKILL_ID_ADVANCE = "enemy_skill_advance";

/** スライムが作戦スロット1で前進突撃を使うための作戦スロット（1つのみ・常に成立） */
export const DEFAULT_ENEMY_TACTIC_SLOTS: TacticSlotInput[] = [
  {
    orderIndex: 1,
    subject: "self",
    conditionKind: "always",
    conditionParam: {},
    actionType: "skill",
    skillId: DEFAULT_ENEMY_SKILL_ID_ADVANCE,
  },
];

/** スライム用スキル：前進突撃（物理・単体・使用後自分が1段階前進）。Seed の前進突撃と同仕様。 */
export const DEFAULT_ENEMY_SKILLS: Record<string, SkillDataForBattle> = {
  [DEFAULT_ENEMY_SKILL_ID_ADVANCE]: {
    name: "前進突撃",
    battleSkillType: "physical",
    powerMultiplier: 2.2,
    mpCostCapCoef: 0.07,
    mpCostFlat: 14,
    hitsMin: 1,
    hitsMax: 1,
    resampleTargetPerHit: false,
    targetScope: "enemy_single",
    attribute: "slash",
    chargeCycles: 0,
    cooldownCycles: 2,
    weightAddFront: 0,
    weightAddMid: 0,
    weightAddBack: 0,
    effects: [{ effectType: "move_self_column", param: { direction: "forward", steps: 1 } }],
    logMessage: "先陣を切る覚悟の突撃…！",
  },
};
