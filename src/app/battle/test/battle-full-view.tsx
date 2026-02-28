"use client";

/**
 * フルモード: 1ターンごとに HP/MP バー・配置グリッド・ログを表示（1v3 対応）
 */

import type { RunTestBattleSuccess } from "@/server/actions/test-battle";
import { TEST_ENEMY_NAME, TEST_ENEMY_ICON_FILENAME } from "@/lib/battle/test-enemy";
import { BattleGridView } from "./battle-grid-view";

function enemyLabel(index: number): string {
  return `${TEST_ENEMY_NAME}${index + 1}`;
}

type LogEntry = RunTestBattleSuccess["log"][number];

function attackerName(entry: LogEntry, partyDisplayNames: string[]): string {
  if (entry.attacker === "enemy") return enemyLabel(entry.attackerEnemyIndex ?? 0);
  return partyDisplayNames[entry.attackerPartyIndex ?? 0] ?? "味方";
}

function targetName(entry: LogEntry, partyDisplayNames: string[]): string {
  if (entry.target === "enemy") return enemyLabel(entry.targetEnemyIndex ?? 0);
  return partyDisplayNames[entry.targetPartyIndex ?? 0] ?? "味方";
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

  if (entry.fizzle) return `${attacker}の${actionLabel}。`;
  if (!entry.hit) return `${attacker}の${actionLabel} → ${target}にミス。`;

  const tags: string[] = [];
  if (entry.fatal) tags.push("致命");
  else if (entry.direct) tags.push("直撃");
  else tags.push("命中");
  const tagStr = tags.length > 0 ? `（${tags.join("）")}` : "";
  const mpStr = entry.mpRecovery > 0 ? ` ${attacker} MP+${entry.mpRecovery}。` : "";
  return `${attacker}の${actionLabel} → ${target}に ${entry.damage} ダメージ${tagStr}。${target}のHP: ${entry.targetHpAfter}。${mpStr}`;
}

function StatBar({
  label,
  current,
  max,
  barColor,
}: {
  label: string;
  current: number;
  max: number;
  barColor: string;
}) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-text-muted shrink-0 w-14">{label}</span>
      <div className="flex-1 min-w-0 h-4 bg-base-border rounded overflow-hidden">
        <div
          className={`h-full rounded ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-text-muted shrink-0 tabular-nums">
        {current}/{max}
      </span>
    </div>
  );
}

function TurnBlock({
  entry,
  protagonistPosition,
  protagonistIconFilename,
  enemyPositions,
  summary,
}: {
  entry: LogEntry;
  protagonistPosition: RunTestBattleSuccess["protagonistPosition"];
  protagonistIconFilename: RunTestBattleSuccess["protagonistIconFilename"];
  enemyPositions: RunTestBattleSuccess["enemyPositions"];
  summary: RunTestBattleSuccess["summary"];
}) {
  const enemyAlive = entry.enemyHpAfter.map((hp) => hp > 0);

  return (
    <div className="border border-base-border rounded-lg p-4 bg-base-elevated space-y-4">
      <div className="text-brass font-medium text-sm">
        サイクル {entry.cycle} / ターン {entry.turn}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-xs text-text-muted mb-1">味方</div>
          {(summary.partyDisplayNames ?? ["味方"]).map((name, i) => (
            <div key={i} className="space-y-1">
              <StatBar
                label={`${name} HP`}
                current={entry.partyHpAfter?.[i] ?? entry.playerHpAfter}
                max={summary.partyMaxHp?.[i] ?? summary.playerMaxHp}
                barColor="bg-green-600"
              />
              <StatBar
                label={`${name} MP`}
                current={entry.partyMpAfter?.[i] ?? entry.playerMpAfter}
                max={summary.partyMaxMp?.[i] ?? summary.playerMaxMp}
                barColor="bg-blue-600"
              />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs text-text-muted mb-1">敵（3体）</div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <StatBar
                label={`${TEST_ENEMY_NAME}${i + 1} HP`}
                current={entry.enemyHpAfter[i] ?? 0}
                max={summary.enemyMaxHp}
                barColor="bg-red-600"
              />
              <StatBar
                label={`${TEST_ENEMY_NAME}${i + 1} MP`}
                current={entry.enemyMpAfter[i] ?? 0}
                max={summary.enemyMaxMp}
                barColor="bg-blue-600"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2">
        <BattleGridView
          protagonistPosition={protagonistPosition}
          protagonistIconFilename={protagonistIconFilename}
          enemyPositions={enemyPositions}
          enemyAlive={enemyAlive}
          enemyIconFilename={TEST_ENEMY_ICON_FILENAME}
        />
      </div>

      <p className="font-mono text-sm text-text-primary pt-2 border-t border-base-border">
        {turnLine(entry, summary.partyDisplayNames ?? ["味方"])}
      </p>
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
        {data.summary.enemyHpFinals.map((hp, i) => `${TEST_ENEMY_NAME}${i + 1}=${hp}`).join(", ")}
      </p>

      <div className="space-y-6">
        {data.log.map((entry, i) => (
          <TurnBlock
            key={`${entry.cycle}-${entry.turn}-${i}`}
            entry={entry}
            protagonistPosition={data.protagonistPosition}
            protagonistIconFilename={data.protagonistIconFilename}
            enemyPositions={data.enemyPositions}
            summary={data.summary}
          />
        ))}
      </div>
    </div>
  );
}
