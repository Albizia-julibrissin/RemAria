"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockResearchTarget } from "@/server/actions/research";
import type { ResearchUnlockCostItem } from "@/server/actions/research";

type Props = {
  targetType: "facility_type" | "craft_recipe";
  targetId: string;
  targetName: string;
  cost: ResearchUnlockCostItem[];
};

export function ResearchUnlockButton({ targetType, targetId, targetName, cost }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = () => {
    setError(null);
    startTransition(async () => {
      const res = await unlockResearchTarget(targetType, targetId);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.message ?? res.error);
      }
    });
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-text-muted">
        消費: {cost.map((c) => `${c.itemName} × ${c.amount}`).join("、")}
      </span>
      <button
        type="button"
        onClick={handleUnlock}
        disabled={isPending}
        className="rounded bg-brass px-3 py-1.5 text-sm font-medium text-base hover:bg-brass-hover focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base disabled:opacity-50"
      >
        {isPending ? "解放中…" : "解放する"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
