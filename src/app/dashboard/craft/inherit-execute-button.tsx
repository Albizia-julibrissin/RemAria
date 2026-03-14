"use client";

// spec/084 Phase3 - 継承実行ボタン

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { inheritEquipmentCap } from "@/server/actions/craft";

type Props = { targetId: string; consumeId: string };

export function InheritExecuteButton({ targetId, consumeId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await inheritEquipmentCap(targetId, consumeId);
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
      {isPending ? "継承中…" : "継承を実行"}
    </button>
  );
}
