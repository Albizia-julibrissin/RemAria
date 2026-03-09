"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { abortCurrentExpedition } from "@/server/actions/exploration";

export function ExplorationAbortClient() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAbort = () => {
    startTransition(async () => {
      const result = await abortCurrentExpedition();
      if (!result.success) {
        alert("探索の強制破棄に失敗しました。");
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleAbort}
      disabled={isPending}
      className="inline-flex items-center justify-center rounded-md border border-red-700/60 px-4 py-2 text-xs sm:text-sm font-medium text-red-200 bg-red-900/40 hover:bg-red-900/60 transition-colors disabled:opacity-60"
    >
      {isPending ? "撤退処理中…" : "探索から撤退"}
    </button>
  );
}

