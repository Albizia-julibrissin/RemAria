"use client";

/**
 * spec/020_test_battle.md - 戦闘ログをテキストベースで 1 サイクルずつ・ターンごとに表示
 */

import type { RunTestBattleSuccess } from "@/server/actions/test-battle";
import { TEST_ENEMY_NAME } from "@/lib/battle/test-enemy";

const PLAYER_LABEL = "主人公";
const ENEMY_LABEL = TEST_ENEMY_NAME;

type LogEntry = RunTestBattleSuccess["log"][number];

function turnLine(entry: LogEntry): string {
  const attacker = entry.attacker === "player" ? PLAYER_LABEL : ENEMY_LABEL;
  const target = entry.target === "player" ? PLAYER_LABEL : ENEMY_LABEL;

  if (!entry.hit) {
    return `ターン ${entry.turn}: ${attacker}の攻撃 → ${target}にミス。`;
  }

  const tags: string[] = [];
  if (entry.fatal) tags.push("致命");
  else if (entry.direct) tags.push("直撃");
  else tags.push("命中");

  const tagStr = tags.length > 0 ? `（${tags.join("）")}` : "";
  return `ターン ${entry.turn}: ${attacker}の攻撃 → ${target}に ${entry.damage} ダメージ${tagStr}。${target}のHP: ${entry.targetHpAfter}。${attacker} MP+${entry.mpRecovery}。`;
}

function formatLogByCycle(log: LogEntry[]): { cycle: number; lines: string[] }[] {
  const byCycle = new Map<number, LogEntry[]>();
  for (const entry of log) {
    const list = byCycle.get(entry.cycle) ?? [];
    list.push(entry);
    byCycle.set(entry.cycle, list);
  }
  const cycles = Array.from(byCycle.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cycle, entries]) => ({
      cycle,
      lines: entries.sort((a, b) => a.turn - b.turn).map(turnLine),
    }));
  return cycles;
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

interface BattleLogViewProps {
  data: RunTestBattleSuccess;
}

export function BattleLogView({ data }: BattleLogViewProps) {
  const cycles = formatLogByCycle(data.log);

  return (
    <div className="mt-6 space-y-4">
      <p className="text-text-primary font-medium">
        結果: {resultText(data.summary.winner)}（{data.summary.totalCycles} サイクル）
      </p>
      <p className="text-sm text-text-muted">
        主人公の最終HP: {data.summary.playerHpFinal} / {ENEMY_LABEL}の最終HP: {data.summary.enemyHpFinal}
      </p>
      <div className="bg-base-elevated border border-base-border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
        {cycles.map(({ cycle, lines }) => (
          <div key={cycle} className="mb-4 last:mb-0">
            <div className="text-brass font-medium mb-1">——— サイクル {cycle} ———</div>
            {lines.map((line, i) => (
              <div key={i} className="pl-2">
                {line}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
