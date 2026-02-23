/**
 * 3x3 マス表現
 * 行 1～3（上から下）、列 1＝前列・2＝中列・3＝後列（左から右）
 * 味方グリッドは左、敵グリッドは右に配置して向き合せる
 * docs/10_battle_calc_formulas.md 2. ターゲット選択（列ウェイト）
 */

export type BattleRow = 1 | 2 | 3;
export type BattleCol = 1 | 2 | 3; // 1=前列, 2=中列, 3=後列

export interface BattlePosition {
  row: BattleRow;
  col: BattleCol;
}

/** 列ウェイト（ターゲット抽選用）: P(target i) = weight(col_i) / Σweight */
export const COLUMN_WEIGHTS: Record<BattleCol, number> = {
  1: 1.5,  // 前列
  2: 1.0,  // 中列
  3: 0.5,  // 後列
};

export function getColumnWeight(col: BattleCol): number {
  return COLUMN_WEIGHTS[col];
}

/** 主人公のデフォルト位置: 1行目・後列（味方グリッドで □□■） */
export const DEFAULT_PROTAGONIST_POSITION: BattlePosition = { row: 1, col: 3 };

export function isSamePosition(a: BattlePosition, b: BattlePosition): boolean {
  return a.row === b.row && a.col === b.col;
}
