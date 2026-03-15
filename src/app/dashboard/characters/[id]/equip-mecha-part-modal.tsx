"use client";

// メカパーツ装着モーダル：部位候補を基礎ステ一覧で表示し、装着する（装備・遺物の案Dと同様）

import { useRef, useEffect } from "react";
import { MECHA_PART_BASE_STAT_KEYS } from "@/lib/craft/mecha-part-stat-gen";
import type { MechaPartInstanceWithEquipped } from "@/server/actions/mecha-equipment";

/** 基礎ステ表示名（キャラ詳細の基礎ステと揃える） */
const BASE_STAT_LABELS: Record<(typeof MECHA_PART_BASE_STAT_KEYS)[number], string> = {
  STR: "STR",
  INT: "INT",
  VIT: "VIT",
  WIS: "WIS",
  DEX: "DEX",
  AGI: "AGI",
  LUK: "LUK",
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  slotLabel: string;
  slotCode: string;
  availableParts: MechaPartInstanceWithEquipped[];
  onEquip: (slot: string, mechaPartInstanceId: string) => void;
  isPending: boolean;
};

export function EquipMechaPartModal({
  isOpen,
  onClose,
  slotLabel,
  slotCode,
  availableParts,
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
      aria-labelledby="equip-mecha-part-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-base-border bg-base-elevated shadow-lg">
        <div className="border-b border-base-border px-4 py-3">
          <h2 id="equip-mecha-part-modal-title" className="text-lg font-medium text-text-primary">
            {slotLabel}に装着
          </h2>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {availableParts.length === 0 ? (
            <p className="text-sm text-text-muted">この部位に装着できるパーツがありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-base-border text-left text-text-muted">
                    <th className="py-2 pr-3 font-medium">名前</th>
                    <th className="py-2 pr-2 font-medium">習得スキル</th>
                    {MECHA_PART_BASE_STAT_KEYS.map((key) => (
                      <th key={key} className="py-2 px-1 text-center font-medium">
                        {BASE_STAT_LABELS[key]}
                      </th>
                    ))}
                    <th className="w-20 py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {availableParts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-base-border/70 text-text-primary hover:bg-base-border/30"
                    >
                      <td className="py-2 pr-3 font-medium">{p.mechaPartTypeName}</td>
                      <td className="py-2 pr-2 text-text-muted">
                        {p.skillNames.length > 0 ? (
                          <span className="text-xs">{p.skillNames.join("、")}</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      {MECHA_PART_BASE_STAT_KEYS.map((key) => {
                        const val = p.stats?.[key];
                        return (
                          <td key={key} className="py-2 px-1 text-center tabular-nums">
                            {val != null && val !== 0 ? (
                              <span
                                className={
                                  val > 0
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }
                              >
                                {val > 0 ? "+" : ""}
                                {val}
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
                          onClick={() => onEquip(slotCode, p.id)}
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
          )}
        </div>
      </div>
    </div>
  );
}
