/**
 * spec/020_test_battle.md - 仮戦闘用の固定敵
 * DB には持たず、定数で定義。1v3 用にスライム3体・中列と後列に配置
 */

import type { BaseStats } from "./derived-stats";
import type { BattlePosition } from "./battle-position";

export const TEST_ENEMY_NAME = "スライム";

/** スライム用アイコン（public/icons/ に配置） */
export const TEST_ENEMY_ICON_FILENAME = "6.gif";

/** 仮戦闘の固定敵（スライム）の基礎ステータス（物理型B寄り・CAP=350 想定。10_battle_status.csv 準拠） */
export const TEST_ENEMY_BASE_STATS: BaseStats = {
  STR: 105,
  INT: 10,
  VIT: 105,
  WIS: 20,
  DEX: 60,
  AGI: 40,
  LUK: 10,
  CAP: 350,
};

/** 1v3 用: 敵3体の配置（中列・後列のみ。前列は使わない） */
export const TEST_ENEMY_POSITIONS_1V3: BattlePosition[] = [
  { row: 1, col: 2 }, // 1体目: 1行目・中列
  { row: 2, col: 2 }, // 2体目: 2行目・中列
  { row: 3, col: 3 }, // 3体目: 3行目・後列
];
