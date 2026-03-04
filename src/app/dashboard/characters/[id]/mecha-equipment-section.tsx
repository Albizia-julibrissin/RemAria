"use client";

// spec/046 - メカ詳細でのメカパーツ着脱

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { equipMechaPart, unequipMechaPart } from "@/server/actions/mecha-equipment";
import { MECHA_SLOT_LABELS } from "@/lib/constants/mecha-slots";
import type { MechaEquipmentSlotRow } from "@/server/actions/mecha-equipment";
import type { MechaPartInstanceWithEquipped } from "@/server/actions/mecha-equipment";

type Props = {
  characterId: string;
  slots: MechaEquipmentSlotRow[];
  allParts: MechaPartInstanceWithEquipped[];
};

export function MechaEquipmentSection({
  characterId,
  slots,
  allParts,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleUnequip(slot: string) {
    startTransition(async () => {
      const result = await unequipMechaPart(characterId, slot);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  }

  function handleEquip(slot: string, mechaPartInstanceId: string) {
    startTransition(async () => {
      const result = await equipMechaPart(characterId, slot, mechaPartInstanceId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
      <h2 className="text-lg font-medium text-text-primary">メカパーツ</h2>
      <p className="mt-1 text-sm text-text-muted">
        各部位にパーツを装着できます。クラフトで作ったパーツはバッグに追加されます。
      </p>
      <ul className="mt-4 space-y-3">
        {slots.map((row) => {
          const slotLabel =
            MECHA_SLOT_LABELS[row.slot as keyof typeof MECHA_SLOT_LABELS] ?? row.slot;
          const available = allParts.filter(
            (p) =>
              p.slot === row.slot &&
              (p.equippedCharacterId === null || p.equippedCharacterId === characterId) &&
              p.id !== row.mechaPartInstanceId
          );
          return (
            <li
              key={row.slot}
              className="flex flex-wrap items-center gap-2 rounded border border-base-border bg-base p-3 text-sm"
            >
              <span className="w-24 shrink-0 text-text-muted">{slotLabel}</span>
              <span className="min-w-0 flex-1 font-medium text-text-primary">
                {row.mechaPartTypeName ?? "未装着"}
              </span>
              {row.mechaPartInstanceId && (
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
                <select
                  className="rounded border border-base-border bg-base px-2 py-1 text-text-primary focus:border-brass focus:outline-none"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) {
                      handleEquip(row.slot, id);
                      e.target.value = "";
                    }
                  }}
                  disabled={isPending}
                >
                  <option value="">装着する</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.mechaPartTypeName}
                    </option>
                  ))}
                </select>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
