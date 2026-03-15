"use client";

import { useState } from "react";
import type { CarriedConsumableChoice, ExplorationPartyMemberChoice } from "@/server/actions/exploration";
import { ExplorationConsumableUseClient } from "./exploration-consumable-use-client";

/** バー1本＋中に current/max をオーバーレイ（サイクル/ターンブロックと同じ） */
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

/** 1行: HP/MPバー → アイコン → 名前（3x3グリッドは使わない） */
function PartyStatusRow({
  name,
  hpCurrent,
  hpMax,
  mpCurrent,
  mpMax,
  iconFilename,
}: {
  name: string;
  hpCurrent: number;
  hpMax: number;
  mpCurrent: number;
  mpMax: number;
  iconFilename: string | null;
}) {
  return (
    <div className="flex items-center gap-3 flex-nowrap min-w-0">
      <div className="flex flex-col gap-1 shrink-0 w-28 max-sm:w-20">
        <BarWithOverlay current={hpCurrent} max={hpMax} barColor="bg-green-600" />
        <BarWithOverlay current={mpCurrent} max={mpMax} barColor="bg-blue-600" />
      </div>
      <div className="inline-flex items-center justify-center overflow-hidden rounded bg-base-border/50 w-10 h-10 max-sm:w-7 max-sm:h-7 shrink-0">
        {iconFilename ? (
          <img src={`/icons/${iconFilename}`} alt="" className="w-full h-full object-contain" />
        ) : (
          <span className="text-text-muted/50 text-xs" aria-hidden>－</span>
        )}
      </div>
      <span className="text-sm text-text-primary truncate min-w-0" title={name}>
        {name}
      </span>
    </div>
  );
}

type Props = {
  partyDisplayNames: string[];
  partyHp: number[];
  partyMp: number[];
  partyMaxHp: number[];
  partyMaxMp: number[];
  remainingAfter: number;
  consumables: CarriedConsumableChoice[];
  partyMembers: ExplorationPartyMemberChoice[];
  /** 戦闘後は BattleResult から渡す。復帰時は未指定で枠のみ表示 */
  partyIconFilenames?: (string | null)[];
  protagonistIconFilename?: string | null;
  /** 復帰画面で使うときは "現在のパーティ状況" など */
  sectionTitle?: string;
};

export function ExplorationAfterBattleStatusClient({
  partyDisplayNames,
  partyHp,
  partyMp,
  partyMaxHp,
  partyMaxMp,
  remainingAfter,
  consumables,
  partyMembers,
  partyIconFilenames,
  protagonistIconFilename = null,
  sectionTitle = "BattleResult...",
}: Props) {
  const [hpState, setHpState] = useState<number[]>(partyHp);
  const [mpState, setMpState] = useState<number[]>(partyMp);

  const handleApplied = (params: {
    targetCharacterId: string;
    effectType: "hp_percent" | "mp_percent";
    recoveredAmount: number;
  }) => {
    const idx = partyMembers.findIndex((m) => m.characterId === params.targetCharacterId);
    if (idx < 0) return;
    if (params.effectType === "hp_percent") {
      setHpState((prev) => {
        const next = [...prev];
        next[idx] = next[idx] + params.recoveredAmount;
        return next;
      });
    } else {
      setMpState((prev) => {
        const next = [...prev];
        next[idx] = next[idx] + params.recoveredAmount;
        return next;
      });
    }
  };

  const icons = partyIconFilenames ?? partyDisplayNames.map(() => null);
  const fallbackIcon = protagonistIconFilename ?? null;

  return (
    <>
      <h2 className="text-sm font-medium text-text-muted">{sectionTitle}</h2>
      <div className="mt-2 space-y-2">
        {partyDisplayNames.map((name, i) => (
          <PartyStatusRow
            key={i}
            name={name}
            hpCurrent={hpState[i] ?? 0}
            hpMax={partyMaxHp[i] ?? 1}
            mpCurrent={mpState[i] ?? 0}
            mpMax={partyMaxMp[i] ?? 1}
            iconFilename={icons[i] ?? fallbackIcon}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="text-xs text-text-muted">残り戦闘数: {remainingAfter}</span>
      </div>

      <ExplorationConsumableUseClient
        consumables={consumables}
        partyMembers={partyMembers}
        onApplied={handleApplied}
      />
    </>
  );
}

