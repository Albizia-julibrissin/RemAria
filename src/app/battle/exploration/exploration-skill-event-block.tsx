"use client";

/**
 * 技能イベント表示。戦闘ログの「1サイクル1ターン」ブロックと同じレイアウトで、
 * ヘッダー・パーティHP/MP・配置グリッドを表示し、ログ部分にイベントメッセージとステータス選択UIを出す。
 * spec/049 §8.3
 */

import { useState, useTransition } from "react";
import { AllyGridRow } from "../practice/battle-grid-view";
import { ExplorationNextButton } from "./exploration-next-button";
import { resolveExplorationSkillEvent } from "@/server/actions/exploration";
import type { CarriedConsumableChoice, ExplorationPartyMemberChoice } from "@/server/actions/exploration";
import { ExplorationConsumableUseClient } from "./exploration-consumable-use-client";

/** バー1本＋中に current/max をオーバーレイ（戦闘ログと同じ） */
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

/** 1ユニット：HP/MPバー2本（戦闘ログと同じ） */
function CompactUnit({
  name,
  hpCurrent,
  hpMax,
  mpCurrent,
  mpMax,
}: {
  name: string;
  hpCurrent: number;
  hpMax: number;
  mpCurrent: number;
  mpMax: number;
}) {
  return (
    <div className="flex items-center gap-2 w-full min-w-0" title={name}>
      <div className="flex flex-col gap-1 shrink-0 w-28 max-sm:w-20">
        <BarWithOverlay current={hpCurrent} max={hpMax} barColor="bg-green-600" />
        <BarWithOverlay current={mpCurrent} max={mpMax} barColor="bg-blue-600" />
      </div>
    </div>
  );
}

const DISPLAY_LINES: { allyRow: 1 | 2 | 3; partyIndex: number }[] = [
  { allyRow: 1, partyIndex: 0 },
  { allyRow: 2, partyIndex: 1 },
  { allyRow: 3, partyIndex: 2 },
];

const SKILL_STAT_LABELS: { key: string; label: string }[] = [
  { key: "STR", label: "力" },
  { key: "INT", label: "知" },
  { key: "VIT", label: "体" },
  { key: "WIS", label: "賢" },
  { key: "DEX", label: "技" },
  { key: "AGI", label: "速" },
  { key: "LUK", label: "運" },
];

export interface ExplorationSkillEventBlockProps {
  eventMessage: string;
  partyDisplayNames: string[];
  partyIconFilenames: (string | null)[];
  partyPositions: { row: number; col: number }[];
  partyHp: number[];
  partyMp: number[];
  partyMaxHp: number[];
  partyMaxMp: number[];
  consumables?: CarriedConsumableChoice[];
  partyMembers?: ExplorationPartyMemberChoice[];
  totalHp?: number;
  totalMp?: number;
}

export function ExplorationSkillEventBlock({
  eventMessage,
  partyDisplayNames,
  partyIconFilenames,
  partyPositions,
  partyHp,
  partyMp,
  partyMaxHp,
  partyMaxMp,
  consumables = [],
  partyMembers = [],
}: ExplorationSkillEventBlockProps) {
  const [isPending, startTransition] = useTransition();
  const [resolved, setResolved] = useState<{
    skillSuccess: boolean;
    logLine: string;
  } | null>(null);

  const handleStatChoice = (stat: string) => {
    startTransition(async () => {
      const result = await resolveExplorationSkillEvent(stat);
      if (result.success) {
        setResolved({
          skillSuccess: result.skillSuccess,
          logLine: result.logLine,
        });
      } else {
        alert(result.message ?? "判定に失敗しました。");
      }
    });
  };

  const partyIcons = partyDisplayNames.map(
    (_, i) => partyIconFilenames[i] ?? null
  );

  return (
    <div className="border border-base-border rounded-lg p-4 max-sm:p-2 bg-base-elevated space-y-4">
      <div className="text-brass font-medium text-sm">技能イベント</div>

      <div className="space-y-2 overflow-x-auto">
        {DISPLAY_LINES.map(({ allyRow, partyIndex }) => (
          <div
            key={allyRow}
            className="flex items-center gap-3 max-sm:gap-1.5 flex-nowrap min-w-0"
          >
            <div className="shrink-0 w-28 max-sm:w-20">
              {partyDisplayNames[partyIndex] != null ? (
                <CompactUnit
                  name={partyDisplayNames[partyIndex]!}
                  hpCurrent={partyHp[partyIndex] ?? 0}
                  hpMax={partyMaxHp[partyIndex] ?? 1}
                  mpCurrent={partyMp[partyIndex] ?? 0}
                  mpMax={partyMaxMp[partyIndex] ?? 1}
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
            <div className="inline-block border border-base-border rounded p-1 max-sm:p-0.5 bg-base-elevated shrink-0 min-w-0 opacity-50">
              <span className="inline-flex items-center justify-center rounded bg-base-border/30 text-text-muted/50 text-xs font-mono w-[7rem] max-sm:w-20 h-10 max-sm:h-7">
                —
              </span>
            </div>
            <div className="shrink-0 w-28 max-sm:w-20" aria-hidden />
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-base-border text-sm space-y-3">
        <p className="text-text-primary">{eventMessage}</p>
        {resolved ? (
          <>
            <p
              className={
                resolved.skillSuccess
                  ? "text-green-600 dark:text-green-400 font-medium"
                  : "text-red-600 dark:text-red-400 font-medium"
              }
            >
              {resolved.logLine}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <ExplorationNextButton
                useAdvanceAction
                className="inline-flex items-center justify-center rounded border border-base-border bg-base-elevated px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border/50 disabled:opacity-50 disabled:pointer-events-none"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {SKILL_STAT_LABELS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                disabled={isPending}
                onClick={() => handleStatChoice(key)}
                className="px-3 py-1.5 rounded border border-base-border bg-base-elevated text-text-primary text-sm hover:bg-base-border/50 disabled:opacity-50"
              >
                {label}（{key}）
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
