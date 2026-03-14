"use client";

// spec/046 - クラフト実行ボタン

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { executeCraft } from "@/server/actions/craft";

export type CraftedEquipmentData = {
  name: string;
  stats: Record<string, number>;
  statCap: number;
  capCeiling: number;
};

type Props = {
  recipeId: string;
  recipeName: string;
  onEquipmentCreated?: (data: CraftedEquipmentData) => void;
};

export function CraftExecuteButton({ recipeId, recipeName, onEquipmentCreated }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await executeCraft(recipeId);
      if (result.success) {
        router.refresh();
        if (
          result.equipmentInstanceId &&
          result.equipmentStats != null &&
          result.statCap != null &&
          result.capCeiling != null &&
          result.equipmentTypeName
        ) {
          onEquipmentCreated?.({
            name: result.equipmentTypeName,
            stats: result.equipmentStats,
            statCap: result.statCap,
            capCeiling: result.capCeiling,
          });
        } else {
          alert(result.message);
        }
      } else {
        alert(result.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="shrink-0 rounded bg-brass px-4 py-2 text-sm font-medium text-base hover:bg-brass/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
    >
      {isPending ? "実行中…" : "1個つくる"}
    </button>
  );
}
