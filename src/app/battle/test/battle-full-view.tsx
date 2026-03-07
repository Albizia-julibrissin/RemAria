"use client";

/**
 * フルモード: 1ターンごとに HP/MP バー・配置グリッド・戦闘ログを表示（1v3 対応）
 */

import type { BattlePosition } from "@/lib/battle/battle-position";
import type { RunTestBattleSuccess } from "@/server/actions/test-battle";
import { TEST_ENEMY_NAME, TEST_ENEMY_ICON_FILENAME } from "@/lib/battle/test-enemy";
import { AllyGridRow, EnemyGridRow } from "./battle-grid-view";
import { EntryLines } from "./battle-log-view";

type LogEntry = RunTestBattleSuccess["log"][number];

/** バー1本＋中に current/max をオーバーレイ（高さ固定で潰れない） */
function BarWithOverlay({
  current,
  max,
  barColor,
}: {
  current: number;
  max: number;
  barColor: string;
}) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div
      className="relative rounded overflow-hidden bg-gray-600"
      style={{ width: "100%", height: 12 }}
    >
      <div
        className={`absolute inset-y-0 left-0 rounded ${barColor} transition-all`}
        style={{ width: `${pct}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums text-white [text-shadow:0_0_1px_black,0_1px_1px_black]">
        {current}/{max}
      </span>
    </div>
  );
}

/** 1ユニット：HP/MPバー2本横並び、バー内に数値オーバーレイ（陣地にアイコンがあるためここではアイコンなし） */
function CompactUnit({
  name,
  hpCurrent,
  hpMax,
  mpCurrent,
  mpMax,
  hpColor = "bg-green-600",
  mpColor = "bg-blue-600",
}: {
  name: string;
  hpCurrent: number;
  hpMax: number;
  mpCurrent: number;
  mpMax: number;
  hpColor?: string;
  mpColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 w-full min-w-0" title={name}>
      <div className="flex flex-col gap-1 shrink-0 w-28 max-sm:w-20">
        <BarWithOverlay current={hpCurrent} max={hpMax} barColor={hpColor} />
        <BarWithOverlay current={mpCurrent} max={mpMax} barColor={mpColor} />
      </div>
    </div>
  );
}

/** デフォルトの味方位置（メンバー i は row i+1, col 1） */
function defaultPartyPositions(count: number): { row: 1 | 2 | 3; col: 1 | 2 | 3 }[] {
  return Array.from({ length: count }, (_, i) => ({
    row: (Math.min(i + 1, 3) || 1) as 1 | 2 | 3,
    col: 1 as 1 | 2 | 3,
  }));
}

/** 表示順：1行目＝上に味方1/敵1、2行目＝味方2/敵2、3行目＝味方3/敵3（行の上下を正順に） */
const DISPLAY_LINES: { allyRow: 1 | 2 | 3; partyIndex: number; enemyRow: 1 | 2 | 3; enemyIndex: number }[] = [
  { allyRow: 1, partyIndex: 0, enemyRow: 1, enemyIndex: 0 },
  { allyRow: 2, partyIndex: 1, enemyRow: 2, enemyIndex: 1 },
  { allyRow: 3, partyIndex: 2, enemyRow: 3, enemyIndex: 2 },
];

/** 同じ (cycle, turn) のログを1つにまとめたグループ */
function groupLogByTurn(log: LogEntry[]): { cycle: number; turn: number; entries: LogEntry[] }[] {
  const key = (e: LogEntry) => `${e.cycle}-${e.turn}`;
  const map = new Map<string, LogEntry[]>();
  for (const e of log) {
    const k = key(e);
    const list = map.get(k) ?? [];
    list.push(e);
    map.set(k, list);
  }
  return Array.from(map.entries())
    .map(([, entries]) => ({
      cycle: entries[0]!.cycle,
      turn: entries[0]!.turn,
      entries,
    }))
    .sort((a, b) => a.cycle - b.cycle || a.turn - b.turn);
}

function TurnBlock({
  entries,
  protagonistPosition,
  protagonistIconFilename,
  partyIconFilenames,
  partyPositions,
  enemyPositions,
  summary,
  enemyDisplayNames,
  enemyIconFilenames,
  defaultEnemyIconFilename,
}: {
  /** このターン内の全ログ（状態表示は最後のエントリを使用） */
  entries: LogEntry[];
  protagonistPosition: RunTestBattleSuccess["protagonistPosition"];
  protagonistIconFilename: RunTestBattleSuccess["protagonistIconFilename"];
  partyIconFilenames: (string | null)[];
  /** このターン終了時点の味方の陣地位置 */
  partyPositions: BattlePosition[];
  /** このターン終了時点の敵の陣地位置 */
  enemyPositions: BattlePosition[];
  summary: RunTestBattleSuccess["summary"];
  enemyDisplayNames: string[];
  enemyIconFilenames: (string | null)[];
  defaultEnemyIconFilename: string;
}) {
  const entry = entries[entries.length - 1]!;
  const enemyAlive = entry.enemyHpAfter.map((hp) => hp > 0);
  const partyNames = summary.partyDisplayNames ?? ["味方"];
  const partyIcons = partyNames.map((_, i) => partyIconFilenames[i] ?? protagonistIconFilename);

  return (
    <div className="border border-base-border rounded-lg p-4 max-sm:p-2 bg-base-elevated space-y-4">
      <div className="text-brass font-medium text-sm">
        サイクル {entry.cycle} / ターン {entry.turn}
      </div>

      <div className="space-y-2 overflow-x-auto">
        {DISPLAY_LINES.map(({ allyRow, partyIndex, enemyRow, enemyIndex }) => (
          <div
            key={allyRow}
            className="flex items-center gap-3 max-sm:gap-1.5 flex-nowrap min-w-0"
          >
            <div className="shrink-0 w-28 max-sm:w-20">
              {partyNames[partyIndex] != null ? (
                <CompactUnit
                  name={partyNames[partyIndex]!}
                  hpCurrent={entry.partyHpAfter?.[partyIndex] ?? entry.playerHpAfter}
                  hpMax={summary.partyMaxHp?.[partyIndex] ?? summary.playerMaxHp ?? 1}
                  mpCurrent={entry.partyMpAfter?.[partyIndex] ?? entry.playerMpAfter}
                  mpMax={summary.partyMaxMp?.[partyIndex] ?? summary.playerMaxMp ?? 1}
                  hpColor="bg-green-600"
                  mpColor="bg-blue-600"
                />
              ) : (
                <div className="h-7 max-sm:h-6" aria-hidden />
              )}
            </div>
            <div className="inline-block border border-base-border rounded p-1 max-sm:p-0.5 bg-base-elevated shrink-0 min-w-0">
              <AllyGridRow
                row={allyRow}
                partyPositions={partyPositions}
                partyIconFilenames={partyIcons}
              />
            </div>
            <span className="text-text-muted text-xs shrink-0">/</span>
            <div className="inline-block border border-base-border rounded p-1 max-sm:p-0.5 bg-base-elevated shrink-0 min-w-0">
              <EnemyGridRow
                row={enemyRow}
                enemyPositions={enemyPositions}
                enemyAlive={enemyAlive}
                enemyIconFilenames={enemyIconFilenames}
                defaultIconFilename={defaultEnemyIconFilename}
              />
            </div>
            <div className="shrink-0 w-28 max-sm:w-20">
              <CompactUnit
                name={enemyDisplayNames[enemyIndex] ?? `${TEST_ENEMY_NAME}${enemyIndex + 1}`}
                hpCurrent={entry.enemyHpAfter[enemyIndex] ?? 0}
                hpMax={summary.enemyMaxHp?.[enemyIndex] ?? 1}
                mpCurrent={entry.enemyMpAfter[enemyIndex] ?? 0}
                mpMax={summary.enemyMaxMp?.[enemyIndex] ?? 1}
                hpColor="bg-red-600"
                mpColor="bg-blue-600"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-base-border text-sm space-y-2">
        {entries.map((e, i) => (
          <EntryLines
            key={i}
            entry={e}
            partyDisplayNames={summary.partyDisplayNames ?? ["味方"]}
            enemyDisplayNames={enemyDisplayNames}
          />
        ))}
      </div>
    </div>
  );
}

function resultText(winner: "player" | "enemy" | "draw"): string {
  switch (winner) {
    case "player":
      return "勝利";
    case "enemy":
      return "敗北";
    default:
      return "引き分け（最大サイクル到達）";
  }
}

interface BattleFullViewProps {
  data: RunTestBattleSuccess;
}

export function BattleFullView({ data }: BattleFullViewProps) {
  return (
    <div className="mt-6 space-y-6">
      <p className="text-text-primary font-medium">
        結果: {resultText(data.summary.winner)}（{data.summary.totalCycles} サイクル）
      </p>
      <p className="text-sm text-text-muted">
        味方の最終HP: {(data.summary.partyDisplayNames ?? ["味方"]).map((name, i) => `${name}=${data.summary.partyHpFinals?.[i] ?? data.summary.playerHpFinal}`).join(", ")} / 敵の最終HP:{" "}
        {data.summary.enemyHpFinals.map((hp, i) => `${(data.enemyDisplayNames ?? [])[i] ?? `${TEST_ENEMY_NAME}${i + 1}`}=${hp}`).join(", ")}
      </p>

      <div className="space-y-6">
        {groupLogByTurn(data.log).map(({ cycle, turn, entries }) => {
          const lastEntry = entries[entries.length - 1]!;
          const partyNames = data.summary.partyDisplayNames ?? ["味方"];
          const resolvedParty =
            lastEntry.partyPositions && lastEntry.partyPositions.length === partyNames.length
              ? lastEntry.partyPositions
              : data.initialPartyPositions && data.initialPartyPositions.length === partyNames.length
                ? data.initialPartyPositions
                : defaultPartyPositions(partyNames.length);
          const resolvedEnemy = lastEntry.enemyPositions ?? data.enemyPositions;
          const enemyNames = data.enemyDisplayNames ?? [1, 2, 3].map((i) => `${TEST_ENEMY_NAME}${i}`);
          const enemyIcons = data.enemyIconFilenames ?? [null, null, null];
          return (
            <TurnBlock
              key={`${cycle}-${turn}`}
              entries={entries}
              protagonistPosition={data.protagonistPosition}
              protagonistIconFilename={data.protagonistIconFilename}
              partyIconFilenames={data.partyIconFilenames ?? []}
              partyPositions={resolvedParty as BattlePosition[]}
              enemyPositions={resolvedEnemy}
              summary={data.summary}
              enemyDisplayNames={enemyNames}
              enemyIconFilenames={enemyIcons}
              defaultEnemyIconFilename={TEST_ENEMY_ICON_FILENAME}
            />
          );
        })}
      </div>
    </div>
  );
}
