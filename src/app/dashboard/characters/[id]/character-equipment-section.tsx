"use client";

// spec/046 - キャラ詳細での装備着脱

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { equipEquipment, unequipEquipment } from "@/server/actions/craft";
import { EQUIPMENT_SLOT_LABELS } from "@/lib/constants/equipment-slots";
import type { CharacterEquipmentSlot } from "@/server/actions/craft";
import type { EquipmentInstanceWithEquipped } from "@/server/actions/craft";

type Props = {
  characterId: string;
  slots: CharacterEquipmentSlot[];
  allEquipment: EquipmentInstanceWithEquipped[];
};

export function CharacterEquipmentSection({
  characterId,
  slots,
  allEquipment,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleUnequip(slot: string) {
    startTransition(async () => {
      const result = await unequipEquipment(characterId, slot);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  }

  function handleEquip(slot: string, equipmentInstanceId: string) {
    startTransition(async () => {
      const result = await equipEquipment(characterId, slot, equipmentInstanceId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
      <h2 className="text-lg font-medium text-text-primary">装備</h2>
      <p className="mt-1 text-sm text-text-muted">
        各スロットに装備を装着できます。クラフトで作った装備はバッグに追加されます。
      </p>
      <ul className="mt-4 space-y-3">
        {slots.map((row) => {
          const slotLabel = EQUIPMENT_SLOT_LABELS[row.slot as keyof typeof EQUIPMENT_SLOT_LABELS] ?? row.slot;
          const available = allEquipment.filter(
            (e) =>
              e.slot === row.slot &&
              (e.equippedCharacterId === null || e.equippedCharacterId === characterId) &&
              e.id !== row.equipmentInstanceId
          );
          return (
            <li
              key={row.slot}
              className="flex flex-wrap items-center gap-2 rounded border border-base-border bg-base p-3 text-sm"
            >
              <span className="w-20 shrink-0 text-text-muted">{slotLabel}</span>
              <span className="min-w-0 flex-1 font-medium text-text-primary">
                {row.equipmentInstanceName ?? "未装着"}
              </span>
              {row.equipmentInstanceId && (
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
                <span className="flex items-center gap-1">
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
                    {available.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.equipmentTypeName}
                      </option>
                    ))}
                  </select>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
