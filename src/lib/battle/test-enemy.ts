/**
 * spec/020_test_battle.md - 仮戦闘用の固定敵
 * DB には持たず、定数で定義。1v3 用にスライム3体・中列と後列に配置
 */

import type { BaseStats } from "./derived-stats";
import type { BattlePosition } from "./battle-position";
import type { SkillDataForBattle, TacticSlotInput } from "./run-battle-with-party";

export const TEST_ENEMY_NAME = "スライム";

/** スライム用アイコン（public/icons/ に配置） */
export const TEST_ENEMY_ICON_FILENAME = "6.gif";

/** 仮戦闘の固定敵（スライム1～3）の基礎ステータス。CAP=560 を 7 種に均等配分（各 80）。 */
export const TEST_ENEMY_BASE_STATS: BaseStats = {
  STR: 80,
  INT: 80,
  VIT: 80,
  WIS: 80,
  DEX: 80,
  AGI: 80,
  LUK: 80,
  CAP: 560,
};

/** 1v3 用: 敵3体の配置（中列・後列のみ。前列は使わない） */
export const TEST_ENEMY_POSITIONS_1V3: BattlePosition[] = [
  { row: 1, col: 2 }, // 1体目: 1行目・中列
  { row: 2, col: 2 }, // 2体目: 2行目・中列
  { row: 3, col: 3 }, // 3体目: 3行目・後列
];

/** 敵がスキルを参照するためのID（作戦スロットの skillId と一致させる） */
export const TEST_ENEMY_SKILL_ID_ADVANCE = "enemy_skill_advance";

/** スライムが作戦スロット1で前進突撃を使うための作戦スロット（1つのみ・常に成立） */
export const TEST_ENEMY_TACTIC_SLOTS: TacticSlotInput[] = [
  {
    orderIndex: 1,
    subject: "self",
    conditionKind: "always",
    conditionParam: {},
    actionType: "skill",
    skillId: TEST_ENEMY_SKILL_ID_ADVANCE,
  },
];

/** スライム用スキル：前進突撃（物理・単体・使用後自分が1段階前進）。Seed の前進突撃と同仕様。 */
export const TEST_ENEMY_SKILLS: Record<string, SkillDataForBattle> = {
  [TEST_ENEMY_SKILL_ID_ADVANCE]: {
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
