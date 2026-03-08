"use client";

import { useState } from "react";
import type { CarriedConsumableChoice, ExplorationPartyMemberChoice } from "@/server/actions/exploration";
import { ExplorationConsumableUseClient } from "./exploration-consumable-use-client";
import { ExplorationNextButton } from "./exploration-next-button";

type Props = {
  partyDisplayNames: string[];
  partyHp: number[];
  partyMp: number[];
  partyMaxHp: number[];
  partyMaxMp: number[];
  remainingAfter: number;
  consumables: CarriedConsumableChoice[];
  partyMembers: ExplorationPartyMemberChoice[];
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
  sectionTitle = "戦闘後のパーティ状況",
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

  return (
    <>
      <h2 className="text-sm font-medium text-text-muted">{sectionTitle}</h2>
      <ul className="mt-2 space-y-1 text-sm text-text-primary">
        {partyDisplayNames.map((name, i) => (
          <li key={i} className="flex items-center justify-between">
            <span>{name}</span>
            <span className="text-xs text-text-muted tabular-nums">
              HP {hpState[i] ?? 0}/{partyMaxHp[i] ?? 1} ・ MP {mpState[i] ?? 0}/{partyMaxMp[i] ?? 1}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="text-xs text-text-muted">残り戦闘数: {remainingAfter}</span>
        <ExplorationNextButton href="/battle/exploration?step=next" />
      </div>

      <ExplorationConsumableUseClient
        consumables={consumables}
        partyMembers={partyMembers}
        onApplied={handleApplied}
      />
    </>
  );
}

