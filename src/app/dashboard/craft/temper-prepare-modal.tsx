"use client";

// 鍛錬準備モーダル：材料グリッド（材料・在庫・必要量・不足量）、戻る・鍛錬、鍛錬後に結果を追記表示

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TemperableEquipmentRow } from "@/server/actions/craft";
import { getTemperMaterialStocks, temperEquipment } from "@/server/actions/craft";
import type { RecipeMaterialStockRow } from "@/server/actions/craft";
import { EQUIPMENT_STAT_KEYS, EQUIPMENT_STAT_LABELS } from "@/lib/craft/equipment-stat-gen";

type Props = {
  equipment: TemperableEquipmentRow;
  equipmentLabel: string; // 例: 鉄の剣（主武器）
  onClose: () => void;
};

const TEMPER_COOLDOWN_MS = 1500;

function shortage(required: number, stock: number): number {
  return Math.max(0, required - stock);
}

export function TemperPrepareModal({ equipment, equipmentLabel, onClose }: Props) {
  const router = useRouter();
  const [materialRows, setMaterialRows] = useState<RecipeMaterialStockRow[] | null>(null);
  const [temperResult, setTemperResult] = useState<{
    stats: Record<string, number>;
    statCap: number;
    capCeiling: number;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTempering, startTemperTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTemperMaterialStocks(equipment.id).then((res) => {
      if (!cancelled && res) setMaterialRows(res.materialRows);
    });
    return () => {
      cancelled = true;
    };
  }, [equipment.id]);

  function handleTemper() {
    if (isOnCooldown) return;
    setIsOnCooldown(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      cooldownTimerRef.current = null;
      setIsOnCooldown(false);
    }, TEMPER_COOLDOWN_MS);

    startTemperTransition(async () => {
      const result = await temperEquipment(equipment.id);
      if (result.success) {
        router.refresh();
        setTemperResult({
          stats: result.stats,
          statCap: result.statCap,
          capCeiling: equipment.capCeiling,
        });
        setSuccessMessage(result.message);
      } else {
        alert(result.message);
      }
    });
  }

  const canTemper =
    materialRows != null &&
    materialRows.length > 0 &&
    materialRows.every((row) => row.stock >= row.required);

  const statEntries =
    temperResult != null
      ? (EQUIPMENT_STAT_KEYS.filter(
          (key) => typeof temperResult.stats[key] === "number" && temperResult.stats[key] !== 0
        ).map((key) => [key, temperResult.stats[key]] as [string, number]))
      : [];
  const statTotal =
    temperResult != null
      ? Object.values(temperResult.stats).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temper-prepare-title"
    >
      <div className="w-full max-w-md rounded-lg border border-base-border bg-base-elevated p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 id="temper-prepare-title" className="text-lg font-medium text-text-primary">
          {equipmentLabel} を鍛錬する
        </h2>

        <div className="mt-4">
          {materialRows == null ? (
            <p className="text-sm text-text-muted">読み込み中…</p>
          ) : materialRows.length === 0 ? (
            <p className="text-sm text-text-muted">必要な材料はありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-base-border text-left">
                    <th className="py-1.5 pr-2 text-text-muted font-medium">材料</th>
                    <th className="py-1.5 pr-2 text-text-muted font-medium text-right">在庫</th>
                    <th className="py-1.5 pr-2 text-text-muted font-medium text-right">必要量</th>
                    <th className="py-1.5 text-text-muted font-medium text-right">不足量</th>
                  </tr>
                </thead>
                <tbody>
                  {materialRows.map((row) => {
                    const short = shortage(row.required, row.stock);
                    return (
                      <tr key={row.itemId} className="border-b border-base-border/70">
                        <td className="py-1.5 pr-2 text-text-primary">{row.itemName}</td>
                        <td className="py-1.5 pr-2 text-right text-text-primary">{row.stock}</td>
                        <td className="py-1.5 pr-2 text-right text-text-primary">{row.required}</td>
                        <td className="py-1.5 text-right">
                          <span className={short > 0 ? "text-amber-600 dark:text-amber-400" : "text-text-muted"}>
                            {short}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {successMessage != null && (
          <div className="mt-4 pt-4 border-t border-base-border text-sm">
            <p className="text-brass">{successMessage}</p>
          </div>
        )}

        {temperResult != null && (
          <div className="mt-4 pt-4 border-t border-base-border space-y-2 text-sm">
            <p className="font-medium text-brass">鍛錬後のステータス</p>
            {statEntries.length > 0 && (
              <ul className="space-y-0.5">
                {statEntries.map(([key, value]) => (
                  <li key={key} className="flex justify-between">
                    <span className="text-text-muted">
                      {EQUIPMENT_STAT_LABELS[key as keyof typeof EQUIPMENT_STAT_LABELS] ?? key}
                    </span>
                    <span className="text-text-primary">+{value}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between pt-1">
              <span className="text-text-muted">合計能力値</span>
              <span className="text-text-primary font-medium">{statTotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">上限能力値（CAP）</span>
              <span className="text-brass font-medium">
                {temperResult.statCap} / {temperResult.capCeiling}
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-base-border bg-base px-4 py-2 text-sm font-medium text-text-primary hover:bg-base-border focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={handleTemper}
            disabled={isTempering || !canTemper || isOnCooldown}
            className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
          >
            {isTempering ? "鍛錬中…" : isOnCooldown ? "クール中…" : "鍛錬"}
          </button>
        </div>
      </div>
    </div>
  );
}
