"use client";

// spec/047 - 設備建設フォーム

import { useRouter } from "next/navigation";
import { useTransition, useEffect, useState } from "react";
import {
  getConstructionRecipe,
  placeFacility,
  type UnlockedFacilityType,
  type ConstructionRecipeItem,
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
  const [recipe, setRecipe] = useState<ConstructionRecipeItem[] | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedType = unlockedTypes.find((u) => u.id === selectedTypeId);
  const canPlace =
    selectedType &&
    usedSlots < maxSlots &&
    usedCost + (selectedType?.cost ?? 0) <= maxCost;

  useEffect(() => {
    if (!selectedTypeId) {
      setRecipe(null);
      return;
    }
    setRecipeLoading(true);
    setRecipe(null);
    getConstructionRecipe(selectedTypeId)
      .then((r) => {
        setRecipe(r ?? []);
      })
      .finally(() => {
        setRecipeLoading(false);
      });
  }, [selectedTypeId]);

  function handlePlace() {
    if (!selectedTypeId || !canPlace) return;
    setMessage(null);
    startTransition(async () => {
      const result = await placeFacility(selectedTypeId, "base");
      if (result.success) {
        router.refresh();
        setMessage(`「${result.facilityName}」を配置しました。`);
        setSelectedTypeId("");
        setRecipe(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  if (unlockedTypes.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-base-border bg-base-elevated p-6 max-w-2xl">
      <h2 className="text-lg font-medium text-text-primary">設備を建設する</h2>
      <p className="mt-1 text-sm text-text-muted">
        解放済みの設備種別から選んで配置します。建設には資源を消費します。
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-muted">設備種別</span>
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
          <span className="text-sm text-text-muted">必要資源を取得中…</span>
        )}
      </div>
      {recipe !== null && recipe.length > 0 && (
        <div className="mt-3 text-sm text-text-muted">
          必要資源: {recipe.map((r) => `${r.itemName} × ${r.amount}`).join("、")}
        </div>
      )}
      {message && (
        <p
          className={`mt-3 text-sm ${message.startsWith("「") ? "text-green-600" : "text-red-600"}`}
        >
          {message}
        </p>
      )}
      <div className="mt-4">
        <button
          type="button"
          onClick={handlePlace}
          disabled={isPending || !canPlace}
          className="rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
        >
          {isPending ? "配置中…" : "配置する"}
        </button>
        {usedSlots >= maxSlots && (
          <span className="ml-2 text-sm text-text-muted">設置枠が足りません</span>
        )}
        {selectedType &&
          usedCost + selectedType.cost > maxCost &&
          usedSlots < maxSlots && (
            <span className="ml-2 text-sm text-text-muted">コスト上限を超えます</span>
          )}
      </div>
    </section>
  );
}
