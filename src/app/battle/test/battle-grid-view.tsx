"use client";

/**
 * 3x3 マス表現（味方左・敵右）
 * ユニットはアイコン表示、空きマスはプレースホルダ表示
 */

import type { BattlePosition } from "@/lib/battle/battle-position";

const ROWS: (1 | 2 | 3)[] = [1, 2, 3];
const COLS: (1 | 2 | 3)[] = [1, 2, 3];

const CELL_SIZE = 40;

/** 空きマス（プレースホルダ） */
function EmptyCell() {
  return (
    <span
      className="inline-flex items-center justify-center rounded bg-base-border/30 text-text-muted/50 text-xs font-mono"
      style={{ width: CELL_SIZE, height: CELL_SIZE }}
      aria-hidden
    >
      －
    </span>
  );
}

/** アイコン表示マス */
function IconCell({ iconFilename }: { iconFilename: string }) {
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded bg-base-border/50"
      style={{ width: CELL_SIZE, height: CELL_SIZE }}
    >
      <img
        src={`/icons/${iconFilename}`}
        alt=""
        className="max-w-full max-h-full object-contain"
        width={CELL_SIZE}
        height={CELL_SIZE}
      />
    </span>
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
