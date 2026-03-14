"use client";

// spec/047 - 設備建造フォーム

import { useRouter } from "next/navigation";
import { useTransition, useEffect, useState } from "react";
import {
  getConstructionRecipeWithStock,
  placeFacility,
  type UnlockedFacilityType,
  type ConstructionRecipeRow,
} from "@/server/actions/facilities-placement";

type Props = {
  unlockedTypes: UnlockedFacilityType[];
  usedSlots: number;
  maxSlots: number;
  usedCost: number;
  maxCost: number;
};

export function PlaceFacilityForm({
  unlockedTypes,
  usedSlots,
  maxSlots,
  usedCost,
  maxCost,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [rows, setRows] = useState<ConstructionRecipeRow[] | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedType = unlockedTypes.find((u) => u.id === selectedTypeId);
  const hasShortage = rows?.some((r) => r.shortfall > 0) ?? false;
  const canBuild =
    selectedType &&
    rows !== null &&
    !hasShortage &&
    usedSlots < maxSlots &&
    usedCost + selectedType.cost <= maxCost;

  useEffect(() => {
    if (!selectedTypeId) {
      setRows(null);
      return;
    }
    setRecipeLoading(true);
    setRows(null);
    getConstructionRecipeWithStock(selectedTypeId)
      .then((r) => {
        setRows(r ?? []);
      })
      .finally(() => {
        setRecipeLoading(false);
      });
  }, [selectedTypeId]);

  function handleBuild() {
    if (!selectedTypeId || !canBuild) return;
    setMessage(null);
    startTransition(async () => {
      const result = await placeFacility(selectedTypeId);
      if (result.success) {
        router.refresh();
        setMessage(`「${result.facilityName}」を配置しました。`);
        setSelectedTypeId("");
        setRows(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  if (unlockedTypes.length === 0) return null;

  return (
    <section id="facility-build" className="mt-8 rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
      <h2 className="text-lg font-medium text-text-primary">
        設備建造
        <a href="#operating-facilities" className="ml-2 text-sm text-brass hover:text-brass-hover">
          ← 稼働設備へ
        </a>
      </h2>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">建造対象を選択</span>
          <select
            value={selectedTypeId}
            onChange={(e) => setSelectedTypeId(e.target.value)}
            className="rounded border border-base-border bg-base px-3 py-2 text-text-primary focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
          >
            <option value="">選択してください</option>
            {unlockedTypes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}（コスト {u.cost}）
              </option>
            ))}
          </select>
        </label>
        {recipeLoading && (
          <span className="text-sm text-text-muted">取得中…</span>
        )}
      </div>
      {rows !== null && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-base-border text-text-muted">
                <th className="py-2 pr-4 text-left font-medium">必要資材</th>
                <th className="py-2 pr-4 text-left font-medium">必要量</th>
                <th className="py-2 pr-4 text-left font-medium">在庫</th>
                <th className="py-2 text-left font-medium">不足数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-b border-base-border/60">
                  <td className="py-2 pr-4 text-text-primary">{r.itemName}</td>
                  <td className="py-2 pr-4 tabular-nums text-success">{r.amount}</td>
                  <td className="py-2 pr-4 tabular-nums text-success">{r.stock}</td>
                  <td className="py-2">
                    {r.shortfall > 0 ? (
                      <span className="tabular-nums text-error">{r.shortfall}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {message && (
        <p
          className={`mt-3 text-sm ${message.startsWith("「") ? "text-success" : "text-error"}`}
        >
          {message}
        </p>
      )}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleBuild}
          disabled={isPending || !canBuild}
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          {isPending ? "建造中…" : "建造"}
        </button>
        {selectedType && hasShortage && (
          <span className="ml-2 text-sm text-text-muted">資材が不足しています</span>
        )}
        {selectedType && !hasShortage && usedSlots >= maxSlots && (
          <span className="ml-2 text-sm text-text-muted">設置枠が足りません</span>
        )}
        {selectedType &&
          !hasShortage &&
          usedCost + selectedType.cost > maxCost &&
          usedSlots < maxSlots && (
            <span className="ml-2 text-sm text-text-muted">コスト上限を超えます</span>
          )}
      </div>
    </section>
  );
}
