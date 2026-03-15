"use client";

// spec/084 Phase2 - 鍛錬実行ボタン

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { temperEquipment } from "@/server/actions/craft";

type Props = { equipmentInstanceId: string };

export function TemperExecuteButton({ equipmentInstanceId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await temperEquipment(equipmentInstanceId);
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
      className="shrink-0 rounded bg-brass px-4 py-2 text-sm font-medium text-white hover:bg-brass-hover disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-base"
    >
      {isPending ? "鍛錬中…" : "鍛錬"}
    </button>
  );
}
