"use client";

// spec/046 - キャラ詳細での装備着脱。装着はモーダルで候補をステータス一覧表示（案D）

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { equipEquipment, unequipEquipment } from "@/server/actions/craft";
import { EQUIPMENT_SLOT_LABELS } from "@/lib/constants/equipment-slots";
import type { CharacterEquipmentSlot } from "@/server/actions/craft";
import type { EquipmentInstanceWithEquipped } from "@/server/actions/craft";
import { EquipEquipmentModal } from "./equip-equipment-modal";

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
  const [modalSlot, setModalSlot] = useState<string | null>(null);

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
        setModalSlot(null);
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  }

  const modalSlotRow = modalSlot ? slots.find((s) => s.slot === modalSlot) : null;
  const slotLabel = modalSlotRow
    ? EQUIPMENT_SLOT_LABELS[modalSlotRow.slot as keyof typeof EQUIPMENT_SLOT_LABELS] ?? modalSlotRow.slot
    : "";
  const availableForModal =
    modalSlot != null
      ? allEquipment.filter(
          (e) =>
            e.slot === modalSlot &&
            (e.equippedCharacterId === null || e.equippedCharacterId === characterId) &&
            (modalSlotRow?.equipmentInstanceId == null || e.id !== modalSlotRow.equipmentInstanceId)
        )
      : [];

  return (
    <div className="mt-6 rounded-lg border border-base-border bg-base-elevated p-6">
      <h2 className="text-lg font-medium text-text-primary">装備</h2>
      <p className="mt-1 text-sm text-text-muted">
        各スロットに装備を装着できます。クラフトで作った装備は倉庫に追加されます。
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

      <EquipEquipmentModal
        isOpen={modalSlot != null}
        onClose={() => setModalSlot(null)}
        slotLabel={slotLabel}
        slotCode={modalSlot ?? ""}
        availableEquipment={availableForModal}
        onEquip={handleEquip}
        isPending={isPending}
      />
    </div>
  );
}
