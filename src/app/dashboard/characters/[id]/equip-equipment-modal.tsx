"use client";

// 装備装着モーダル：スロット候補をステータス一覧で表示し、装着する。HP/MP 含め stats の値をそのまま表示。

import { useRef, useEffect } from "react";
import { EQUIPMENT_STAT_KEYS, EQUIPMENT_STAT_LABELS } from "@/lib/craft/equipment-stat-gen";
import type { EquipmentInstanceWithEquipped } from "@/server/actions/craft";

/** モーダルで表示するステータス（EQUIPMENT_STAT_KEYS に HP/MP 含む）。戦闘時も同値がそのまま加算される（spec/071）。 */
const DISPLAY_STAT_KEYS = EQUIPMENT_STAT_KEYS;
const DISPLAY_STAT_LABELS = EQUIPMENT_STAT_LABELS;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  slotLabel: string;
  slotCode: string;
  availableEquipment: EquipmentInstanceWithEquipped[];
  onEquip: (slot: string, equipmentInstanceId: string) => void;
  isPending: boolean;
};

export function EquipEquipmentModal({
  isOpen,
  onClose,
  slotLabel,
  slotCode,
  availableEquipment,
  onEquip,
  isPending,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="equip-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg border border-base-border bg-base-elevated shadow-lg flex flex-col">
        <div className="flex items-center justify-between border-b border-base-border px-4 py-3">
          <h2 id="equip-modal-title" className="text-lg font-medium text-text-primary">
            {slotLabel}に装着
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-base-border hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brass"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {availableEquipment.length === 0 ? (
            <p className="text-sm text-text-muted">このスロットに装着できる装備がありません。</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-base-border text-left text-text-muted">
                      <th className="py-2 pr-3 font-medium">名前</th>
                      {DISPLAY_STAT_KEYS.map((key) => (
                        <th key={key} className="py-2 px-1 text-center font-medium">
                          {DISPLAY_STAT_LABELS[key]}
                        </th>
                      ))}
                      <th className="w-20 py-2 pl-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableEquipment.map((eq) => (
                      <tr
                        key={eq.id}
                        className="border-b border-base-border/70 text-text-primary hover:bg-base-border/30"
                      >
                        <td className="py-2 pr-3 font-medium">{eq.equipmentTypeName}</td>
                        {DISPLAY_STAT_KEYS.map((key) => {
                          const val = eq.stats?.[key];
                          return (
                            <td key={key} className="py-2 px-1 text-center tabular-nums">
                              {val != null && val !== 0 ? (
                                <span className={val > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                  {val > 0 ? "+" : ""}{val}
                                </span>
                              ) : (
                                <span className="text-text-muted">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 pl-2">
                          <button
                            type="button"
                            onClick={() => onEquip(slotCode, eq.id)}
                            disabled={isPending}
                            className="rounded border border-brass bg-brass px-2 py-1 text-xs font-medium text-white hover:bg-brass-hover disabled:opacity-50"
                          >
                            装着
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
