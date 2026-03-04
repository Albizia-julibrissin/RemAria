"use client";

// spec/046 - クラフト実行ボタン

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { executeCraft } from "@/server/actions/craft";

type Props = { recipeId: string; recipeName: string };

export function CraftExecuteButton({ recipeId, recipeName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await executeCraft(recipeId);
      if (result.success) {
        router.refresh();
        alert(result.message);
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
