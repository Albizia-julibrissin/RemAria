"use client";

/**
 * 3x3 マス表現（味方左・敵右）
 * ユニットはアイコン表示、空きマスはプレースホルダ表示
 */

import type { BattlePosition } from "@/lib/battle/battle-position";

const ROWS: (1 | 2 | 3)[] = [1, 2, 3];
const COLS: (1 | 2 | 3)[] = [1, 2, 3];
/** 味方の表示順：左から 後列(col3)、中列(col2)、前列(col1) */
const COLS_DISPLAY_ORDER_ALLY: (1 | 2 | 3)[] = [3, 2, 1];
/** 敵の表示順：左から 前列(col1)、中列(col2)、後列(col3)。味方と向かい合う */
const COLS_DISPLAY_ORDER_ENEMY: (1 | 2 | 3)[] = [1, 2, 3];

export const CELL_SIZE = 40;

/** 空きマス（プレースホルダ）。max-sm でセル縮小（スマホ対策） */
function EmptyCell() {
  return (
    <span
      className="inline-flex items-center justify-center rounded bg-base-border/30 text-text-muted/50 text-xs font-mono w-10 h-10 max-sm:w-7 max-sm:h-7 shrink-0"
      aria-hidden
    >
      －
    </span>
  );
}

/** アイコン表示マス。max-sm でセル縮小（スマホ対策） */
function IconCell({ iconFilename }: { iconFilename: string }) {
  return (
    <span className="inline-flex items-center justify-center overflow-hidden rounded bg-base-border/50 w-10 h-10 max-sm:w-7 max-sm:h-7 shrink-0">
      <img
        src={`/icons/${iconFilename}`}
        alt=""
        className="w-full h-full object-contain"
      />
    </span>
  );
}

/** 味方陣地の1行分（row は 1|2|3）。partyPositions[i] と partyIconFilenames[i] で i 番目の味方の位置とアイコン */
export function AllyGridRow({
  row,
  partyPositions,
  partyIconFilenames,
}: {
  row: 1 | 2 | 3;
  partyPositions: { row: number; col: number }[];
  partyIconFilenames: (string | null)[];
}) {
  return (
    <div className="leading-none flex">
      {COLS_DISPLAY_ORDER_ALLY.map((col) => {
        const idx = partyPositions.findIndex((p) => p.row === row && p.col === col);
        const icon = idx >= 0 ? partyIconFilenames[idx] : null;
        return (
          <span key={col} className="inline-flex">
            {icon ? <IconCell iconFilename={icon} /> : <EmptyCell />}
          </span>
        );
      })}
    </div>
  );
}

/** 敵陣地の1行分（row は 1|2|3） */
export function EnemyGridRow({
  row,
  enemyPositions,
  enemyAlive,
  enemyIconFilename,
}: {
  row: 1 | 2 | 3;
  enemyPositions: BattlePosition[];
  enemyAlive: boolean[];
  enemyIconFilename: string;
}) {
  return (
    <div className="leading-none flex">
      {COLS_DISPLAY_ORDER_ENEMY.map((col) => {
        const filled = enemyPositions.some(
          (pos, i) => enemyAlive[i] && pos.row === row && pos.col === col
        );
        return (
          <span key={col} className="inline-flex">
            {filled ? <IconCell iconFilename={enemyIconFilename} /> : <EmptyCell />}
          </span>
        );
      })}
    </div>
  );
}

/** 味方 1 体用 3x3 グリッド（主人公は設定アイコンを表示） */
function AllyGrid({
  unitPosition,
  iconFilename,
}: {
  unitPosition: BattlePosition;
  iconFilename: string | null;
}) {
  return (
    <div className="inline-block border border-base-border rounded p-2 bg-base-elevated">
      {ROWS.map((row) => (
        <div key={row} className="leading-none flex">
          {COLS.map((col) => {
            const filled = unitPosition.row === row && unitPosition.col === col;
            return (
              <span key={col} className="inline-flex">
                {filled && iconFilename ? (
                  <IconCell iconFilename={iconFilename} />
                ) : (
                  <EmptyCell />
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** 敵複数用 3x3 グリッド（生存している敵の位置にスライムアイコンを表示） */
function EnemyGrid({
  enemyPositions,
  enemyAlive,
  enemyIconFilename,
}: {
  enemyPositions: BattlePosition[];
  enemyAlive: boolean[];
  enemyIconFilename: string;
}) {
  return (
    <div className="inline-block border border-base-border rounded p-2 bg-base-elevated">
      {ROWS.map((row) => (
        <div key={row} className="leading-none flex">
          {COLS.map((col) => {
            const filled = enemyPositions.some(
              (pos, i) => enemyAlive[i] && pos.row === row && pos.col === col
            );
            return (
              <span key={col} className="inline-flex">
                {filled ? (
                  <IconCell iconFilename={enemyIconFilename} />
                ) : (
                  <EmptyCell />
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface BattleGridViewProps {
  protagonistPosition: BattlePosition;
  /** 主人公のアイコン（未設定時は空きマスと同じ表示） */
  protagonistIconFilename: string | null;
  enemyPositions: BattlePosition[];
  enemyAlive: boolean[];
  /** 敵（スライム）のアイコン */
  enemyIconFilename: string;
}

export function BattleGridView({
  protagonistPosition,
  protagonistIconFilename,
  enemyPositions,
  enemyAlive,
  enemyIconFilename,
}: BattleGridViewProps) {
  return (
    <div className="flex items-center justify-center gap-8 flex-wrap">
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-text-muted">味方</span>
        <AllyGrid unitPosition={protagonistPosition} iconFilename={protagonistIconFilename} />
      </div>
      <div className="text-text-muted text-sm self-end pb-2">vs</div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-text-muted">敵</span>
        <EnemyGrid
          enemyPositions={enemyPositions}
          enemyAlive={enemyAlive}
          enemyIconFilename={enemyIconFilename}
        />
      </div>
    </div>
  );
}
