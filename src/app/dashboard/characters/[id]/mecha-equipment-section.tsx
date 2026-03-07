"use client";

// spec/046 - メカ詳細でのメカパーツ着脱。装着はモーダルで候補をステータス一覧表示（装備・遺物と同様の案D）

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { equipMechaPart, unequipMechaPart } from "@/server/actions/mecha-equipment";
import { MECHA_SLOT_LABELS } from "@/lib/constants/mecha-slots";
import type { MechaEquipmentSlotRow } from "@/server/actions/mecha-equipment";
import type { MechaPartInstanceWithEquipped } from "@/server/actions/mecha-equipment";
import { EquipMechaPartModal } from "./equip-mecha-part-modal";

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
  const [modalSlot, setModalSlot] = useState<string | null>(null);

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
        setModalSlot(null);
        router.refresh();
      } else {
        alert(result.message);
      }
    });
  }

  const modalSlotRow = modalSlot ? slots.find((s) => s.slot === modalSlot) : null;
  const slotLabel =
    modalSlotRow &&
    (MECHA_SLOT_LABELS[modalSlotRow.slot as keyof typeof MECHA_SLOT_LABELS] ?? modalSlotRow.slot);
  const availableForModal =
    modalSlot != null
      ? allParts.filter(
          (p) =>
            p.slot === modalSlot &&
            (p.equippedCharacterId === null || p.equippedCharacterId === characterId) &&
            (modalSlotRow?.mechaPartInstanceId == null || p.id !== modalSlotRow.mechaPartInstanceId)
        )
      : [];

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

      <EquipMechaPartModal
        isOpen={modalSlot != null}
        onClose={() => setModalSlot(null)}
        slotLabel={slotLabel ?? ""}
        slotCode={modalSlot ?? ""}
        availableParts={availableForModal}
        onEquip={handleEquip}
        isPending={isPending}
      />
    </div>
  );
}
