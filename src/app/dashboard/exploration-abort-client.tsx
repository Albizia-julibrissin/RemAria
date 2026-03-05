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
      className="ml-auto inline-flex items-center rounded-md border border-red-700/60 px-3 py-1.5 text-xs font-medium text-red-300 bg-red-900/30 hover:bg-red-900/50 transition-colors disabled:opacity-60"
    >
      {isPending ? "破棄中…" : "探索を強制破棄（テスト用）"}
    </button>
  );
}

