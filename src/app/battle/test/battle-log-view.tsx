"use client";

/**
 * spec/020_test_battle.md - 戦闘ログをテキストベースで 1 サイクルずつ・ターンごとに表示
 */

import type { RunTestBattleSuccess } from "@/server/actions/test-battle";
import { TEST_ENEMY_NAME } from "@/lib/battle/test-enemy";

const ENEMY_LABEL = TEST_ENEMY_NAME;

type LogEntry = RunTestBattleSuccess["log"][number];

function attackerName(entry: LogEntry, partyDisplayNames: string[]): string {
  if (entry.attacker === "enemy") return `${ENEMY_LABEL}${(entry.attackerEnemyIndex ?? 0) + 1}`;
  const i = entry.attackerPartyIndex ?? 0;
  return partyDisplayNames[i] ?? "味方";
}

function targetName(entry: LogEntry, partyDisplayNames: string[]): string {
  if (entry.target === "enemy") return `${ENEMY_LABEL}${(entry.targetEnemyIndex ?? 0) + 1}`;
  const i = entry.targetPartyIndex ?? 0;
  return partyDisplayNames[i] ?? "味方";
}

function turnLine(entry: LogEntry, partyDisplayNames: string[]): string {
  const attacker = attackerName(entry, partyDisplayNames);
  const target = targetName(entry, partyDisplayNames);

  const actionLabel =
    entry.fizzle && entry.skillName
      ? `${entry.skillName}（MP不足で不発）`
      : entry.actionType === "skill" && entry.skillName
        ? entry.skillName
        : "通常攻撃";

  if (entry.fizzle) {
    return `ターン ${entry.turn}: ${attacker}の${actionLabel}。`;
  }

  if (!entry.hit) {
    return `ターン ${entry.turn}: ${attacker}の${actionLabel} → ${target}にミス。`;
  }

  const tags: string[] = [];
  if (entry.fatal) tags.push("致命");
  else if (entry.direct) tags.push("直撃");
  else tags.push("命中");
  const tagStr = tags.length > 0 ? `（${tags.join("）")}` : "";
  const mpStr = entry.mpRecovery > 0 ? ` ${attacker} MP+${entry.mpRecovery}。` : "";
  return `ターン ${entry.turn}: ${attacker}の${actionLabel} → ${target}に ${entry.damage} ダメージ${tagStr}。${target}のHP: ${entry.targetHpAfter}。${mpStr}`;
}

function formatLogByCycle(log: LogEntry[], partyDisplayNames: string[]): { cycle: number; lines: string[] }[] {
  const byCycle = new Map<number, LogEntry[]>();
  for (const entry of log) {
    const list = byCycle.get(entry.cycle) ?? [];
    list.push(entry);
    byCycle.set(entry.cycle, list);
  }
  return Array.from(byCycle.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cycle, entries]) => ({
      cycle,
      lines: entries.sort((a, b) => a.turn - b.turn).map((e) => turnLine(e, partyDisplayNames)),
    }));
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
  const partyNames = data.summary.partyDisplayNames ?? ["味方"];
  const cycles = formatLogByCycle(data.log, partyNames);

  return (
    <div className="mt-6 space-y-4">
      <p className="text-text-primary font-medium">
        結果: {resultText(data.summary.winner)}（{data.summary.totalCycles} サイクル）
      </p>
      <p className="text-sm text-text-muted">
        味方の最終HP: {(data.summary.partyHpFinals ?? [data.summary.playerHpFinal]).join(", ")} / 敵の最終HP: {data.summary.enemyHpFinals.join(", ")}
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
