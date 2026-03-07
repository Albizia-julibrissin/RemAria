"use client";

// spec/051 - キャラ詳細での遺物4枠・装着・解除。装着はモーダルで候補を一覧表示（装備と同様の案D）

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { equipRelic, unequipRelic } from "@/server/actions/relic";
import type { CharacterRelicSlot, RelicInstanceSummary } from "@/server/actions/relic";
import { EquipRelicModal } from "./equip-relic-modal";

function formatRelicShort(r: RelicInstanceSummary): string {
  const parts: string[] = [r.relicTypeName];
  if (r.relicPassiveEffectName) parts.push(r.relicPassiveEffectName);
  if (r.statBonus1) parts.push(`${r.statBonus1.stat}+${r.statBonus1.percent}%`);
  if (r.statBonus2) parts.push(`${r.statBonus2.stat}+${r.statBonus2.percent}%`);
  return parts.join(" ");
}

type Props = {
  characterId: string;
  slots: CharacterRelicSlot[];
  allRelics: RelicInstanceSummary[];
};

export function CharacterRelicSection({
  characterId,
  slots,
  allRelics,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalSlot, setModalSlot] = useState<number | null>(null);

  const handleUnequip = (slot: number) => {
    startTransition(async () => {
      const result = await unequipRelic(characterId, slot);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  };

  const handleEquip = (slot: number, relicInstanceId: string) => {
    startTransition(async () => {
      const result = await equipRelic(characterId, slot, relicInstanceId);
      if (result.success) {
        setModalSlot(null);
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  };

  const availableRelics = allRelics.filter(
    (r) => r.equippedCharacterId === null || r.equippedCharacterId === characterId
  );

  const availableForModal =
    modalSlot != null
      ? availableRelics.filter((r) => {
          const row = slots.find((s) => s.slot === modalSlot);
          return row?.relicInstance?.id !== r.id;
        })
      : [];

  return (
    <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
      <h2 className="text-lg font-medium text-text-primary">遺物（4枠）</h2>
      <p className="mt-1 text-sm text-text-muted">
        探索で入手した遺物の原石を鑑定すると遺物が手に入ります。ここで装着すると戦闘で属性耐性などが反映されます。
      </p>
      <ul className="mt-4 space-y-3">
        {slots.map((row) => {
          const available = availableRelics.filter(
            (r) => row.relicInstance?.id !== r.id
          );
          return (
            <li
              key={row.slot}
              className="flex flex-wrap items-center gap-2 rounded border border-base-border bg-base p-3 text-sm"
            >
              <span className="w-16 shrink-0 text-text-muted">枠{row.slot}</span>
              <span className="min-w-0 flex-1 font-medium text-text-primary">
                {row.relicInstance
                  ? formatRelicShort(row.relicInstance)
                  : "未装着"}
              </span>
              {row.relicInstance && (
                <button
                  type="button"
                  onClick={() => handleUnequip(row.slot)}
                  disabled={isPending}
                  className="rounded border border-base-border px-2 py-1 text-xs text-text-muted hover:bg-base-border/50 disabled:opacity-50"
                >
                  外す
                </button>
              )}
              {available.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModalSlot(row.slot)}
                  disabled={isPending}
                  className="rounded border border-brass bg-brass px-2 py-1 text-xs font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                >
                  装着する
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <EquipRelicModal
        isOpen={modalSlot != null}
        onClose={() => setModalSlot(null)}
        slotNumber={modalSlot ?? 0}
        availableRelics={availableForModal}
        onEquip={handleEquip}
        isPending={isPending}
      />
    </div>
  );
}
