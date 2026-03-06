"use client";

/**
 * ラウンド後「消耗品を使う」UI。一種類・対象キャラを選んで使用。spec/049 Phase 4
 */

import { useState, useTransition } from "react";
import type { CarriedConsumableChoice, ExplorationPartyMemberChoice } from "@/server/actions/exploration";
import { applyExplorationConsumable } from "@/server/actions/exploration";

type Props = {
  consumables: CarriedConsumableChoice[];
  partyMembers: ExplorationPartyMemberChoice[];
  onApplied?: (params: {
    targetCharacterId: string;
    effectType: "hp_percent" | "mp_percent";
    recoveredAmount: number;
  }) => void;
};

export function ExplorationConsumableUseClient({ consumables, partyMembers, onApplied }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const c of consumables) {
      initial[c.itemId] = c.quantity;
    }
    return initial;
  });

  const canUse =
    consumables.length > 0 &&
    partyMembers.length > 0 &&
    selectedItemId &&
    selectedCharacterId &&
    !isPending &&
    (localQuantities[selectedItemId] ?? 0) > 0;

  const handleUse = () => {
    if (!canUse || !selectedItemId || !selectedCharacterId) return;
    startTransition(async () => {
      const result = await applyExplorationConsumable(selectedItemId, selectedCharacterId);
      if (result.success) {
        const target = partyMembers.find((m) => m.characterId === selectedCharacterId);
        const targetName = target?.displayName ?? "ターゲット";
        const statLabel = result.effectType === "hp_percent" ? "HP" : "MP";
        setMessage(`${targetName} の ${statLabel} が ${result.recoveredAmount} 回復した。`);
        setLocalQuantities((prev) => ({
          ...prev,
          [selectedItemId]: Math.max(0, (prev[selectedItemId] ?? 0) - 1),
        }));
        onApplied?.({
          targetCharacterId: selectedCharacterId,
          effectType: result.effectType,
          recoveredAmount: result.recoveredAmount,
        });
      } else {
        alert(result.message ?? "使用に失敗しました。");
      }
    });
  };

  if (consumables.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-base-border bg-base/50 p-3 space-y-2">
      <p className="text-xs font-medium text-text-muted">消耗品を使う</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-text-muted">種類</label>
          <select
            className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary min-w-[140px]"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={isPending}
          >
            <option value="">選ぶ</option>
            {consumables.map((c) => (
              <option key={c.itemId} value={c.itemId}>
                {c.itemName}（残{localQuantities[c.itemId] ?? c.quantity}）
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-text-muted">誰に</label>
          <select
            className="rounded border border-base-border bg-base px-2 py-1 text-sm text-text-primary min-w-[120px]"
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
            disabled={isPending}
          >
            <option value="">選ぶ</option>
            {partyMembers.map((m) => (
              <option key={m.characterId} value={m.characterId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleUse}
          disabled={!canUse}
          className="rounded border border-base-border bg-base-elevated px-3 py-1.5 text-sm text-text-primary hover:bg-base-border/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "使用中..." : "使う"}
        </button>
      </div>
      {message && <p className="text-[11px] text-text-muted">{message}</p>}
    </div>
  );
}
