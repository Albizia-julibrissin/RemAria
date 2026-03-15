"use client";

// 遺物装着モーダル：スロット候補を一覧で表示し、装着する（装備の案Dと同様）

import { useRef, useEffect } from "react";
import { ATTRIBUTE_RESISTANCE_KEYS, ATTRIBUTE_RESISTANCE_LABELS } from "@/lib/constants/relic";
import type { RelicInstanceSummary } from "@/server/actions/relic";

function formatStatBonus(b: { stat: string; percent: number } | null): string {
  if (!b) return "—";
  return `${b.stat}+${b.percent}%`;
}

/** 1.0=通常なので「—」、それ以外は軽減/弱体を%表示 */
function formatResistValue(val: number | undefined): string {
  if (val == null || val === 1) return "—";
  const pct = Math.round(val * 100);
  if (pct === 100) return "—";
  if (pct < 100) return `${100 - pct}%軽減`;
  return `${pct - 100}%弱体`;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  slotNumber: number;
  availableRelics: RelicInstanceSummary[];
  onEquip: (slot: number, relicInstanceId: string) => void;
  isPending: boolean;
};

export function EquipRelicModal({
  isOpen,
  onClose,
  slotNumber,
  availableRelics,
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
      aria-labelledby="equip-relic-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg border border-base-border bg-base-elevated shadow-lg flex flex-col">
        <div className="border-b border-base-border px-4 py-3">
          <h2 id="equip-relic-modal-title" className="text-lg font-medium text-text-primary">
            枠{slotNumber}に装着
          </h2>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {availableRelics.length === 0 ? (
            <p className="text-sm text-text-muted">この枠に装着できる遺物がありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-base-border text-left text-text-muted">
                    <th className="py-2 pr-2 font-medium">名前</th>
                    <th className="py-2 px-1 font-medium">パッシブ効果</th>
                    <th className="py-2 px-1 font-medium">ステ1</th>
                    <th className="py-2 px-1 font-medium">ステ2</th>
                    {ATTRIBUTE_RESISTANCE_KEYS.map((key) => (
                      <th key={key} className="py-2 px-0.5 text-center font-medium text-xs">
                        {ATTRIBUTE_RESISTANCE_LABELS[key]}
                      </th>
                    ))}
                    <th className="w-20 py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {availableRelics.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-base-border/70 text-text-primary hover:bg-base-border/30"
                    >
                      <td className="py-2 pr-2 font-medium">{r.relicTypeName}</td>
                      <td className="py-2 px-1 text-text-muted">
                        <span
                          title={r.relicPassiveEffectDescription ?? undefined}
                          className={
                            r.relicPassiveEffectDescription
                              ? "cursor-help border-b border-dotted border-text-muted"
                              : undefined
                          }
                        >
                          {r.relicPassiveEffectName ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 px-1 tabular-nums">
                        {formatStatBonus(r.statBonus1)}
                      </td>
                      <td className="py-2 px-1 tabular-nums">
                        {formatStatBonus(r.statBonus2)}
                      </td>
                      {ATTRIBUTE_RESISTANCE_KEYS.map((key) => {
                        const val = r.attributeResistances?.[key];
                        const s = formatResistValue(val);
                        return (
                          <td
                            key={key}
                            className="py-2 px-0.5 text-center text-xs tabular-nums"
                          >
                            {s === "—" ? (
                              <span className="text-text-muted">—</span>
                            ) : (
                              <span className={val != null && val < 1 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                                {s}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 pl-2">
                        <button
                          type="button"
                          onClick={() => onEquip(slotNumber, r.id)}
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
