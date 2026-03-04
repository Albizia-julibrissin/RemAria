"use client";

// spec/047 - 設備解体ボタン

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { dismantleFacility } from "@/server/actions/facilities-placement";

type Props = {
  facilityInstanceId: string;
  facilityName: string;
};

export function DismantleFacilityButton({ facilityInstanceId, facilityName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`「${facilityName}」を解体しますか？\n消費した資源は返却されません。`)) return;
    startTransition(async () => {
      const result = await dismantleFacility(facilityInstanceId);
      if (result.success) {
        router.refresh();
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
      className="rounded border border-red-500/50 bg-transparent px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-red-500"
    >
      {isPending ? "解体中…" : "解体"}
    </button>
  );
}
